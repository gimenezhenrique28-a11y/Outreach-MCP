import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { braveSearch } from '../lib/search.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export const findCustomersWebTool = {
  name: 'find_customers_web',
  description:
    'Search the web to find real potential Wharf customers — startup founders actively hiring, recruiters frustrated with current tools, recently funded teams building out talent functions. Returns named individuals and companies to target.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      segment: {
        type: 'string',
        enum: ['founders_hiring', 'early_recruiters', 'funded_startups', 'ats_frustrated', 'all'],
        description: '"founders_hiring" — founders actively looking for talent | "early_recruiters" — first recruiter hires at startups | "funded_startups" — recently funded teams who need to hire | "ats_frustrated" — people complaining about current tools | "all" — all segments',
      },
      location: {
        type: 'string',
        description: 'Optional location filter — e.g. "London", "Brazil", "New York"',
      },
      industry: {
        type: 'string',
        description: 'Optional industry filter — e.g. "fintech", "SaaS", "developer tools"',
      },
    },
  },
};

function buildQueries(segment: string, location?: string, industry?: string): string[] {
  const loc = location ? ` ${location}` : '';
  const ind = industry ? ` ${industry}` : '';

  const queries: Record<string, string[]> = {
    founders_hiring: [
      `startup "seed" OR "series a"${loc}${ind} "we're hiring" founder "20" OR "30" OR "40" OR "50" employees 2024`,
      `site:twitter.com OR site:x.com "we're hiring" "team of" founder startup "seed" OR "series a"${loc}`,
      `"small but mighty team" OR "team of 20" OR "team of 30" OR "team of 50" startup hiring${loc}${ind}`,
      `site:news.ycombinator.com "who is hiring" "seed" OR "series a" 2024${loc}`,
    ],
    early_recruiters: [
      `"head of talent" OR "first recruiter" OR "head of people" startup "seed" OR "series a"${loc}${ind} 2024`,
      `"our first recruiter" OR "first in-house recruiter" startup${loc}${ind}`,
      `"talent lead" startup "20 people" OR "30 people" OR "50 people"${loc}${ind}`,
    ],
    funded_startups: [
      `startup${loc}${ind} "seed round" OR "series a" 2024 hiring "growing team" 20 50 employees`,
      `site:techcrunch.com startup "seed" OR "series a" funding 2024${loc}${ind} hiring`,
      `"raised seed" OR "raised series a" startup${loc}${ind} hiring engineers 2024`,
      `startup${loc}${ind} "20 employees" OR "30 employees" OR "50 employees" hiring 2024`,
    ],
    ats_frustrated: [
      `site:reddit.com startup "tracking candidates" "spreadsheet" OR "notion" OR "airtable" small team`,
      `"Greenhouse" OR "Lever" OR "Workable" "too expensive" OR "overkill" startup "small team" OR "seed" OR "series a"`,
      `site:twitter.com "spreadsheet" candidates hiring startup "20 people" OR "small team"`,
      `startup founder "candidate" lost "DMs" OR "inbox" OR "LinkedIn" tracking problem`,
      `"we use spreadsheets" OR "google sheets" candidates startup hiring small team`,
    ],
  };

  if (segment === 'all') {
    return [
      ...queries.founders_hiring.slice(0, 1),
      ...queries.early_recruiters.slice(0, 1),
      ...queries.funded_startups.slice(0, 2),
      ...queries.ats_frustrated.slice(0, 2),
    ];
  }

  return queries[segment] ?? queries.founders_hiring;
}

export async function handleFindCustomersWeb(args: Record<string, unknown>) {
  const segment = (args.segment as string) ?? 'all';
  const location = args.location as string | undefined;
  const industry = args.industry as string | undefined;

  try {
    const queries = buildQueries(segment, location, industry);

    const results = await Promise.all(
      queries.map(q => braveSearch(q, 6).catch(() => []))
    );

    const flat = results.flat();
    const deduplicated = flat.filter((r, i, arr) => arr.findIndex(x => x.url === r.url) === i);

    if (deduplicated.length === 0) {
      return {
        content: [{ type: 'text', text: 'No results found. Try a different segment or location.' }],
      };
    }

    const searchDump = deduplicated
      .slice(0, 30)
      .map(r => `TITLE: ${r.title}\nURL: ${r.url}\nSNIPPET: ${r.description}`)
      .join('\n\n---\n\n');

    const prompt = `You are a sales researcher. Extract potential customers for Wharf from these search results.

Wharf is a Talent Relationship Manager for startups — it captures inbound candidates (LinkedIn DMs, emails, referrals) into a structured pipeline with AI job matching. Target users: seed-to-Series B founders wearing the recruiting hat, first in-house recruiters, heads of talent at fast-growing startups.

Search results:
${searchDump}

Extract and return:

## Named individuals to reach out to
For each person found, provide:
- Name (if visible)
- Role / company
- Why they're a fit for Wharf
- Where you found them (URL)
- Suggested outreach angle (1 sentence)

## Companies to target
List startups or teams that show clear hiring activity or pain — company name, rough stage, why relevant.

## Pain point quotes
Pull any direct quotes from the results where someone describes a real recruiting/candidate-tracking problem. These are gold for positioning.

## Outreach angle
Based on what you found, what's the most compelling way to approach this segment right now?

Be specific. If results don't contain named people, say so and focus on companies and pain points instead.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const analysis = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('');

    return {
      content: [
        {
          type: 'text',
          text: `Customer Discovery — ${segment}${location ? ` / ${location}` : ''}${industry ? ` / ${industry}` : ''}\n${'═'.repeat(50)}\n\n${analysis}`,
        },
      ],
    };
  } catch (err) {
    if (err instanceof McpError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new McpError(ErrorCode.InternalError, `Customer web search failed: ${message}`);
  }
}
