# AURA Assistant — Runtime Hardening Audit

## Applied fixes

- Added `.env.example` so the documented environment setup has a safe template.
- Restored `requirment.txt` with Node.js, browser voice, AI, and optional device-control requirements.
- Reworked the Docker image to use `npm install --omit=dev` because the repository currently has no lockfile.
- Removed the Docker `curl` dependency; the health check now uses Node's built-in `fetch`.
- Runs the container as the non-root `node` user after preparing `/app/data`.
- Added `start-all-safe.js` with portable paths, missing-service checks, signal handling, and no undefined color constants.
- Added `start-all-portable.sh`, removing the hard-coded `/root/aura-assistant` dependency from the active shell launcher.
- Expanded `npm run check` to validate the always-on voice controller and safe launcher.
- Added `public/aura-always-on.js` with wake-word detection, automatic SpeechRecognition recovery, page-resume/network recovery, and browser permission bootstrap.

## Important platform limitation

Browser SpeechRecognition is not a guaranteed 24/7 Android wake-word engine. Mobile browsers can suspend tabs and microphone capture. For true background wake-word operation, AURA should eventually use a native Android foreground service with an on-device wake-word engine, while this browser controller remains the web fallback.

## Remaining architecture work

- Device control should be wired into the main AURA API rather than exposed as an unconnected module.
- Forge and Sentinel should be discovered/configured through environment variables instead of assuming sibling directory names.
- Production secrets must be supplied through deployment secret storage; `.env.example` contains names only.
- A committed `package-lock.json` should be added for reproducible production builds when dependency installation can be run in the development environment.
- Docker Compose persistence should mount directories/volumes rather than replacing individual application data files when those files are expected to be writable by the application.
