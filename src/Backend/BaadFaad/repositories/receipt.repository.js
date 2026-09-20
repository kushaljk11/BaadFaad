import { getPrisma } from '../config/prisma.js';
import { fromPaisa, toPaisa } from '../utils/money.js';

function moneyNumber(paisa) {
  return Number(fromPaisa(paisa));
}

export function toReceiptDto(receipt) {
  if (!receipt) return null;

  const relationalItems = receipt.relationalItems ?? [];
  const items = relationalItems.length > 0
    ? relationalItems.map((item) => ({
        name: item.name,
        price: moneyNumber(item.unitPricePaisa),
        quantity: Number(item.quantity),
      }))
    : receipt.items;

  return {
    _id: receipt.id,
    id: receipt.id,
    createdBy: receipt.createdBy,
    restaurant: receipt.restaurant,
    address: receipt.address,
    items,
    totalAmount: receipt.totalPaisa == null
      ? Number(receipt.totalAmount)
      : moneyNumber(receipt.totalPaisa),
    imageUrl: receipt.imageUrl,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
  };
}

export async function createReceiptWithItems({ createdBy, restaurant, address, items, totalAmount }) {
  const prisma = getPrisma();
  const totalPaisa = toPaisa(totalAmount);

  const receipt = await prisma.receipt.create({
    data: {
      createdBy,
      restaurant,
      address,
      items,
      totalAmount: Number(totalAmount),
      totalPaisa,
      relationalItems: {
        create: items.map((item, sortOrder) => {
          const unitPricePaisa = toPaisa(item.price);
          const totalPricePaisa = toPaisa(Number(item.price) * Number(item.quantity));
          return {
            name: item.name,
            quantity: String(item.quantity),
            unitPricePaisa,
            totalPricePaisa,
            sortOrder,
          };
        }),
      },
    },
    include: { relationalItems: { orderBy: { sortOrder: 'asc' } } },
  });

  return toReceiptDto(receipt);
}

export async function findOwnedReceiptById({ id, createdBy }) {
  const receipt = await getPrisma().receipt.findFirst({
    where: { id, createdBy },
    include: { relationalItems: { orderBy: { sortOrder: 'asc' } } },
  });
  return toReceiptDto(receipt);
}
