/**
 * @file config/socket.js
 * @description Socket.IO server setup and event handlers.
 *
 * Events:
 *  - join-session-room / leave-session-room — room management
 *  - host-navigate — host redirects all participants to a new page
 *  - items-update  — host broadcasts live bill item changes
 */
import { Server } from "socket.io";
import jwt from 'jsonwebtoken';
import { canAccessRealtimeRoom } from '../repositories/session.repository.js';

let io = null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REALTIME_PAYLOAD_BYTES = 256 * 1024;

export function isSafeNavigationPath(path) {
  return typeof path === 'string' && path.length <= 2048 && path.startsWith('/') && !path.startsWith('//') && !/[\u0000-\u001f]/.test(path);
}

export function isSafeItemsPayload(scannedData, manualItems) {
  if (manualItems !== undefined && (!Array.isArray(manualItems) || manualItems.length > 500)) return false;
  if (scannedData !== undefined && (scannedData === null || typeof scannedData !== 'object' || Array.isArray(scannedData))) return false;
  try {
    return Buffer.byteLength(JSON.stringify({ scannedData, manualItems }), 'utf8') <= MAX_REALTIME_PAYLOAD_BYTES;
  } catch {
    return false;
  }
}

/**
 * Initialize Socket.IO with the HTTP server
 */
export const initSocket = (httpServer) => {
  const rawFrontend = process.env.FRONTEND_URL || 'https://baadfaad.vercel.app';
  const allowedOrigins = rawFrontend
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  io = new Server(httpServer, {
    maxHttpBufferSize: 512 * 1024,
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || !process.env.JWT_SECRET) return next(new Error('Unauthorized'));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on("connection", (socket) => {
    // Client joins a session room to receive real-time updates
    socket.on("join-session-room", async (sessionId, acknowledge) => {
      try {
        if (UUID.test(String(sessionId || '')) && await canAccessRealtimeRoom(sessionId, socket.user.id)) {
          await socket.join(sessionId);
          if (typeof acknowledge === 'function') acknowledge({ ok: true });
        } else if (typeof acknowledge === 'function') {
          acknowledge({ ok: false, error: 'Access denied' });
        }
      } catch (error) {
        console.error('Socket room authorization failed', { socketId: socket.id, error: error.message });
        if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Unable to join session' });
      }
    });

    socket.on("leave-session-room", (sessionId) => {
      if (UUID.test(String(sessionId || ''))) {
        socket.leave(sessionId);
      }
    });

    // Host tells everyone in the room to navigate to a new page
    socket.on("host-navigate", async ({ sessionId, path } = {}, acknowledge) => {
      try {
        if (UUID.test(String(sessionId || '')) && isSafeNavigationPath(path) && await canAccessRealtimeRoom(sessionId, socket.user.id, true)) {
          socket.to(sessionId).emit("host-navigate", { path });
          if (typeof acknowledge === 'function') acknowledge({ ok: true });
        } else if (typeof acknowledge === 'function') {
          acknowledge({ ok: false, error: 'Invalid payload or access denied' });
        }
      } catch (error) {
        console.error('Socket navigation authorization failed', { socketId: socket.id, error: error.message });
        if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Unable to publish navigation' });
      }
    });

    // Host broadcasts bill items to all participants in real time
    socket.on("items-update", async ({ sessionId, scannedData, manualItems } = {}, acknowledge) => {
      try {
        if (UUID.test(String(sessionId || '')) && isSafeItemsPayload(scannedData, manualItems) && await canAccessRealtimeRoom(sessionId, socket.user.id, true)) {
          socket.to(sessionId).emit("items-update", { scannedData, manualItems });
          if (typeof acknowledge === 'function') acknowledge({ ok: true });
        } else if (typeof acknowledge === 'function') {
          acknowledge({ ok: false, error: 'Invalid payload or access denied' });
        }
      } catch (error) {
        console.error('Socket item update authorization failed', { socketId: socket.id, error: error.message });
        if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Unable to publish items' });
      }
    });
  });

  return io;
};

/**
 * Get the current Socket.IO instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized — call initSocket(server) first");
  }
  return io;
};
