import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { supabase, OutreachStatus } from '../lib/supabase.js';

export const logOutreachTool = {
  name: 'log_outreach',
  description: 'Upsert a contact and their outreach status in Supabase. Creates a new record or updates an existing one matched by email.',
  inputSchema: {
    type: 'object' as const,
    required: ['name', 'email', 'status'],
    properties: {
      name: { type: 'string', description: 'Contact full name' },
      email: { type: 'string', description: 'Contact email (used as upsert key)' },
      status: {
        type: 'string',
        enum: ['pending', 'sent', 'replied', 'booked'],
        description: 'Current outreach status',
      },
      company: { type: 'string', description: 'Company name' },
      role: { type: 'string', description: 'Job title or role' },
      linkedin_url: { type: 'string', description: 'LinkedIn profile URL' },
      apollo_id: { type: 'string', description: 'Apollo.io person ID' },
      channel: {
        type: 'string',
        description: 'Outreach channel — e.g. "email", "linkedin" (default: "email")',
      },
      message_sent: { type: 'string', description: 'The outreach message that was sent' },
      notes: { type: 'string', description: 'Any additional notes' },
    },
  },
};

export async function handleLogOutreach(args: Record<string, unknown>) {
  const name = args.name as string;
  const email = args.email as string;
  const status = args.status as OutreachStatus;

  if (!name || !email || !status) {
    throw new McpError(ErrorCode.InvalidParams, 'name, email, and status are required');
  }

  const validStatuses: OutreachStatus[] = ['pending', 'sent', 'replied', 'booked'];
  if (!validStatuses.includes(status)) {
    throw new McpError(ErrorCode.InvalidParams, `status must be one of: ${validStatuses.join(', ')}`);
  }

  try {
    const record = {
      name,
      email,
      status,
      company: (args.company as string | undefined) ?? null,
      role: (args.role as string | undefined) ?? null,
      linkedin_url: (args.linkedin_url as string | undefined) ?? null,
      apollo_id: (args.apollo_id as string | undefined) ?? null,
      channel: (args.channel as string | undefined) ?? 'email',
      message_sent: (args.message_sent as string | undefined) ?? null,
      notes: (args.notes as string | undefined) ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('outreach_contacts')
      .upsert(record, { onConflict: 'email' })
      .select('id, name, email, status, updated_at')
      .single();

    if (error) throw new Error(error.message);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Contact upserted successfully.`,
            `ID:      ${data.id}`,
            `Name:    ${data.name}`,
            `Email:   ${data.email}`,
            `Status:  ${data.status}`,
            `Updated: ${data.updated_at}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new McpError(ErrorCode.InternalError, `Log outreach failed: ${message}`);
  }
}
