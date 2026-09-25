# Verification — September 25, 2026

## Automated: 10 tests passed

Run `npm test`. Uses Node's test runner and the actual `ws` client/server.

- Startup frames cause no damage; the active hit lands once and never repeats through recovery.
- Standing guard blocks mids; lows beat standing guard; crouch guard blocks lows.
- A light-to-heavy hit confirm forms a combo with damage scaling.
- Whiffs cannot cancel; dashes enforce their duration and cooldown.
- Identical input streams reproduce identical state through 2,500 frames.
- A timeout draw gives neither player a round and correctly resets the next round.
- AI waits for its difficulty-specific observation delay and never writes directly into game state.
- AI-versus-AI simulations at Easy, Normal, and Hard each finish a match under the shared rules.
- Two independent WebSocket clients create/join, ready up, play a complete 2–0 match, request a rematch, and complete another 2–0 match. Both receive identical authoritative final states. This test advances server ticks faster than wall time; the production engine and network protocol are unchanged. It also checks third-player rejection, authenticated reconnect, duplicate/stale input rejection, ignored extra health fields, and a disconnect forfeit with a shortened test grace window.
- A separate real-time server test introduces 80–120 ms application-level input delays (including stale arrival order), compares 156 shared snapshots, and checks automatic release after a sender stalls. Both connections stay open and all compared snapshots match. This is controlled delay testing, not a wide-area-network measurement.

An additional direct simulation verified Kite's light → light → heavy → special combo lands four hits with scaled damage of 62, 60, 85, and 91.

## Browser checks

- Loaded the actual running project in the provided Chrome browser. Inspected the stage, pixel fighters, menus, controls, HUD, and fight screen visually.
- Opened two distinct browser clients, created a six-character room, joined as a different fighter, and started an online match through both Ready buttons.
- Exercised keyboard focus/input, Rook's special, and the room exit flow. The remaining player receives the forfeit win screen.
- Started Easy AI practice through the visible menu; verified correct opponent, full starting health, timer, controls, and practice label.
- Opened Edit Keys, rebound Light from J to F, and restored defaults.
- No application JavaScript errors were reported; unrelated browser-extension metadata errors were present.
- The browser exposed no supported WebMCP modelContext, so validation of the optional `start_practice` tool was unavailable. The game uses normal UI controls regardless.

## Performance and deployment limits

- The browser reported **60 simulation ticks/second** after simulation/network timing was separated from drawing.
- Remote display callbacks were observed around **2 FPS**, including on the menu. One measured menu draw took **0.3 ms**. This environment therefore does **not** prove 60 FPS presentation on a real laptop; that remains a user-device check.
- Two actual home computers on different internet connections were not available. Public end-to-end PvP requires deploying the included Node server, then doing that final real-network check.
- The hosted Sites build is the client and can run AI practice. It is not a hosted persistent Node/WebSocket server. Exact Render deployment steps and the single-instance requirement are in README.md.
- High-latency play uses prediction/reconciliation, not full rollback. Server restarts discard active rooms; reconnect works only while the room still exists.
