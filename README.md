# Eventora

## Deploy to Render as one service

The root `render.yaml` configures a single Render web service. The build installs the server and client dependencies and builds the React app; Express serves the built client and the `/api` endpoints from the same service.

1. Push this repository to GitHub and create a Render Blueprint using the repository.
2. Set the prompted `MONGO_URI` to a reachable MongoDB connection string and `JWT_SECRET` to a long, random secret.
3. Deploy. Render builds with `npm ci --prefix server && npm ci --prefix client && npm run build` and starts with `npm start`.

The service exposes `/healthz` for Render health checks. Email-based OTP registration also requires `EMAIL_USER` and `EMAIL_PASS` to be configured in the service environment. For Gmail, `EMAIL_PASS` must be a Google App Password (with 2-Step Verification enabled), not the regular account password. Locally, put those variables in `server/.env`; never commit that file.

Registration keeps only a short-lived OTP and a password hash until the code is verified. A user account is created only after successful verification. If email delivery fails, the pending OTP is removed and the API reports an error rather than claiming registration succeeded.

For local development, start the API with `npm run dev:server` and the Vite client with `npm run dev:client`. The Vite development server proxies `/api` requests to `http://localhost:5000`.
