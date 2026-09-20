import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { io as createClient } from 'socket.io-client';
import { getPrisma } from '../config/prisma.js';
import { getIO, initSocket } from '../config/socket.js';

const runDatabaseTests = process.env.RUN_DB_TESTS === '1';
const waitFor = (socket, event) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 3000);
  socket.once(event, (...args) => { clearTimeout(timer); resolve(args); });
});
const emitAck = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

test('Socket.IO authenticates, authorizes rooms, limits payloads, and supports rejoin', {
  skip: runDatabaseTests ? false : 'set RUN_DB_TESTS=1 to run PostgreSQL integration tests',
}, async () => {
  const prisma = getPrisma();
  const secret = `socket-test-${randomUUID()}`;
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  const hostId = randomUUID();
  const memberId = randomUUID();
  const outsiderId = randomUUID();
  const splitId = randomUUID();
  const sessionId = randomUUID();
  const server = createServer();
  initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const clients = [];
  const connect = async (userId) => {
    const socket = createClient(url, { transports: ['websocket'], reconnection: false, auth: { token: jwt.sign({ id: userId }, secret) } });
    clients.push(socket);
    await waitFor(socket, 'connect');
    return socket;
  };
  try {
    await prisma.user.createMany({ data: [
      { id: hostId, name: 'Host', email: `host-${hostId}@example.test` },
      { id: memberId, name: 'Member', email: `member-${memberId}@example.test` },
      { id: outsiderId, name: 'Outsider', email: `outsider-${outsiderId}@example.test` },
    ] });
    await prisma.split.create({ data: { id: splitId, createdBy: hostId, splitType: 'equal', totalAmount: 10 } });
    await prisma.session.create({ data: {
      id: sessionId, name: 'Socket test', splitId, endDate: new Date(Date.now() + 3600000),
      relationalParticipants: { create: [
        { userId: hostId, displayName: 'Host', isHost: true },
        { userId: memberId, displayName: 'Member' },
      ] },
    } });

    const unauthorized = createClient(url, { transports: ['websocket'], reconnection: false });
    clients.push(unauthorized);
    const [authError] = await waitFor(unauthorized, 'connect_error');
    assert.match(authError.message, /Unauthorized/);

    const host = await connect(hostId);
    const member = await connect(memberId);
    const outsider = await connect(outsiderId);
    assert.deepEqual(await emitAck(host, 'join-session-room', sessionId), { ok: true });
    assert.deepEqual(await emitAck(member, 'join-session-room', sessionId), { ok: true });
    assert.equal((await emitAck(outsider, 'join-session-room', sessionId)).ok, false);

    const navigation = waitFor(member, 'host-navigate');
    assert.deepEqual(await emitAck(host, 'host-navigate', { sessionId, path: '/split/scan' }), { ok: true });
    assert.deepEqual(await navigation, [{ path: '/split/scan' }]);
    assert.equal((await emitAck(member, 'host-navigate', { sessionId, path: '/admin' })).ok, false);
    assert.equal((await emitAck(host, 'host-navigate', { sessionId, path: '//evil.example' })).ok, false);
    assert.equal((await emitAck(host, 'items-update', { sessionId, scannedData: { raw: 'x'.repeat(300000) }, manualItems: [] })).ok, false);

    member.disconnect();
    member.connect();
    await waitFor(member, 'connect');
    assert.deepEqual(await emitAck(member, 'join-session-room', sessionId), { ok: true });
    const afterReconnect = waitFor(member, 'host-navigate');
    await emitAck(host, 'host-navigate', { sessionId, path: '/split/calculated' });
    assert.deepEqual(await afterReconnect, [{ path: '/split/calculated' }]);
  } finally {
    clients.forEach((client) => client.disconnect());
    await new Promise((resolve) => getIO().close(() => resolve()));
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.split.deleteMany({ where: { id: splitId } });
    await prisma.user.deleteMany({ where: { id: { in: [hostId, memberId, outsiderId] } } });
    await prisma.$disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  }
});
