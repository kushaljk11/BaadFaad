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

  let rows = [];
  if (type === 'GROUP' && groupId) {
    rows = await tx.$queryRaw`
      SELECT i."id"
      FROM "Invitation" i
      LEFT JOIN "Group" g ON g."id" = ${groupId}::uuid
      WHERE i."tokenHash" = ${tokenHash}
        AND i."revokedAt" IS NULL
        AND i."expiresAt" > ${now}
        AND (i."maxUses" = 0 OR i."useCount" < i."maxUses")
        AND (
          (i."type" = 'GROUP'::"InvitationType" AND i."groupId" = ${groupId}::uuid)
          OR (i."type" = 'SESSION'::"InvitationType" AND g."sessionId" IS NOT NULL AND i."sessionId" = g."sessionId")
        )
      FOR UPDATE OF i
    `;
  } else if (type === 'SESSION' && sessionId) {
    rows = await tx.$queryRaw`
      SELECT i."id"
      FROM "Invitation" i
      LEFT JOIN "Group" g ON g."sessionId" = ${sessionId}::uuid
      WHERE i."tokenHash" = ${tokenHash}
        AND i."revokedAt" IS NULL
        AND i."expiresAt" > ${now}
        AND (i."maxUses" = 0 OR i."useCount" < i."maxUses")
        AND (
          (i."type" = 'SESSION'::"InvitationType" AND i."sessionId" = ${sessionId}::uuid)
          OR (i."type" = 'GROUP'::"InvitationType" AND g."id" IS NOT NULL AND i."groupId" = g."id")
        )
      FOR UPDATE OF i
    `;
  } else {
    rows = type === 'GROUP'
      ? await tx.$queryRaw`SELECT "id" FROM "Invitation" WHERE "tokenHash" = ${tokenHash} AND "type" = 'GROUP'::"InvitationType" AND "groupId" = ${groupId}::uuid AND "revokedAt" IS NULL AND "expiresAt" > ${now} AND ("maxUses" = 0 OR "useCount" < "maxUses") FOR UPDATE`
      : await tx.$queryRaw`SELECT "id" FROM "Invitation" WHERE "tokenHash" = ${tokenHash} AND "type" = 'SESSION'::"InvitationType" AND "sessionId" = ${sessionId}::uuid AND "revokedAt" IS NULL AND "expiresAt" > ${now} AND ("maxUses" = 0 OR "useCount" < "maxUses") FOR UPDATE`;
  }

  if (!rows || rows.length === 0) return false;
  await tx.invitation.update({ where: { id: rows[0].id }, data: { useCount: { increment: 1 } } });
  return true;
}
