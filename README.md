# Eventora

## Deploy to Render as one service

The root `render.yaml` configures a single Render web service. The build installs the server and client dependencies and builds the React app; Express serves the built client and the `/api` endpoints from the same service.

1. Push this repository to GitHub and create a Render Blueprint using the repository.
2. Set the prompted `MONGO_URI` to a reachable MongoDB connection string and `JWT_SECRET` to a long, random secret.
3. Deploy. Render builds with `npm ci --prefix server && npm ci --prefix client && npm run build` and starts with `npm start`.

The service exposes `/healthz` for Render health checks. Email uses Nodemailer over SMTP. Locally, the defaults use Gmail SMTP (`smtp.gmail.com`, port `465`, TLS); set `EMAIL_USER` and `EMAIL_PASS` in `server/.env`. For Gmail, `EMAIL_PASS` must be a Google App Password (with 2-Step Verification enabled), not the regular account password.

Render blocks outbound connections on the standard SMTP ports used by Gmail (`465` and `587`), which causes SMTP connection timeouts even when the credentials are correct. For Render, configure a mail provider's SMTP relay that supports port `2525`, then set `SMTP_HOST` to that provider's SMTP hostname, `SMTP_PORT` to `2525`, and `SMTP_SECURE` to `false` in the Render service environment. Set `EMAIL_USER` and `EMAIL_PASS` to that relay's SMTP credentials. If the provider requires a different verified sender address, set `EMAIL_FROM`; otherwise it defaults to `EMAIL_USER`. The Blueprint asks for the SMTP host and credentials (and defaults the port/secure settings for port 2525). Do not put credentials in Git or commit `server/.env`.

Registration keeps only a short-lived OTP and a password hash until the code is verified. A user account is created only after successful verification. If email delivery fails, the pending OTP is removed and the API reports an error rather than claiming registration succeeded.

For local development, start the API with `npm run dev:server` and the Vite client with `npm run dev:client`. The Vite development server proxies `/api` requests to `http://localhost:5000`.
