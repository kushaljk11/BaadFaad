import { getPrisma } from '../config/prisma.js';

export function toUserDto(user, { includePassword = false } = {}) {
  if (!user) return null;
  const dto = {
    _id: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  if (includePassword) dto.password = user.password;
  return dto;
}

export async function findUserByEmail(email, options) {
  const user = await getPrisma().user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  });
  return toUserDto(user, options);
}

export async function findUserById(id) {
  const user = await getPrisma().user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, image: true, role: true, createdAt: true, updatedAt: true },
  });
  return toUserDto(user);
}

export async function createUser(data) {
  const user = await getPrisma().user.create({
    data: {
      name: data.name,
      email: String(data.email).trim().toLowerCase(),
      image: data.image ?? null,
      password: data.password ?? null,
      role: data.role ?? null,
    },
  });
  return toUserDto(user, { includePassword: Boolean(data.password) });
}

export async function findOrCreateOAuthUser({ name, email, image }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await getPrisma().user.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { name, email: normalizedEmail, image: image ?? null },
  });
  return toUserDto(user);
}
