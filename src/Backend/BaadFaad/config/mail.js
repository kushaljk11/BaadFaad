/**
 * @file config/mail.js
 * @description Resilient mail sender with provider fallback (Resend + Mailjet).
 */
import Mailjet from "node-mailjet";
import { Resend } from "resend";

let mailjetClient = null;
let resendClient = null;

const MAIL_SEND_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.MAIL_SEND_TIMEOUT_MS || 12000)
);

const PROVIDERS = {
  RESEND: "resend",
  MAILJET: "mailjet",
};

const hasResendCredentials = () => Boolean(process.env.RESEND_API_KEY);

const hasMailjetCredentials = () =>
  Boolean(process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY);

const buildMailError = (message, { statusCode, code, provider, details } = {}) => {
  const err = new Error(message);
  if (statusCode) err.statusCode = statusCode;
  if (code) err.code = code;
  if (provider) err.provider = provider;
  if (details) err.details = details;
  return err;
};

const extractMailjetError = (err) => {
  const statusCode = err?.statusCode || err?.response?.status || err?.response?.statusCode || null;
  const body = err?.response?.body || {};

  const firstMessageError = body?.Messages?.[0]?.Errors?.[0] || null;
  const message =
    firstMessageError?.ErrorMessage ||
    body?.ErrorMessage ||
    body?.message ||
    err?.message ||
    "Mailjet send failed";

  const isBlocked =
    Number(statusCode) === 401 &&
    String(message || "").toLowerCase().includes("temporarily blocked");

  return {
    statusCode: statusCode || (isBlocked ? 401 : null),
    message,
    code: isBlocked ? "MAILJET_ACCOUNT_BLOCKED" : "MAILJET_SEND_FAILED",
    details: {
      ...(body || {}),
      rawMessageError: firstMessageError || null,
    },
  };
};

