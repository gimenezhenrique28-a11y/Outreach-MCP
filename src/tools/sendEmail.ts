import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { sendGmailMessage } from '../lib/gmail.js';
import { supabase } from '../lib/supabase.js';

export const sendEmailTool = {
  name: 'send_email',
  description: 'Send an email via Gmail OAuth2 and optionally update the contact status in Supabase.',
  inputSchema: {
    type: 'object' as const,
    required: ['to', 'subject', 'body'],
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address',
      },
      subject: {
        type: 'string',
        description: 'Email subject line',
      },
      body: {
        type: 'string',
        description: 'Plain-text email body',
      },
      contact_id: {
        type: 'string',
        description: 'Supabase contact UUID — if provided, status is set to "sent" and message is logged',
      },
    },
  },
};

export async function handleSendEmail(args: Record<string, unknown>) {
  const to = args.to as string;
  const subject = args.subject as string;
  const body = args.body as string;
  const contactId = args.contact_id as string | undefined;

  if (!to || !subject || !body) {
    throw new McpError(ErrorCode.InvalidParams, 'to, subject, and body are required');
  }

  try {
    const messageId = await sendGmailMessage(to, subject, body);

    let dbNote = '';
    if (contactId) {
      const { error } = await supabase
        .from('outreach_contacts')
        .update({
          status: 'sent',
          message_sent: body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);

      if (error) {
        dbNote = `\nWarning: email sent but failed to update contact status: ${error.message}`;
      } else {
        dbNote = '\nContact status updated to "sent" in Supabase.';
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Email sent successfully.\nGmail message ID: ${messageId}\nTo: ${to}\nSubject: ${subject}${dbNote}`,
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new McpError(ErrorCode.InternalError, `Send email failed: ${message}`);
  }
}
