/**
 * @file controllers/BillController.js
 * @description Bill parsing controller — accepts a base64-encoded bill image,
 * sends it to the Gemini AI model for OCR extraction, and returns
 * structured JSON (items, subtotal, tax, grand_total).
 */
import  {parseBill}  from "../utils/BillParsher.js";

/**
 * Parse a bill image using AI OCR.
 * @route POST /api/bills/parse
 * @param {import('express').Request} req - body: { image: string } (base64)
 * @param {import('express').Response} res - parsed bill JSON
 */
export default async function billController(req, res) {

  try {

    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        error: "Base64 image required"
      });
    }

    if (typeof image !== 'string' || image.length > 8_000_000) {
      return res.status(413).json({ error: 'Image must be a base64 string smaller than 8 MB' });
    }

    if (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(image)) {
      return res.status(400).json({ error: 'Unsupported or invalid image data' });
    }

    const result = await parseBill(image);

    res.json(result);

  } catch (err) {

    console.error('Bill parsing failed:', err);
    res.status(502).json({ error: 'Bill parsing failed' });

  }
}
