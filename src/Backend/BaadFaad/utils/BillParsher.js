/**
 * @file utils/BillParsher.js
 * @description AI-powered bill parser using Google Gemini.
 * Accepts a base64-encoded bill image and returns structured JSON
 * with line items, subtotal, tax, and grand_total.
 */
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  process.env.BACKEND_ENV_PATH,
  path.join(__dirname, "..", ".env"),
  path.join(__dirname, "..", "..", ".env"),
  path.join(__dirname, "..", "..", "..", ".env"),
  path.join(__dirname, "..", "..", "..", "..", ".env"),
  path.join(process.cwd(), ".env"),
].filter(Boolean);

for (const envPath of envCandidates) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) break;
}

/**
 * Extract the first valid JSON object/array from an AI text response.
 * Handles fenced code blocks and raw JSON. hh
 * @param {string} text - raw AI response text
 * @returns {string} trimmed JSON string
 */
function extractJson(text) {
  if (!text) {
    throw new Error("No response from bill parser");
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

/**
 * Send a base64 bill image to Google Gemini and return parsed bill JSON.
 * @param {string} base64Image - data URL or raw base64 string
 * @returns {Promise<{items: Array, subtotal: number, tax: number, grand_total: number}>}
 */
export async function parseBill(base64Image) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not configured");
    }

    const api = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });

    console.log("🤖 Sending to Gemini for parsing...");

    const dataUrlMatch = base64Image.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    const mimeType = dataUrlMatch?.[1] || "image/png";
    const base64Data = dataUrlMatch?.[2] || base64Image.replace(/^data:image\/\w+;base64,/, "");

    const response = await api.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",

      contents: [
        {
          parts: [
            {
              text: `
Extract bill contents and return ONLY JSON.

Format:
{
  "items":[
    {
      "name":"",
      "quantity":0,
      "unit_price":0,
      "total_price":0
    }
  ],
  "subtotal":0,
  "tax":0,
  "grand_total":0
}
`,
            },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    const rawText = typeof response.text === "function" ? response.text() : response.text;
    const jsonText = extractJson(rawText);

    console.log("\n✅ FINAL JSON OUTPUT:\n");
    console.log(jsonText);

    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error in parseBill:", error);
    throw new Error("Failed to parse bill: " + error.message);
  }
}
