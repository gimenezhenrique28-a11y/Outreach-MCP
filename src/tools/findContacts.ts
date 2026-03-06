import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { searchGitHubUsers } from '../lib/github.js';

export const findContactsTool = {
  name: 'find_contacts',
  description:
    'Search GitHub for technical prospects (founders, CTOs, engineers). Free, no API key required (optional token for higher rate limits). Returns name, email, company, location, bio.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Keywords to search — e.g. "founder", "CTO", "open source"',
      },
      location: {
        type: 'string',
        description: 'City or country — e.g. "London", "Brazil", "San Francisco"',
      },
      language: {
        type: 'string',
        description: 'Primary programming language — e.g. "python", "typescript", "rust"',
      },
      followers: {
        type: 'number',
        description: 'Minimum follower count — higher = more established (e.g. 100)',
      },
      limit: {
        type: 'number',
        description: 'Max results (default 10, max 30)',
      },
    },
  },
};

export async function handleFindContacts(args: Record<string, unknown>) {
  try {
    const contacts = await searchGitHubUsers({
      query: args.query as string | undefined,
      location: args.location as string | undefined,
      language: args.language as string | undefined,
      followers: typeof args.followers === 'number' ? args.followers : undefined,
      limit: typeof args.limit === 'number' ? args.limit : 10,
    });

    if (contacts.length === 0) {
      return {
        content: [{ type: 'text', text: 'No contacts found matching those criteria.' }],
      };
    }

    const rows = contacts.map((c, i) => {
      const lines = [
        `${i + 1}. ${c.name ?? c.login} (@${c.login})`,
        `   Email:    ${c.email ?? 'not public'}`,
        `   Company:  ${c.company ?? 'N/A'}`,
        `   Location: ${c.location ?? 'N/A'}`,
        `   Bio:      ${c.bio ?? 'N/A'}`,
        `   GitHub:   ${c.github_url}`,
      ];
      if (c.twitter) lines.push(`   Twitter:  @${c.twitter}`);
      if (c.blog) lines.push(`   Website:  ${c.blog}`);
      return lines.join('\n');
    });

    const withEmail = contacts.filter((c) => c.email).length;

    return {
      content: [
        {
          type: 'text',
          text: `Found ${contacts.length} contact(s) (${withEmail} with public email):\n\n${rows.join('\n\n')}`,
        },
      ],
    };
  } catch (err) {
    if (err instanceof McpError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new McpError(ErrorCode.InternalError, `GitHub search failed: ${message}`);
  }
}
