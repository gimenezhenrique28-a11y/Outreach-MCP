# Wharf Outreach MCP

An AI-powered outreach automation server built on the [Model Context Protocol](https://modelcontextprotocol.io). Finds prospects on GitHub, enriches them with Claude AI, validates your product thesis against live market data, and sends personalised cold emails in your voice — all controllable from Telegram.

Built for [Wharf (TalentWharf)](https://www.linkedin.com/company/talentwharf/) but forkable for any B2B outreach use case.

---

## What it does

```
find prospects → enrich with AI → filter by ICP → send personalised email → track pipeline
```

| Tool | Description |
|---|---|
| `find_contacts` | Search GitHub for technical prospects by keyword, location, language, followers |
| `enrich_contact` | Claude AI deep-analyzes a GitHub profile: role, seniority, company size, ICP fit score, talking points, suggested email |
| `research_market` | Search the web (Brave) to validate your product thesis, map competitors, find pain point discussions |
| `find_customers_web` | Search for real potential customers: funded startups, frustrated ATS users, founders actively hiring |
| `search_contacts` | Query your saved Supabase contact list by status, role, or company |
| `send_email` | Send via Gmail OAuth2 and auto-update contact status |
| `log_outreach` | Upsert a contact + status in Supabase |
| `get_outreach_stats` | Pipeline counts by status with ASCII chart |

---

## Architecture

```
Telegram bot
    └── Claude (claude-sonnet-4-6) — agentic loop
            ├── GitHub API          — prospect discovery (free)
            ├── Brave Search API    — market + customer research (free tier)
            ├── Claude Haiku        — profile enrichment + ICP scoring
            ├── Gmail OAuth2        — email sending
            └── Supabase            — contact pipeline storage

MCP server (stdio)
    └── Same tools, usable from Claude Desktop or any MCP client
```

---

## ICP filter

Every contact is scored on two dimensions:
- **candidate_score** — fit as a potential hire (1–10)
- **beta_user_score** — fit as a product beta user (1–10)

And filtered by ICP:
- **Passes:** companies with 20–100 employees OR seed/Series A startups actively hiring
- **Auto-skipped:** solo freelancers, enterprises 500+, companies not building a team

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/wharf-outreach-mcp
cd wharf-outreach-mcp
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env` — see comments in `.env.example` for where to get each key:

| Variable | Required | Free tier |
|---|---|---|
| `GITHUB_TOKEN` | Optional | Yes — 5000 req/hr vs 60/hr |
| `BRAVE_API_KEY` | For web research | Yes — 2000 queries/month |
| `GMAIL_CLIENT_ID` | Yes | Yes |
| `GMAIL_CLIENT_SECRET` | Yes | Yes |
| `GMAIL_REFRESH_TOKEN` | Yes | Yes |
| `SUPABASE_URL` | Yes | Yes |
| `SUPABASE_SERVICE_KEY` | Yes | Yes |
| `ANTHROPIC_API_KEY` | Yes | Pay per use |
| `TELEGRAM_BOT_TOKEN` | For Telegram bot | Yes |
| `TELEGRAM_ALLOWED_CHAT_ID` | Recommended | — |

### 3. Gmail OAuth2 refresh token

Run the one-time helper script:

```bash
node scripts/get-refresh-token.js
```

Follow the prompts. Paste the resulting `GMAIL_REFRESH_TOKEN` into your `.env`.

> **Prerequisite:** add `http://localhost:3000` as an authorized redirect URI in your Google Cloud Console OAuth2 client.

### 4. Run the Supabase migration

Paste `supabase/migrations/001_outreach.sql` into your Supabase SQL editor, or run:

```bash
supabase db push
```

### 5. Build

```bash
npm run build
```

### 6. Personalise your writing voice (optional but recommended)

```bash
cp voice.example.txt voice.txt
```

Edit `voice.txt` with real examples of your own writing. The bot uses this to match your style in every email draft. `voice.txt` is gitignored and stays local.

---

## Running

### Telegram bot

```bash
npm run bot
```

The bot accepts natural language — no commands needed:

> *"find 10 seed founders in London, enrich them, and send beta invites to the best ones"*
> *"validate my product thesis against the market"*
> *"show me who replied but hasn't booked yet"*

Built-in commands: `/stats`, `/pending`, `/replied`, `/clear`

### MCP server (Claude Desktop)

```bash
npm start
```

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wharf-outreach": {
      "command": "node",
      "args": ["/absolute/path/to/wharf-outreach-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "...",
        "BRAVE_API_KEY": "...",
        "GMAIL_CLIENT_ID": "...",
        "GMAIL_CLIENT_SECRET": "...",
        "GMAIL_REFRESH_TOKEN": "...",
        "SUPABASE_URL": "...",
        "SUPABASE_SERVICE_KEY": "...",
        "ANTHROPIC_API_KEY": "..."
      }
    }
  }
}
```

---

## Outreach pipeline

```
pending → sent → replied → booked
```

---

## Customising for your use case

The system prompt, ICP filter, and email writing rules live in:
- `src/bot/agent.ts` — agent system prompt + workflow
- `voice.txt` — your writing voice (gitignored, local only)
- `humanizer.md` — anti-AI writing protocol applied to every draft

Edit these to match your product, ICP, and tone.

---

## File structure

```
src/
  index.ts                  MCP server entrypoint
  bot.ts                    Telegram bot entrypoint
  lib/
    github.ts               GitHub API client + profile fetcher
    enrichment.ts           Claude Haiku profile analysis
    search.ts               Brave Search API wrapper
    gmail.ts                Gmail OAuth2 sender
    supabase.ts             Supabase client + types
  bot/
    agent.ts                Agentic loop + system prompt
    telegram.ts             Telegraf bot
    toolDefs.ts             Tool definitions for Claude API
  tools/
    findContacts.ts         find_contacts
    enrichContact.ts        enrich_contact
    researchMarket.ts       research_market
    findCustomersWeb.ts     find_customers_web
    searchContacts.ts       search_contacts
    sendEmail.ts            send_email
    logOutreach.ts          log_outreach
    getStats.ts             get_outreach_stats
supabase/migrations/
  001_outreach.sql          DB schema
scripts/
  get-refresh-token.js      One-time Gmail OAuth2 helper
voice.example.txt           Template for your writing voice profile
humanizer.md                Anti-AI writing protocol
.env.example                Environment variable reference
```

---

## Tech stack

- **Runtime:** Node.js + TypeScript
- **MCP:** `@modelcontextprotocol/sdk`
- **AI:** `@anthropic-ai/sdk` (Sonnet 4.6 for agent, Haiku for enrichment)
- **Bot:** `telegraf`
- **Database:** `@supabase/supabase-js`
- **Email:** `googleapis` (Gmail API)
- **Search:** `axios` → Brave Search API + GitHub API

---

## License

MIT
