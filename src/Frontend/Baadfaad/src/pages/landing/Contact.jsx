/**
 * @fileoverview Contact Page
 * @description Contact form and social links for BaadFaad.
 *              Features a feedback form with name, email, and message fields,
 *              a loading spinner on submit, and links to WhatsApp, Instagram,
 *              and email. Wrapped in the landing Topbar and Footer layout.
 *
 * @module pages/landing/Contact
 */
import { useState } from "react";
import {
  FaArrowRight,
  FaAt,
  FaEnvelope,
  FaInstagram,
  FaWhatsapp,
  FaSpinner,
} from "react-icons/fa";
import Footer from "../../components/layout/landing/Footer";
import Topbar from "../../components/layout/landing/Topbar";
import api from "../../config/config";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.message) {
      setError("Please fill in email and message");
      return;
    }
    setSending(true);
    setError("");
    try {
      await api.post("/mail/send", {
        to: "contact@baadfaad.com",
        subject: `Contact from ${formData.name || "Anonymous"} (${formData.email})`,
        text: formData.message,
      });
      setSent(true);
      setFormData({ name: "", email: "", message: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-zinc-50 to-violet-50 text-slate-900">
      <Topbar />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-6 pt-8 sm:px-10">

        <main className="grid flex-1 grid-cols-1 items-center gap-10 py-14 lg:grid-cols-[1fr_1fr]">
          <section>
            <span className="inline-flex rounded-full bg-emerald-100 px-4 py-1 text-xs font-bold tracking-wider text-emerald-800">
              GET IN TOUCH
            </span>

            <h1 className="mt-6 text-6xl font-bold leading-tight text-slate-950">
              Let&apos;s talk
              <br />
              <span className="text-emerald-700">asap.</span>
            </h1>

            <p className="mt-6 max-w-md text-2xl leading-relaxed text-slate-700">
              Have a burning question or just want to say hi? We&apos;re all
              ears and ready to help you level up.
            </p>

            <button
              type="button"
              className="mt-10 flex w-full max-w-md items-center justify-between rounded-full bg-emerald-400 px-6 py-5 text-left shadow-lg shadow-emerald-200"
            >
              <span className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-slate-900">
                  <FaWhatsapp />
                </span>
                <span>
                  <span className="block text-xs font-bold tracking-wide text-slate-950">
                    DIRECT LINE
                  </span>
                  <span className="text-3xl font-bold text-slate-950">
                    Ping us on WhatsApp
                  </span>
                </span>
              </span>
              <FaArrowRight className="text-xl text-slate-900" />
            </button>

            <div className="mt-5 flex w-full max-w-md items-center gap-4 rounded-full bg-white px-6 py-5 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-slate-500">
                <FaEnvelope />
              </span>
              <span>
                <span className="block text-xs font-bold tracking-wide text-slate-600">
                  EMAIL SUPPORT
                </span>
                <span className="text-2xl font-semibold text-slate-900">
                  contact@baadfaad.com
                </span>
              </span>
            </div>

            <div className="mt-10 flex items-center gap-4">
              <p className="text-xs font-bold tracking-[0.2em] text-slate-600">
                FOLLOW US
              </p>
              <button
                type="button"
                aria-label="Email"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600"
              >
                <FaAt className="text-xs" />
              </button>
              <button
                type="button"
                aria-label="Previous social link"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600"
              >
                <FaArrowRight className="rotate-180 text-xs" />
              </button>
              <button
                type="button"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600"
              >
                <FaInstagram className="text-xs" />
              </button>
            </div>
          </section>

          <section className="rounded-4xl bg-white p-8 shadow-sm sm:p-10">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 text-2xl mb-4">✓</div>
                <p className="text-xl font-bold text-slate-900">Message Sent!</p>
                <p className="mt-2 text-sm text-slate-500">We'll get back to you soon.</p>
                <button type="button" onClick={() => setSent(false)} className="mt-6 rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-900">Send Another</button>
              </div>
            ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-500">
                  Full Name
                </span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  className="w-full rounded-full bg-zinc-100 px-5 py-4 text-sm text-slate-700 outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-emerald-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-500">
                  Email Address
                </span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  className="w-full rounded-full bg-zinc-100 px-5 py-4 text-sm text-slate-700 outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-emerald-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-500">
                  Message
                </span>
                <textarea
                  rows={4}
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us what's on your mind..."
                  className="w-full resize-none rounded-[1.8rem] bg-zinc-100 px-5 py-4 text-sm text-slate-700 outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-emerald-300"
                />
              </label>

              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

              <button
                type="submit"
                disabled={sending}
                className="mt-3 w-full rounded-full bg-linear-to-r from-emerald-950 to-slate-900 px-8 py-5 text-lg font-bold text-white shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? <FaSpinner className="animate-spin" /> : null}
                Send Message <span className="text-emerald-300">&gt;</span>
              </button>
            </form>
            )}

            <p className="mt-6 text-center text-xs font-medium text-slate-600">
              Average response time: &lt; 2 hours
            </p>
          </section>
        </main>

      </div>
      <Footer />
    </div>
  );
}
