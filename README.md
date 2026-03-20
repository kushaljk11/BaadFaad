# BaadFaad / HisabSathi

**Smart bill splitting and settlement platform for Nepal — split bills, not friendships.**

---

## 1. Project Title and One-Line Description

**BaadFaad (HisabSathi)** — A full-stack bill-splitting and payment-settlement app that lets groups scan or enter bills, split costs fairly (equal, percentage, or item-based), join via QR/link, and settle up with minimal awkwardness.

---

## 2. Problem Statement

Splitting restaurant and group bills in Nepal is painful: manual math with VAT and service charge, one person always overpaying and chasing others, and the classic "Rs. 7 change" drama. The post-dinner ritual of figuring who owes what takes too long and strains friendships. There was no single app built for Nepali groups that combined easy bill capture, flexible splitting, and a path to pay (eSewa/Khalti) in one place.

---

## 3. Solution Overview

BaadFaad solves this with an AI-powered bill parser (Google Gemini) that extracts line items and totals from a photo, a flexible split engine (equal, percentage, custom, or item-based), and real-time sessions so friends can join via QR or link and see their share instantly. The PWA frontend works on any device and can be installed like an app; optional email nudges and group settlements keep everyone aligned without awkward conversations.

---

## 4. Unique Selling Proposition

BaadFaad is built specifically for Nepali group payments: it understands local pain points (e.g. small-change drama), highlights eSewa and Khalti as settlement options, supports anonymous nudges so you don’t have to be the one chasing friends, and offers a “breakup safe” one-tap settlement to clear history. AI bill parsing plus multiple split modes and a PWA install experience set it apart from generic split apps.

---

## 5. Tech Stack

| Layer        | Technologies |
|------------- |---------------|
| **Backend**  | Node.js, Express 5, MongoDB, Mongoose, Socket.IO, JWT, Passport (Google OAuth 2.0), Mailjet, @google/genai (Gemini),Tesseract.js
| **Frontend** | React 19, React Router 7, Vite 7, Tailwind CSS 4, socket.io-client, react-hot-toast, vite-plugin-pwa |
| **Database** | MongoDB (NoSQL; no seed data required) |

---

## Architecture Overview

At a high level, the **React + Vite frontend** talks to the **Express backend controllers** over REST and Socket.IO.  
The backend persists bills, users, sessions, and splits in **MongoDB**, connects to **payment gateways (eSewa / Khalti)** to verify payments and callbacks, and uses **Socket.IO** to push real-time updates (status changes, new participants, settlements) back to all connected group members.  
You can see this flow summarized in the `Architecture.md` diagram: Frontend → Backend Controllers → MongoDB / Payment Gateway / Socket.IO → back to members.

---

## 6. Setup Instructions (Step-by-Step)

**Prerequisites:** Node.js (v18+), npm, MongoDB (local or Atlas URI), and a `.env` file (see Environment Variables below).

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ClassAThon-HisabSathi-BaadFaad
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in all required keys (see Section 7).

3. **Backend setup and run**
   ```bash
   cd src/Backend/BaadFaad
   npm install
   npm run dev
   ```
   Backend runs at `http://localhost:5000`. Health check: open `http://localhost:5000/` — you should see "Server is running!".

4. **Frontend setup and run** (in a new terminal)
   ```bash
   cd src/Frontend/Baadfaad
   npm install
   npm run dev
   ```
   Frontend runs at `http://localhost:5173`.

5. **Use the app**
   - Open `http://localhost:5173` in a browser.
   - Sign in with Google (ensure OAuth callback URL is set in Google Cloud Console).
   - Create or join a split, scan/enter a bill, and invite others via link or QR.

**Production:** Backend: `npm start`. Frontend: `npm run build` then serve the `dist/` folder.

---

## 7. Environment Variables

Create a `.env` file at the **project root** (or where the backend loads it), using `.env.example` as a template. Required keys:

| Variable                    | Description                                                               |
|-----------------------------|---------------------------------------------------------------------------|
| `PORT`                      | Backend server port (default: `5000`)                                     |
| `MONGO_URI`                 | MongoDB connection string (Atlas or local)                                |
| `JWT_SECRET`                | Secret for signing JWT tokens                                             |
| `GOOGLE_CLIENT_ID`          | Google OAuth 2.0 client ID                                                |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth 2.0 client secret                                            |
| `GOOGLE_CALLBACK_URL`       | OAuth callback URL (e.g. `http://localhost:5000/api/auth/google/callback`)|
| `GOOGLE_API_KEY`            | Google Gemini API key (for AI bill parsing)                               |
| `QR_BASE_URL`               | Base URL for join links/QR (e.g. `http://localhost:5173`)                 |
| `MAIL_PROVIDER`             | `resend` or `mailjet` (default `resend`)                                  |
| `RESEND_API_KEY`            | Resend API key (recommended for Render deployment)                         |
| `MAILJET_API_KEY` / `MAILJET_SECRET_KEY` | Mailjet API credentials (if Mailjet is used)                 |
| `MAIL_SEND_TIMEOUT_MS`      | Max time per provider request before timeout (default `12000`)            |
| `MAIL_FROM_EMAIL`           | Sender email address used by mail provider                                |

Mail smoke test (from backend folder):

```bash
npm run mail:test -- you@example.com
```

**Security:** Do not commit real secrets. Use `.env.example` for structure only; keep production values in a secure env/config store.

---

## 8. Deployment Link

- **Live app:** _[Add live URL when deployed]_
- **APK / PWA:** _[Add link if you provide an APK or PWA install URL]_

---

## 9. Team Members

| Name                   | Role                 |
|-----------------------------------------------|
| Kushal Jamarkattel     | Team Lead & Frontend |
| Rojash Thapa           | Backend Developer    |
| Ujwal Timsina          | Database & Logic     |
| Regan Karki            | Business & Q/A       |
| Samana Upreti          | Ui/Ux Design         |

---

*
Built for ClassAThon / HisabSathi hackathon. For production use, review security, replace all secrets, and apply your own license and compliance.
*