const withTimeout = async (promise, { timeoutMs = MAIL_SEND_TIMEOUT_MS, provider, operation } = {}) => {
  let timer = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            buildMailError(
              `${provider || "Mail provider"} ${operation || "request"} timed out after ${timeoutMs}ms`,
              {
                statusCode: 504,
                code: "MAIL_PROVIDER_TIMEOUT",
                provider,
                details: { timeoutMs, operation: operation || "request" },
              }
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const normalizeRecipients = (to) => {
  if (!to) return [];
  if (Array.isArray(to)) return to.filter(Boolean).map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof to === "string") {
    return to
      .split(/[;,]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [String(to).trim()].filter(Boolean);
};

const getMailjetClient = () => {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw buildMailError("Missing MAILJET_API_KEY or MAILJET_SECRET_KEY", {
      statusCode: 500,
      code: "MAILJET_CONFIG_MISSING",
      provider: PROVIDERS.MAILJET,
    });
  }

  if (!mailjetClient) {
    mailjetClient = Mailjet.apiConnect(apiKey, secretKey);
  }

  return mailjetClient;
};

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw buildMailError("Missing RESEND_API_KEY", {
      statusCode: 500,
      code: "RESEND_CONFIG_MISSING",
      provider: PROVIDERS.RESEND,
    });
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
};

const resolveProviderOrder = () => {
  const explicit = String(process.env.MAIL_PROVIDER || "").trim().toLowerCase();

  if (explicit === PROVIDERS.RESEND) return [PROVIDERS.RESEND, PROVIDERS.MAILJET];
  if (explicit === PROVIDERS.MAILJET) return [PROVIDERS.MAILJET, PROVIDERS.RESEND];

  // Auto mode: pick available provider first.
  if (hasResendCredentials()) return [PROVIDERS.RESEND, PROVIDERS.MAILJET];
  if (hasMailjetCredentials()) return [PROVIDERS.MAILJET, PROVIDERS.RESEND];

  // Default preference when nothing is configured yet.
  return [PROVIDERS.RESEND, PROVIDERS.MAILJET];
};

export const inspectMailConfig = () => {
  const providerOrder = resolveProviderOrder();
  const missing = {
    resend: [],
    mailjet: [],
    sender: [],
  };

  if (!process.env.RESEND_API_KEY) missing.resend.push("RESEND_API_KEY");

  if (!process.env.MAILJET_API_KEY) missing.mailjet.push("MAILJET_API_KEY");
  if (!process.env.MAILJET_SECRET_KEY) missing.mailjet.push("MAILJET_SECRET_KEY");

  if (!process.env.MAIL_FROM_EMAIL && !process.env.EMAIL_USER) {
    missing.sender.push("MAIL_FROM_EMAIL|EMAIL_USER");
  }

  return {
    providerPreference: String(process.env.MAIL_PROVIDER || "auto").toLowerCase() || "auto",
    providerOrder,
    resendConfigured: hasResendCredentials(),
    mailjetConfigured: hasMailjetCredentials(),
    senderConfigured: Boolean(process.env.MAIL_FROM_EMAIL || process.env.EMAIL_USER),
    missing,
  };
};

const sendViaResend = async ({ recipients, subject, text, html, fromEmail, fromName }) => {
  const client = getResendClient();

  try {
    const result = await withTimeout(
      client.emails.send({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: recipients,
        subject: subject || "",
        text: text || html || "",
        html: html || text || "",
      }),
      { timeoutMs: MAIL_SEND_TIMEOUT_MS, provider: PROVIDERS.RESEND, operation: "send" }
    );

    if (result?.error) {
      throw buildMailError(result.error.message || "Resend send failed", {
        statusCode: 502,
        code: "RESEND_SEND_FAILED",
        provider: PROVIDERS.RESEND,
        details: result.error,
      });
    }

    return { provider: PROVIDERS.RESEND, response: result?.data || result };
  } catch (err) {
    if (err?.code === "RESEND_SEND_FAILED") {
      throw err;
    }

    throw buildMailError(err?.message || "Resend send failed", {
      statusCode: err?.statusCode || 502,
      code: "RESEND_SEND_FAILED",
      provider: PROVIDERS.RESEND,
      details: err,
    });
  }
};

const sendViaMailjet = async ({ recipients, subject, text, html, fromEmail, fromName }) => {
  const client = getMailjetClient();

  const messages = recipients.map((email) => ({
    From: {
      Email: fromEmail,
      Name: fromName,
    },
    To: [{ Email: email }],
    Subject: subject || "",
    TextPart: text || html || "",
    HTMLPart: html || text || "",
  }));

  try {
    const response = await withTimeout(
      client
        .post("send", { version: "v3.1" })
        .request({ Messages: messages }),
      { timeoutMs: MAIL_SEND_TIMEOUT_MS, provider: PROVIDERS.MAILJET, operation: "send" }
    );
    return { provider: PROVIDERS.MAILJET, response: response?.body || response };
  } catch (err) {
    const parsed = extractMailjetError(err);
    throw buildMailError(parsed.message, {
      statusCode: parsed.statusCode,
      code: parsed.code,
      provider: PROVIDERS.MAILJET,
      details: parsed.details,
    });
  }
};

/**
 * Send an email via configured provider.
 * @param {object} params
 * @param {string|string[]} params.to - Recipient email(s)
 * @param {string} params.subject - Email subject
 * @param {string} [params.text] - Plain-text body
 * @param {string} [params.html] - HTML body
 * @param {string} [params.fromEmail] - Sender email; defaults to EMAIL_USER or MAIL_FROM_EMAIL
 * @param {string} [params.fromName] - Sender display name
 */
export const sendEmail = async ({
  to,
  subject,
  text,
  html,
  fromEmail = process.env.MAIL_FROM_EMAIL || process.env.EMAIL_USER,
  fromName = "BaadFaad",
}) => {
  const recipients = normalizeRecipients(to);

  if (!recipients.length) {
    throw buildMailError("Recipient email (to) is required", {
      statusCode: 400,
      code: "MAIL_TO_REQUIRED",
    });
  }

  if (!fromEmail) {
    throw buildMailError("Sender email is required (set MAIL_FROM_EMAIL or EMAIL_USER)", {
      statusCode: 500,
      code: "MAIL_FROM_REQUIRED",
    });
  }

  const order = resolveProviderOrder();
  const errors = [];

  for (const provider of order) {
    if (provider === PROVIDERS.RESEND && hasResendCredentials()) {
      try {
        return await sendViaResend({ recipients, subject, text, html, fromEmail, fromName });
      } catch (error) {
        errors.push(error);
      }
    }

    if (provider === PROVIDERS.MAILJET && hasMailjetCredentials()) {
      try {
        return await sendViaMailjet({ recipients, subject, text, html, fromEmail, fromName });
      } catch (error) {
        errors.push(error);
      }
    }
  }

  if (!hasResendCredentials() && !hasMailjetCredentials()) {
    throw buildMailError(
      "No mail provider configured. Set RESEND_API_KEY or MAILJET_API_KEY/MAILJET_SECRET_KEY",
      { statusCode: 500, code: "MAIL_PROVIDER_NOT_CONFIGURED" }
    );
  }

  const topError = errors[0];
  const providerTrail = errors.map((e) => e?.provider).filter(Boolean);

  if (
    topError?.code === "MAILJET_ACCOUNT_BLOCKED" &&
    !hasResendCredentials()
  ) {
    throw buildMailError(
      "Mailjet account is temporarily blocked (401). Configure RESEND_API_KEY or contact Mailjet support.",
      {
        statusCode: 401,
        code: "MAILJET_ACCOUNT_BLOCKED",
        provider: PROVIDERS.MAILJET,
        details: topError?.details || null,
      }
    );
  }

  throw buildMailError(topError?.message || "Email send failed", {
    statusCode: topError?.statusCode || 502,
    code: topError?.code || "MAIL_SEND_FAILED",
    provider: topError?.provider,
    details: {
      attempts: providerTrail,
      failures: errors.map((e) => ({
        provider: e?.provider,
        code: e?.code,
        message: e?.message,
      })),
    },
  });
};

// Convenience helper for simple signature (to, subject, html)
export const sendEmailSimple = async (to, subject, html) =>
  sendEmail({ to, subject, html, text: html });

export const verifyMailConnection = async () => {
  const order = resolveProviderOrder();

  for (const provider of order) {
    if (provider === PROVIDERS.RESEND && hasResendCredentials()) {
      const client = getResendClient();
      const result = await withTimeout(
        client.domains.list(),
        { timeoutMs: MAIL_SEND_TIMEOUT_MS, provider: PROVIDERS.RESEND, operation: "verify" }
      );

      if (result?.error) {
        throw buildMailError(result.error.message || "Resend verification failed", {
          statusCode: 502,
          code: "RESEND_VERIFY_FAILED",
          provider: PROVIDERS.RESEND,
          details: result.error,
        });
      }

      return { ok: true, provider: PROVIDERS.RESEND };
    }

    if (provider === PROVIDERS.MAILJET && hasMailjetCredentials()) {
      const client = getMailjetClient();
      await withTimeout(
        client.get("apikey", { version: "v3" }).request(),
        { timeoutMs: MAIL_SEND_TIMEOUT_MS, provider: PROVIDERS.MAILJET, operation: "verify" }
      );
      return { ok: true, provider: PROVIDERS.MAILJET };
    }
  }

  throw buildMailError(
    "No mail provider configured for verification",
    { statusCode: 500, code: "MAIL_PROVIDER_NOT_CONFIGURED" }
  );
};

// Default export preserves the previous shape for existing imports
export default { sendMail: sendEmail, sendEmail, verifyMailConnection, inspectMailConfig };