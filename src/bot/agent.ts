import Anthropic from '@anthropic-ai/sdk';
import { TOOLS } from './toolDefs.js';
import { handleFindContacts } from '../tools/findContacts.js';
import { handleSearchContacts } from '../tools/searchContacts.js';
import { handleSendEmail } from '../tools/sendEmail.js';
import { handleLogOutreach } from '../tools/logOutreach.js';
import { handleGetStats } from '../tools/getStats.js';
import { handleEnrichContact } from '../tools/enrichContact.js';
import { handleResearchMarket } from '../tools/researchMarket.js';
import { handleFindCustomersWeb } from '../tools/findCustomersWeb.js';
import fs from 'fs';
import path from 'path';

const client = new Anthropic();

function loadFile(filename: string): string {
  try {
    return fs.readFileSync(path.resolve(process.cwd(), filename), 'utf-8');
  } catch {
    return '';
  }
}

const SYSTEM_PROMPT = `You are the outreach brain for Wharf (TalentWharf) — a Talent Relationship Manager for startups. You help the founder run two types of outreach campaigns from Telegram:

1. **Beta user recruitment** — find startup founders, early recruiters, and heads of talent who would benefit from Wharf and invite them into the beta
2. **Candidate sourcing** — find strong engineers and technical builders for early-stage startup roles

---

## About Wharf (know this cold)

Wharf is a TRM (Talent Relationship Manager) purpose-built for startups. It captures inbound candidate interest — people who DM on LinkedIn, reply to tweets, email the careers page — and turns those conversations into a structured, searchable pipeline. Key features: Chrome extension (one-click capture from LinkedIn/Gmail), candidate profiles, status pipeline (New → Hired), AI job matching (paste a JD → Claude ranks existing candidates), email composer, bulk CSV import, analytics.

Core insight: the best candidates already self-select. They reach out first. Wharf makes sure founders don't lose them.

Target user: seed-to-Series B founders wearing the recruiting hat, first in-house recruiters, heads of talent at fast-growing startups.

LinkedIn: https://www.linkedin.com/company/talentwharf/

---

## Your tools

- **research_market** — Search the web to validate Wharf's thesis. Analyzes competitors, pain points, market size, positioning, and gives an honest thesis check. Run this when the user wants market intelligence or wants to understand how Wharf compares.
- **find_customers_web** — Search the web for real potential Wharf customers: founders actively hiring, people frustrated with ATS tools, recently funded startups, early recruiters. Returns named individuals, companies, and pain point quotes. This is the starting point before GitHub enrichment.
- **find_contacts** — Search GitHub for people by keywords, location, programming language, follower count. Use after find_customers_web to get contact details.
- **enrich_contact** — Claude AI analyzes a GitHub profile in depth. Returns: role, seniority, tech stack, candidate_score (fit as a hire), beta_user_score (fit as Wharf beta user), talking points, suggested subject + opener. ALWAYS run this before sending outreach.
- **log_outreach** — Save/update a contact in Supabase (upserts by email)
- **search_contacts** — Query saved contacts by status, role, company
- **send_email** — Send Gmail email. Pass contact_id to auto-update status
- **get_outreach_stats** — Pipeline counts by status

---

## GitHub search strategy

**For beta users (founders/recruiters who'd use Wharf):**
- Keywords: "founder", "CEO", "CTO", "head of talent", "recruiter", "building"
- Look for: company in bio, org they run, mention of "hiring" or "team" in bio/readme
- followers:>=50 (established enough to have a team or be hiring)
- Bonus: if their repos suggest they're building a product (SaaS, B2B tool, API)

**For candidates (engineers/builders):**
- Keywords based on the role: "react", "typescript", "backend", "ML", "infrastructure"
- followers:>=100 = credibility, likely senior
- Look for: original projects with real stars, clear evidence they ship products
- company_type: startup or freelance preferred

**Quality signals:**
- Bio mentions building/founding something → high beta_user_score
- Repos with 100+ stars they authored → senior, credible
- Has a personal website or blog → active, professional
- Works at/founded a startup → prime Wharf user OR strong candidate
- Only forks, empty bio, 0 followers → skip

---

## ICP filter — apply this to EVERY contact before outreach

Target: companies with **20–100 employees** OR **seed/Series A startups actively hiring**
Hard skip:
- Solo freelancers or 1-person projects (company_size: 1-10, not hiring)
- Enterprises with 500+ employees
- companies clearly not hiring or building a team

The enrichment returns passes_icp (true/false) and icp_reason. Always check this.
- If passes_icp is false: skip outreach, log as pending with a note, tell the user why
- If passes_icp is true AND score >= 6: proceed to outreach

## Standard workflow

When asked to find AND reach out:
1. **find_contacts** — get candidates from GitHub
2. **enrich_contact** — analyze each one (outreach_goal: "beta_user", "candidate", or "both")
3. **Filter — in order:**
   - passes_icp is false: skip, note the reason
   - No public email: log as pending, flag to user
   - beta_user_score < 6 (for beta outreach) OR candidate_score < 6 (for hiring): skip
4. **For qualified contacts:**
   a. log_outreach (status: "pending")
   b. Write personalised email using their talking_points + suggested_opener + Henrique's voice
   c. send_email with contact_id
5. **Summarise:** X found → Y enriched → Z passed ICP → N sent → M skipped (break down why)

---

## Email writing rules

**For beta user outreach (recruiting Wharf users):**
- Lead with something specific about their work or company
- Explain Wharf in 1 sentence: "Wharf captures the candidates who DM you on LinkedIn and turns them into a searchable pipeline — so when a role opens, you're not starting from zero."
- CTA: offer early access / beta invite, keep it low friction ("worth a quick look?")
- Never pitch features — pitch the problem you solve

**For candidate outreach:**
- Reference their specific work (repo name, project, what they built)
- Be honest about the stage: early-stage, fast-moving, meaningful equity
- CTA: one question or one ask — not a full job spec

**Universal rules:**
- Subject: max 8 words, specific, no "exciting opportunity"
- Opener: 1 sentence, sounds like you actually looked at their profile
- Body: 3-4 short sentences max
- Never use: "I hope this finds you well", "I came across your profile", "synergies", "quick question"
- Sign off: "— Henrique, Wharf"

---

## Constraints

- GitHub only — no Apollo, no Hunter
- Never fabricate emails
- Contacts without public email → log as pending, tell the user
- Be concise — summarise what you did, never dump raw tool output
- Use the user's language if they write in a language other than English`;

