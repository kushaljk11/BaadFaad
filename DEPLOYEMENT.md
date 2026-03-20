# Deployment Guide

This file documents concise deployment steps for the project:
- Frontend: Vercel (static/Vite)
- Backend: Render (Node/Express)

Prerequisites
-------------
- Git repository access
- Accounts on Vercel and Render
- Production environment values (MongoDB Atlas URI, Google OAuth client credentials, email/SMS provider credentials)

Frontend — Vercel
------------------
1. In Vercel, create a new project and import the Git repository.
2. Set the project root to `src/Frontend/Baadfaad`.
3. Build command: `npm run build` (default in package.json: `vite build`).
4. Output directory: `dist` (Vite default).
5. Environment variables (Vercel → Settings → Environment):
	- `VITE_BASE_URL` = `https://classathon-hisabsathi-baadfaad.onrender.com`
	- Any public keys or non-sensitive flags used by the frontend.
6. Deploy. Verify the site at the assigned Vercel URL (e.g. `https://baadfaad.vercel.app`).

Backend — Render
-----------------
1. In Render, create a new Web Service and connect the same repository.
2. Set the build and start commands in Render (Repository root should point to `src/Backend/BaadFaad`):
	- Build command: (optional) `npm install`
	- Start command: `npm start` (uses `node server.js` in `package.json`)
3. Environment variables (Render → Environment): set these values precisely:
	- `PORT` (optional)
	- `MONGO_URI` — MongoDB Atlas connection string
	- `JWT_SECRET`
	- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
	- `GOOGLE_CALLBACK_URL` = `https://classathon-hisabsathi-baadfaad.onrender.com/api/auth/google/callback`
	- `BACKEND_URL` = `https://classathon-hisabsathi-baadfaad.onrender.com`
	- `FRONTEND_URL` = `https://baadfaad.vercel.app`
	- `RESEND_API_KEY` and `MAIL_FROM_EMAIL` (if using email)
	- Payment gateway keys (ESEWA*, KHALTI*), if used in production
4. Deploy / restart the service.

Google OAuth (required for Google Sign-in)
----------------------------------------
1. In Google Cloud Console → APIs & Services → Credentials, open your OAuth 2.0 Client.
2. Add both authorized redirect URIs:
	- `http://localhost:5000/api/auth/google/callback` (development)
	- `https://classathon-hisabsathi-baadfaad.onrender.com/api/auth/google/callback` (production)
3. Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Render match this client.

Quick verification & testing
----------------------------
- From the deployed frontend, trigger Google sign-in and inspect the `redirect_uri` parameter in the address bar — it must exactly match the production callback URI added to Google Console.
- Watch Render logs while performing sign-in to see callback requests to `/api/auth/google/callback`.
- Use an Incognito window to avoid extension blocking (e.g., `ERR_BLOCKED_BY_CLIENT` from adblockers).

Common deployment gotchas
------------------------
- Case-sensitive imports: Linux hosts (Vercel) are case-sensitive. Fix imports like `pages/Group` → `pages/group`.
- Using `npm run dev` in production: `dev` may use `nodemon` (a dev dependency). Use `npm start` for production.
- OAuth `redirect_uri_mismatch`: register the exact callback URI in Google Console and set `GOOGLE_CALLBACK_URL` in the backend env.
- Env location: this repo config uses Vite `envDir` to load root `.env`; set Vite variables in Vercel or in root `.env` during local builds.

Logs & troubleshooting
----------------------
- Vercel: use the Vercel dashboard → Deployments and Preview logs for frontend build errors.
- Render: use the service Dashboard → Logs to inspect backend startup and request logs (useful for OAuth callback hits and payment webhook handling).

Security & best practices
-------------------------
- Do not commit `.env` with secrets. Use hosting provider env variables for production.
- Rotate API keys and passwords used during development before going public.

If you want, I can also add exact Render and Vercel screenshot walkthrough steps or commit a sample `render.yaml`/`vercel.json` for easier reproducible deployment.

