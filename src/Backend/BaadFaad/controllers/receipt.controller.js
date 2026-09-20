import {
  createReceiptWithItems,
  findOwnedReceiptById,
} from '../repositories/receipt.repository.js';

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError('At least one receipt item is required');
  }

  return items.map((item) => {
    const name = String(item?.name ?? '').trim().slice(0, 200);
    const price = Number(item?.price);
    const quantity = Number(item?.quantity ?? 1);
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity <= 0) {
      throw new TypeError('Each item requires a name, non-negative price, and positive quantity');
    }
    return { name, price, quantity };
  });
}

export const createReceipt = async (req, res) => {
  try {
    const totalAmount = Number(req.body.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      return res.status(400).json({ success: false, message: 'Invalid totalAmount' });
    }

    const receipt = await createReceiptWithItems({
      createdBy: req.user.id,
      restaurant: String(req.body.restaurant ?? '').trim().slice(0, 200),
      address: String(req.body.address ?? '').trim().slice(0, 500),
      items: normalizeItems(req.body.items),
      totalAmount,
    });

    return res.status(201).json({ success: true, message: 'Receipt created', receipt });
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Receipt creation failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to create receipt' });
  }
};

export const getReceiptById = async (req, res) => {
  try {
    const receipt = await findOwnedReceiptById({ id: req.params.id, createdBy: req.user.id });
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }
    return res.json({ success: true, receipt });
  } catch (error) {
    console.error('Receipt retrieval failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve receipt' });
  }
};
