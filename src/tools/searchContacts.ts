import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { supabase, OutreachStatus } from '../lib/supabase.js';

export const searchContactsTool = {
  name: 'search_contacts',
  description: 'Query the Supabase outreach_contacts table. Filter by status, role, and/or company.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'sent', 'replied', 'booked'],
        description: 'Filter by outreach status',
      },
      role: {
        type: 'string',
        description: 'Partial match on role/title — e.g. "CTO"',
      },
      company: {
        type: 'string',
        description: 'Partial match on company name',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 20)',
      },
    },
  },
};

export async function handleSearchContacts(args: Record<string, unknown>) {
  try {
    let query = supabase
      .from('outreach_contacts')
      .select('id, name, email, company, role, status, channel, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(typeof args.limit === 'number' ? args.limit : 20);

    if (args.status) {
      query = query.eq('status', args.status as OutreachStatus);
    }
    if (args.role) {
      query = query.ilike('role', `%${args.role}%`);
    }
    if (args.company) {
      query = query.ilike('company', `%${args.company}%`);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      return {
        content: [{ type: 'text', text: 'No contacts found matching those filters.' }],
      };
    }

    const rows = data.map((c, i) =>
      [
        `${i + 1}. ${c.name} <${c.email}>`,
        `   Company: ${c.company ?? 'N/A'}  |  Role: ${c.role ?? 'N/A'}`,
        `   Status: ${c.status}  |  Channel: ${c.channel ?? 'email'}`,
        `   Updated: ${c.updated_at}`,
        `   ID: ${c.id}`,
      ].join('\n')
    );

    return {
      content: [
        {
          type: 'text',
          text: `Found ${data.length} contact(s):\n\n${rows.join('\n\n')}`,
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new McpError(ErrorCode.InternalError, `Search contacts failed: ${message}`);
  }
}