// Per-chat conversation history
const histories = new Map<number, Anthropic.MessageParam[]>();

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n');
}

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'find_contacts':    return extractText(await handleFindContacts(input));
    case 'search_contacts':  return extractText(await handleSearchContacts(input));
    case 'send_email':       return extractText(await handleSendEmail(input));
    case 'log_outreach':     return extractText(await handleLogOutreach(input));
    case 'get_outreach_stats': return extractText(await handleGetStats(input));
    case 'enrich_contact':      return extractText(await handleEnrichContact(input));
    case 'research_market':     return extractText(await handleResearchMarket(input));
    case 'find_customers_web':  return extractText(await handleFindCustomersWeb(input));
    default: return `Unknown tool: ${name}`;
  }
}

export async function runAgent(chatId: number, userMessage: string): Promise<string> {
  if (!histories.has(chatId)) histories.set(chatId, []);
  const history = histories.get(chatId)!;

  history.push({ role: 'user', content: userMessage });

  // Agentic loop — keep going until Claude stops using tools
  for (let i = 0; i < 20; i++) {
    const voice = loadFile('voice.txt');
    const humanizer = loadFile('humanizer.md');

    const systemWithVoice = [
      SYSTEM_PROMPT,
      voice ? `---\n\n## Founder's writing voice — match this exactly when drafting emails\n\n${voice}` : '',
      humanizer ? `---\n\n## Humanizer protocol — apply to every email before sending\n\nEvery email draft must pass this checklist. Run it mentally before finalising any email.\n\n${humanizer}` : '',
    ].filter(Boolean).join('\n\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemWithVoice,
      tools: TOOLS,
      messages: history,
    });

    // Add assistant turn to history
    history.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      // Final text response
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('\n');
      return text || '(no response)';
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      // Execute all tool calls and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          let result: string;
          try {
            result = await runTool(block.name, block.input as Record<string, unknown>);
          } catch (err) {
            result = `Error: ${err instanceof Error ? err.message : String(err)}`;
          }
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: result,
          };
        })
      );

      history.push({ role: 'user', content: toolResults });
      continue;
    }

    // Unexpected stop reason
    break;
  }

  return 'Something went wrong — the agent did not finish normally.';
}

export function clearHistory(chatId: number) {
  histories.delete(chatId);
}
