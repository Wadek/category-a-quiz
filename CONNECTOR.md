# MCP connector — Category A Quiz (Licence Coach)

Local stdio MCP server that exposes spaced-repetition quiz tools for Finnish Category A motorcycle theory practice.

## Prerequisites

- Node.js **≥ 18**
- Dependencies installed once:

```bash
cd /workspace/category-a-quiz/mcp
npm install
```

## AddMcpServer (exact)

Use the absolute project path on your machine. Example for this workspace:

### Option A — `node` + absolute `server.js` (recommended)

```text
Command: node
Args:
  /workspace/category-a-quiz/mcp/server.js
Working directory (optional):
  /workspace/category-a-quiz/mcp
Env (optional):
  CAT_A_QUIZ_STATE=/workspace/category-a-quiz/mcp/state/srs.json
```

JSON-style config many clients accept:

```json
{
  "mcpServers": {
    "category-a-quiz": {
      "command": "node",
      "args": ["/workspace/category-a-quiz/mcp/server.js"],
      "env": {
        "CAT_A_QUIZ_STATE": "/workspace/category-a-quiz/mcp/state/srs.json"
      }
    }
  }
}
```

### Option B — `npx` from the mcp folder

```text
Command: npx
Args:
  --yes
  node
  server.js
Working directory:
  /workspace/category-a-quiz/mcp
```

Prefer Option A; `npx` is unnecessary once dependencies are installed.

## Tools Licence Coach should call

| Tool | Purpose |
|------|---------|
| `quiz_due_count` | `{ topic?: string }` → due counts |
| `quiz_next_card` | `{ topic?: string }` → next card (no answer) |
| `quiz_answer` | `{ cardId?, rating: 0\|1\|2\|3, chosen? }` → grade + SM-2 update |
| `quiz_stats` | progress / weak topics |
| `quiz_add_topic_drill` | `{ topic, limit? }` → queue focused cards |

### Suggested chat flow

1. `quiz_stats` or `quiz_due_count`
2. Optionally `quiz_add_topic_drill` with a weak topic (e.g. `alcohol`)
3. `quiz_next_card` → present question to the learner
4. Learner answers → `quiz_answer` with `rating` and optional `chosen`
5. Repeat

## Persistence note

- **MCP** SRS state: `mcp/state/srs.json` (or `CAT_A_QUIZ_STATE`)
- **PWA** SRS state: browser `localStorage` key `catAQuiz.srs.v1`

These stores are independent so chat coaching and phone study do not overwrite each other unless you deliberately sync files.

## Card bank location

`../data/cards.json` relative to `mcp/` (resolved from the server module).
