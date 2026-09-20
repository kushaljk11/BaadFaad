import { createHash, randomBytes } from 'node:crypto';

export function createInvitationToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token) {
  return createHash('sha256').update(String(token), 'utf8').digest('hex');
}

export async function consumeInvitation(tx, { token, type, groupId, sessionId }) {
  const now = new Date();
  const tokenHash = hashInvitationToken(token);
  const rows = type === 'GROUP'
    ? await tx.$queryRaw`SELECT "id" FROM "Invitation" WHERE "tokenHash" = ${tokenHash} AND "type" = 'GROUP'::"InvitationType" AND "groupId" = ${groupId}::uuid AND "revokedAt" IS NULL AND "expiresAt" > ${now} AND ("maxUses" = 0 OR "useCount" < "maxUses") FOR UPDATE`
    : await tx.$queryRaw`SELECT "id" FROM "Invitation" WHERE "tokenHash" = ${tokenHash} AND "type" = 'SESSION'::"InvitationType" AND "sessionId" = ${sessionId}::uuid AND "revokedAt" IS NULL AND "expiresAt" > ${now} AND ("maxUses" = 0 OR "useCount" < "maxUses") FOR UPDATE`;
  if (rows.length !== 1) return false;
  await tx.invitation.update({ where: { id: rows[0].id }, data: { useCount: { increment: 1 } } });
  return true;
}
