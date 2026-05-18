/**
 * @fileoverview BaadFaad — Express Application Entry Point
 * @description Main server file that bootstraps the entire backend:
 *  1. Loads environment variables (dotenv)
 *  2. Connects to MongoDB via Mongoose
 *  3. Creates an HTTP server with Express
 *  4. Initializes Socket.IO for real-time session events
 *  5. Registers global middleware (CORS, JSON body parser)
 *  6. Mounts all API route modules under /api/*
 *  7. Starts listening on the configured PORT
 *
 * @module server
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dns from 'node:dns';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import connectDB from './config/database.js';
import { initSocket } from './config/socket.js';

// routes
import mailRoutes from './routes/mail.routes.js';
import nudgeRoutes from './routes/nudge.route.js';
import groupRoutes from './routes/group.routes.js';
import authRoutes from './routes/authRoute.js';
import participantRoutes from './routes/participant.routes.js';
import splitRoutes from './routes/split.routes.js';
import receiptRoutes from './routes/receipt.routes.js';
import sessionRoutes from './routes/session.route.js';
import billRoutes from './routes/bill.routes.js';
import paymentRoutes from "./routes/payment.routes.js";



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  process.env.BACKEND_ENV_PATH,
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
  path.join(__dirname, '..', '..', '..', '.env'),
  path.join(process.cwd(), '.env'),
].filter(Boolean);

let envLoaded = false;
for (const envPath of envCandidates) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  dotenv.config();
}

// // Render instances may not have reliable IPv6 egress to SMTP providers.
// // Prefer IPv4 for outbound DNS resolution (e.g., smtp.gmail.com).
// try {
//   dns.setDefaultResultOrder('ipv4first');
// } catch (e) {
//   console.warn('Failed to set DNS result order:', e?.message || e);
// }

connectDB();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
initSocket(httpServer);

// Configure CORS for the frontend. `FRONTEND_URL` may be a single origin
// or a comma-separated list of origins.
const rawFrontend = process.env.FRONTEND_URL || 'https://baadfaad.vercel.app';
const ALLOWED_ORIGINS = rawFrontend.split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);

if (process.env.NODE_ENV === 'production') {
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true
  }));
} else {
  // In development allow the requesting origin (reflect) so Vite on any port works.
  app.use(cors({ origin: true, credentials: true }));
  // Global CORS middleware above will handle preflight OPTIONS requests in development.
}
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 5000;

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/nudge', nudgeRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/splits', splitRoutes);
app.use('/api/receipts', receiptRoutes);
app.use("/api/session", sessionRoutes);
app.use('/api/bills', billRoutes);
app.use("/api/payment", paymentRoutes);

app.get('/', (req, res) => {
  res.send('Server is running!');
});

httpServer.listen(PORT, '0.0.0.0', () => {
  const frontend = (process.env.FRONTEND_URL || 'https://baadfaad.vercel.app').replace(/\/$/, '');
  const googleCallback = process.env.GOOGLE_CALLBACK_URL || 'not-set';
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend origin: ${frontend}`);
  console.log(`Google callback URL: ${googleCallback}`);
});
