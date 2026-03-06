import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { supabase } from '../lib/supabase.js';

export const getStatsTool = {
  name: 'get_outreach_stats',
  description: 'Return a summary of outreach contacts grouped by status (pending, sent, replied, booked).',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

export async function handleGetStats(_args: Record<string, unknown>) {
  try {
    const statuses = ['pending', 'sent', 'replied', 'booked'] as const;

    const counts = await Promise.all(
      statuses.map(async (status) => {
        const { count, error } = await supabase
          .from('outreach_contacts')
          .select('*', { count: 'exact', head: true })
          .eq('status', status);

        if (error) throw new Error(`Failed to count "${status}": ${error.message}`);
        return { status, count: count ?? 0 };
      })
    );

    const total = counts.reduce((sum, r) => sum + r.count, 0);

    const lines = counts.map(({ status, count }) => {
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      const bar = '█'.repeat(Math.round((count / Math.max(total, 1)) * 20));
      return `  ${status.padEnd(10)} ${String(count).padStart(4)}  ${pct.padStart(5)}%  ${bar}`;
    });

    return {
      content: [
        {
          type: 'text',
          text: [
            'Outreach Stats',
            '══════════════════════════════════════════',
            `  ${'Status'.padEnd(10)} ${'Count'.padStart(4)}  ${'Pct'.padStart(6)}  Chart`,
            '──────────────────────────────────────────',
            ...lines,
            '──────────────────────────────────────────',
            `  ${'TOTAL'.padEnd(10)} ${String(total).padStart(4)}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new McpError(ErrorCode.InternalError, `Get stats failed: ${message}`);
  }
}
