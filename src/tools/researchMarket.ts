import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { braveSearch, SearchResult } from '../lib/search.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export const researchMarketTool = {
  name: 'research_market',
  description:
    'Search the web to validate Wharf\'s product thesis. Researches competitors, market size, customer pain points, and how Wharf compares. Returns a structured analysis.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      focus: {
        type: 'string',
        enum: ['competitors', 'pain_points', 'market_size', 'positioning', 'full'],
        description: '"competitors" — ATS/TRM tools | "pain_points" — what founders/recruiters complain about | "market_size" — TAM/market data | "positioning" — how to differentiate | "full" — all of the above',
      },
      custom_query: {
        type: 'string',
        description: 'Optional custom search query to add to the research',
      },
    },
  },
};

const SEARCHES: Record<string, string[]> = {
  competitors: [
    'best ATS for startups 2024 review',
    'Ashby vs Lever vs Greenhouse startup recruiting',
    'TRM talent relationship manager software startup',
    'alternative to Greenhouse too expensive startup',
    'inbound recruiting tool startup founders',
  ],
  pain_points: [
    'startup founder recruiting pain points candidates spreadsheet',
    'site:reddit.com startup "tracking candidates" OR "lost candidates" OR "spreadsheet hiring"',
    'site:news.ycombinator.com "hiring" "ATS" OR "spreadsheet" startup',
    '"LinkedIn DM" candidate tracking startup hiring problem',
    'startup inbound candidates getting lost hiring',
  ],
  market_size: [
    'ATS applicant tracking system market size 2024',
    'talent relationship management software market growth',
    'startup recruiting software TAM 2024',
    'recruiting software SMB market opportunity',
  ],
  positioning: [
    'inbound first recruiting startup tool',
    'ATS too complex small startup team',
    '"we use spreadsheets" startup hiring candidates',
    'startup hiring tool lightweight alternative ATS',
    'Chrome extension capture candidates LinkedIn',
  ],
};

export async function handleResearchMarket(args: Record<string, unknown>) {
  const focus = (args.focus as string) ?? 'full';
  const customQuery = args.custom_query as string | undefined;

  try {
    const queriesToRun: string[] = focus === 'full'
      ? [
          ...SEARCHES.competitors.slice(0, 2),
          ...SEARCHES.pain_points.slice(0, 2),
          ...SEARCHES.market_size.slice(0, 1),
          ...SEARCHES.positioning.slice(0, 2),
        ]
      : (SEARCHES[focus] ?? SEARCHES.competitors);

    if (customQuery) queriesToRun.push(customQuery);

    // Run searches in parallel
    const empty: SearchResult[] = [];
    const results: SearchResult[][] = await Promise.all(
      queriesToRun.map((q: string) => braveSearch(q, 5).catch(() => empty))
    );

    const flat: SearchResult[] = results.flat();
    const deduplicated: SearchResult[] = flat.filter(
      (r: SearchResult, i: number, arr: SearchResult[]) => arr.findIndex((x: SearchResult) => x.url === r.url) === i
    );

    // Feed to Claude for synthesis
    const searchDump = deduplicated
      .slice(0, 25)
      .map((r: SearchResult) => `[${r.title}]\n${r.url}\n${r.description}`)
      .join('\n\n---\n\n');

    const wharfContext = `Wharf (TalentWharf) is a Talent Relationship Manager for startups. It captures inbound candidate interest (LinkedIn DMs, emails, referrals) into a structured pipeline with AI job matching. Target: seed-to-Series B founders and early recruiters. Chrome extension for one-click capture from LinkedIn/Gmail. Key differentiator: inbound-first vs outbound ATS tools.`;

    const prompt = `You are a product strategist. Based on these web search results, provide a structured market analysis for Wharf.

Product context:
${wharfContext}

Search results:
${searchDump}

Provide analysis as plain text with these sections:
1. COMPETITORS — who's in this space, their positioning, pricing, weaknesses
2. PAIN POINTS — what real users complain about (quote from results where possible)
3. MARKET OPPORTUNITY — size, growth, gaps
4. WHARF'S POSITIONING — where it fits, strongest differentiators vs competition
5. THESIS CHECK — does the market data support or challenge Wharf's core bet? Be honest.
6. GO-TO-MARKET SIGNAL — which customer segments show the most pain right now?

Be specific and direct. Don't pad. If data is missing, say so.`;

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
          text: `Market Research (${focus})\n${'═'.repeat(40)}\n\n${analysis}\n\n${'─'.repeat(40)}\nSources: ${deduplicated.slice(0, 8).map((r: SearchResult) => r.url).join(', ')}`,
        },
      ],
    };
  } catch (err) {
    if (err instanceof McpError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new McpError(ErrorCode.InternalError, `Market research failed: ${message}`);
  }
}
