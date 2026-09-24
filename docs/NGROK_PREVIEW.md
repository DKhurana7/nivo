# Temporary tester link

The ngrok preview serves the production build through a separate authenticated app on loopback port 8792. Its database is `data/ngrok-preview.sqlite`, with illustrative projects and vendors. The real owner studio stays on port 8787 and `data/nivo.sqlite`; its Raisina BOQ and account are not copied to the preview.

The current link and generated tester login are in private, ignored `data/ngrok-preview-login.json`. Share those details directly with the intended tester. The tester can import their own files, edit/save BOQs, try quotation extraction, download Excel and use the walkthrough. Edits persist in the preview database across restarts. A shared tester account shares its workspace and first-tour status; Help always offers replay.

## Start or restart

From the repository root, with Node 22:

```sh
npm run build
ngrok http 8792 --inspect=false --log=data/ngrok.log --log-format=json
```

In another terminal:

```sh
node --import tsx scripts/ngrok-preview.ts
```

The launcher reads the current HTTPS tunnel from ngrok's local API on port 4040 and sets the exact allowed app origin. It creates the tester account only on first setup, reuses existing records and updates the private login file's URL. It refuses mismatched login/database files rather than resetting existing work. Restart this launcher if ngrok assigns a different URL. Do not use `--env-file=.env` for the preview; the launcher strips voice/extraction provider variables and disables outbound calls. It serves built `dist/` assets, not Vite source files.

Keep the Mac awake and connected to the internet, with both processes running. Closing the laptop, stopping either process or losing connectivity can make the link unavailable. Visitors on the free tunnel may need to click **Visit Site** once before reaching the login screen. No paid ngrok plan or new domain was purchased.

## Limits and stopping

Voice calls are unavailable in this preview. An HTTPS web tunnel alone does not expose the local LiveKit media ports/TURN service; provider credentials and real-studio call data are absent. This is temporary UI/workflow testing, not a verified public voice deployment.

Sign-in, Secure/HttpOnly/SameSite cookies, CSRF origin checks, rate limits and private file access remain enabled. Traffic inspection is disabled locally in ngrok. Only the tester instance is tunneled; application uploads remain subject to existing limits. Ngrok carries the HTTPS traffic to this Mac, so use test data appropriate for sharing.

Stop ngrok with Ctrl+C in its terminal to remove access. Stop the preview launcher separately; its database/login remain available for a later session. Check current processes before stopping anything; HANDOVER.md records only the last verified PIDs. Local owner access remains http://127.0.0.1:5178.

## Resetting a walkthrough

The owner walkthrough reset is a deliberate deletion of only that account's row in `onboarding`. It does not change projects, rates or files. After reset, refresh the signed-in app or sign in again; the first display claims the row once. Ordinary testers can replay from Help without a database reset. There is no public account-reset API.
