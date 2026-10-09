# Neon Rumble

A playable browser pixel fighter with a real authoritative Node.js room server, two original fighters, and local AI practice. The full project is in this folder.

## Launch on your laptop

1. Install Node.js 22 or newer from https://nodejs.org/ if you do not already have it.
2. Extract the project ZIP into a folder.
3. On Windows, double-click `START-WINDOWS.bat`. Alternatively, open a terminal in the project folder and run:

   ```sh
   npm ci
   npm start
   ```

4. Open **http://localhost:3000** in Chrome, Edge, or Firefox. Keep the terminal open.

Choose a fighter and **Practice vs AI**, or create a room and join it in a second browser tab to test PvP. Both players press **Ready to Fight**. The local URL works on your own computer; it is not a public internet address.


## Embed in Google Sites

The Netlify/static client is designed to run inside a Google Sites iframe.

1. Publish the `client/` folder on Netlify.
2. In Google Sites, choose **Insert → Embed → By URL**.
3. Use the public game URL with `?embed=1`, for example `https://neonrumble.netlify.app/?embed=1`.
4. Resize the embed so the 16:9 game area and controls are visible, then publish the Google Site.

The client intentionally does not send an `X-Frame-Options` header or a restrictive `frame-ancestors` CSP, because either can prevent Google Sites from framing the game. The `?embed=1` presentation hides the outer masthead/footer and keeps the game itself prominent.

AI practice works from the static embed. Online room codes still require the Node/WebSocket server. If the full project is deployed to a Node host such as Render, embedding that hosted game URL is the simplest online setup because the page, `/health`, and `/ws` all share one origin.

Embedding does not override browser, school, workplace, or network administrator filtering. If the hosting domain itself is blocked by the device or network, the embed will also be blocked.

## Play with a friend on a separate internet connection

The provided Sites page runs AI practice immediately. Its hosting supports the game page, but this project’s persistent Node/WebSocket room server needs a separate host. The Node server included here serves **both the webpage and online rooms**, so the simplest setup is to deploy this whole project once:

1. Create a GitHub repository and upload the extracted project contents. `package.json`, `server.mjs`, `client/`, and `shared/` must be at the repository root. Do not upload `node_modules/`.
2. Open https://dashboard.render.com/ and choose **New → Web Service**. Connect that repository.
3. Set these values:

   | Setting | Value |
   | --- | --- |
   | Runtime | Node |
   | Build command | `npm ci --omit=dev` |
   | Start command | `npm start` |
   | Health check | `/health` |
   | Instance count | **1** |
   | Region | The closest available region to both players |

4. Choose the instance plan you want and deploy. `render.yaml` is also included for Render Blueprint deployment.
5. Open the HTTPS address Render gives you. Create a room, click **Copy Invite Link**, and send that link and the displayed six-character code to your friend. Your friend joins and both players press **Ready to Fight**.

That hosting/account step was **not performed** here. No Render account or billing access was available. You do not need port forwarding, a shared Wi-Fi network, or a separate client installation. A sleeping/free instance can take time to wake up; wait until the page reports **Online server ready**.

If you prefer the Sites game page, open **Connection settings**, paste your Render HTTPS address, and save. The invite link includes the server address automatically. The server accepts WebSocket traffic on `/ws` on the same port as HTTP. Always use HTTPS/WSS on the public internet.

Official deployment references: https://render.com/docs/deploy-node-express-app and https://render.com/docs/websocket

## Controls

| Action | Key |
| --- | --- |
| Walk | A / D |
| Jump | W or Space |
| Crouch | S |
| Short forward dash | Shift |
| Light attack | J |
| Heavy attack | K |
| Special | L |
| Hold guard | I |

Click **Edit Keys** to change bindings. Changes stay on that browser. Hold crouch and guard to block lows; use standing guard against jumping attacks. There is no chip damage. Air attacks are overheads. Crouch + light performs a low.

