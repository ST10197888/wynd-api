# Wynd backend API

Express 5 / MongoDB Atlas backend deployed on Railway. Android connects using Retrofit.

## Local setup

1. Install Node.js 24 and run `npm ci`.
2. Create `.env` locally (never commit it) with the environment variables below.
3. Run `npm start` (or `npm run dev` for nodemon).
4. Run `npm test` for offline contract/unit tests. GitHub Actions runs the same command on pushes and pull requests.

## Environment

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port, defaults to 5000 |
| `MONGODB_URI` | MongoDB Atlas connection URI including database name (`wynd`) |
| `JWT_SECRET` | Strong private key for HS256 user sessions |
| `OPENWEATHER_API_KEY` | OpenWeatherMap current/forecast endpoints |
| `SUPABASE_URL` | Supabase project URL for avatar storage |
| `SUPABASE_SECRET_KEY` | Server-side Supabase storage credential |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Base64-encoded Firebase Admin service-account JSON; check `src/config/firebase.js` |
| `SUPABASE_BUCKET` | Storage bucket (defaults to `wynd-assets`) |
| `ALLOWED_ORIGINS` | Comma-separated permitted browser origins; omit for native-only API |

Verify environment variable names against the deployed config files before setting them. Never put service credentials, JWTs or FCM tokens in Git or screenshots.

## Endpoints and integrations

- `GET /health/live`: process liveness (200).
- `GET /health/ready`: MongoDB readiness (200 when connected, 503 otherwise).
- `GET /settings` and `PUT /settings`: Android-compatible JWT-protected settings; plain `UserSettings` response.
- `GET /users/:userId/settings` and `PUT /users/:userId/settings`: existing user-scoped API; wrapped `{settings}` response.
- `PUT /users/:userId/fcm-token`: register one installation, JWT owner required.
- `DELETE /users/:userId/fcm-token`: unregister an installation, JWT owner required.
- `POST /users/:userId/notifications/test`: send Firebase push to registered installations.
- Weather and gamification routes are under `/weather` and `/gamification`.

## Deployment and checks

Railway deploys the GitHub repository. Set the backend root directory correctly, configure environment variables in Railway, and verify `/health/ready` after deployment. The Android app uses `https://wynd-api-production.up.railway.app/`.

## Current limitations

The automated suite currently covers the settings adapter; it is **not** an end-to-end MongoDB, FCM or Android test suite. Multi-device FCM persistence is confirmed in Atlas for two different accounts, but two devices on one account and actual multicast delivery still need verification. Offline logout token removal needs durable client-side retry and a versioned server-side revocation contract. Automatic weather alert scheduling and persistent gamification must not be claimed as complete until implemented and verified. See the follow-up implementation plan.

## Gamification persistence

Daily facts are stored in MongoDB per UTC day. Achievement records are stored per user. Explorer progress is derived from saved-location count and persisted; Weather Watcher and Storm Spotter have persisted records but **no automatic event-driven progress tracking yet**. Do not describe those two as completed achievements.
