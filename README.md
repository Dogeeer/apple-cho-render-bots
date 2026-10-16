# ChoPayLac on Render

Runs only ChoPayLac in one Render Web Service without a proxy. ApplePayLac is not started by the launcher; its source is retained for later use.

## Render setup

1. Create a Web Service from this repository.
2. Select the Free plan.
3. Use `npm ci --omit=dev` as the build command.
4. Use `npm start` as the start command.
5. Add `MC_PASSWORD` as a secret environment variable.
6. Set the health check path to `/health`.
7. Point an UptimeRobot HTTP monitor at `https://YOUR-SERVICE.onrender.com/health` with a 5-minute interval.

Proxy environment variables are cleared by `render_launcher.js`, so ChoPayLac connects directly from Render.

## Health endpoint

`GET /health` returns the launcher uptime and whether each child process is running or restarting. It does not expose credentials.

## Local check

```bash
npm ci
npm run check
```

Set `MC_PASSWORD` before running `npm start`. Never commit a real `.env` file.