Try **light → light → special** on the ground. For a six-hit aerial route, use **light → light → heavy → jump → air light → air heavy → air special**, pressing each next button as the hit connects. Jump-cancelled air attacks carry you forward, and direction inputs let you steer through air attacks. Hit cancels only occur on contact, not on a whiff or blocked attack. The chain cannot loop into infinite lights; damage scales down with combo length. The attack and jump buffers are ten frames.

Kite is quick and closes space with a rushing special. Rook is slower, reaches farther, and fires a pulse. Both have 1,000 health, and mirror matches use an alternate palette.

## What is implemented

- Fixed 60 Hz deterministic combat, authored startup/active/recovery frames, separate hit/hurt/push boxes, hit/block stun, gravity, knockback, four-to-six-frame hit pause, cooldowns, and one hit per attack instance.
- First to two rounds, 60-second timer, timeout and double-KO draws, victory screens, and two-party rematches.
- Generated pixel rooftop, code-authored pixel poses for idle/walk/jump/crouch/dash/guard/hurt/attacks, nearest-neighbor 640×360 rendering, restrained hit effects, synthesized audio, mute, and fullscreen.
- Six-character cryptographically generated room codes, two slots, readiness, copyable invite, reconnect tokens, 15-second disconnect grace, pause/resume, and forfeit. Third clients cannot enter an occupied room.
- The server alone owns health, moves, collisions, time, and scoring. Clients send bounded input bitmasks and increasing sequence numbers. Stale/duplicate input packets are rejected; inputs release after 400 ms without updates.
- Snapshots at 30 Hz, local 60 Hz prediction, authoritative reconciliation, and replay of up to 200 ms of pending local input. Health and hit effects use confirmed snapshots. A network indicator shows round-trip time; stale connections freeze prediction and display a warning.
- Easy, Normal, and Hard AI use exactly the same engine and move data. Observation delays are 500/300/167 ms, with different decision intervals, defense probabilities, spacing, and choices. The AI never reads future inputs or changes health/damage.

## Limits of this first version

- This is server authority with client prediction, **not tournament-grade rollback netcode**. High latency can cause visible corrections. Rendering targets 60 FPS; actual performance depends on the laptop/browser.
- Run **one server instance**. Rooms are ephemeral in-memory matches. Restarting/deploying the server ends active rooms. Horizontal scaling would require a shared room router or one durable coordinator per room.
- Keyboard is the supported play input. The layout adapts to small screens, but this version has no touch controls or gamepad support.
- The disconnect grace preserves a match while the same server stays up. A host restart requires a new room.
- Automated network tests and two-browser UI checks were performed in the development environment. A real match across two household internet connections and the public server deployment still require the hosting step above.

## Development

```sh
npm test       # deterministic combat, AI, real WebSocket matches and network delay checks
npm run build  # creates a standalone static client in dist/
npm run dev    # starts the Node server; also accepts --port
```

`shared/engine.mjs` contains all fighter data and rules. `shared/ai.mjs` contains AI decision-making. `server.mjs` owns rooms and simulation. `client/` contains the canvas renderer, sound, inputs, prediction, and menus. Move timings and key mappings are deliberately centralized.

Optional environment variables: `PORT` (default 3000); `ALLOWED_ORIGINS` (comma-separated browser origins allowed to open WebSockets). Leave the latter unset for a simple public friend-play server, or include every frontend origin you use. No API key or database is required.

The background in `client/assets/rooftop.png` was created with the built-in image-generation tool from this brief: original 16-bit pixel art nighttime rooftop train station, cyan/indigo skyline and amber windows, level fighting floor, orange kiosk left, pipes right, no characters or HUD. The fighter drawings and sound are original project code.

## October 9 combat update (02)

The menu identifies this release as **AIR COMBAT UPDATE · 02**. Both characters can chase their launcher through all three air attacks; air attacks accept directional steering. The visible combo guide follows custom key bindings and is available in Google Sites embeds. Entry-point and combat-module URLs carry a release query so browser caches revalidate the changed files.

Netlify publishes `client/`. Keep `client/shared/` synchronized with the authoritative `shared/` modules. `npm run build` copies the canonical shared modules to `dist/shared/` for other hosts.
