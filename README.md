# Category A Quiz — Finland Motorcycle Theory (en-FI)

Anki-style spaced-repetition Progressive Web App for **Finnish Category A motorcycle** theory practice, plus a local **MCP server** so Licence Coach (or any MCP client) can drive quizzes from chat.

> **Disclaimer:** Cards are **original practice questions** grounded in Traficom / Finlex / Finnish traffic-law *themes*. They are **not** official Teoriakoe items and are **not** scraped from CAP/Webauto or other proprietary banks.

## What's included

| Path | Purpose |
|------|---------|
| `index.html`, `css/`, `js/`, `sw.js`, `manifest.webmanifest` | Offline-capable PWA |
| `data/cards.json` | 148 practice cards (incl. ~25 situation diagrams) + source metadata |
| `mcp/` | Local MCP server (`quiz_*` tools) |
| `CONNECTOR.md` | Exact AddMcpServer command / args |

## Topics covered

signs · right_of_way · speed · equipment · alcohol · lights · passengers · winter · highways · licence · visibility · mechanics · other_users · risk · diagrams (situation drawings tagged under right_of_way / visibility / other_users)

Aligned with Traficom A1/A2/A theory topic areas (traffic rules, driver, road, other users, protective equipment, conspicuity, road-condition hazards, motorcycle mechanical safety, etc.).

## Run the PWA (static serve)

Any static file server works. From this directory:

```bash
cd /workspace/category-a-quiz
python3 -m http.server 8765 --bind 127.0.0.1
```

Open: http://127.0.0.1:8765/

Or with Node:

```bash
npx --yes serve -l 8765 /workspace/category-a-quiz
```

### Install as PWA (phone / desktop)

1. Serve over **localhost** or **HTTPS** (required for service workers / install prompts).
2. Chrome / Edge: menu → **Install app** / **Cast, save, and share → Install page as app**.
3. iOS Safari: Share → **Add to Home Screen**.
4. Android Chrome: Install banner or menu → **Install app**.

Once installed, the service worker caches the shell and `data/cards.json` for offline study. Progress is stored in **browser localStorage** (SM-2).

## Study features

- Multiple choice + true/false
- **Situation diagrams** (`kind: "drawing"`): top-down junction / priority / lane-position schematics — study the SVG + situation text, tap **I've studied the situation**, then answer MC
- Explanation after each answer with Traficom / Tieliikennelaki–aligned rationale and source theme
- Ratings: **Again / Hard / Good / Easy** (SM-2 intervals)
- Dashboard: due today, retention index, weak topics
- Topic drills

### Diagram card fields (optional on `mc` cards)

| Field | Purpose |
|-------|---------|
| `kind: "drawing"` | Marks a liikennetilannepiirros-style card |
| `diagramSvg` | Inline SVG (~320×240), self-contained |
| `situation` | What you see / what happens next (shown before options) |
| `diagramAscii` | Compact text sketch for MCP clients |

## MCP server (Licence Coach)

```bash
cd /workspace/category-a-quiz/mcp
npm install
node server.js
```

Tools:

- `quiz_due_count` — due reviews (optional topic)
- `quiz_next_card` — next due/drill card (answer hidden)
- `quiz_answer` — record rating `0|1|2|3` (Again/Hard/Good/Easy)
- `quiz_stats` — dashboard stats + weak topics
- `quiz_add_topic_drill` — queue a topic drill

SRS state file: `mcp/state/srs.json` (override with env `CAT_A_QUIZ_STATE`).

See **[CONNECTOR.md](./CONNECTOR.md)** for AddMcpServer wiring.

## Research basis (high level)

- Traficom: Driving examination / Kuljettajantutkinto (A: 20/50/5 sections)
- Traficom: Moottoripyörän ajokortin hankkiminen (A/A2/A1 ages, PPE for tests)
- Tieliikennelaki 729/2018 themes (helmet §92, lights, yield/turning duties, motorway bans)
- Traficom theory-test regulation topic lists for A1/A2/A
- Väylävirasto winter speed practice; Liikenneturva / Poliisi right-of-way themes

## Licence

Practice content authored for this project. Official Traficom/Finlex texts remain with their rights holders — cite and link; do not dump exam banks.
