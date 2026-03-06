import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getFullProfile } from '../lib/github.js';
import { enrichProfile } from '../lib/enrichment.js';

export const enrichContactTool = {
  name: 'enrich_contact',
  description:
    'Deeply analyze a GitHub user with Claude AI for Wharf outreach. Returns estimated role, tech stack, seniority, candidate score (fit as a hire), beta user score (fit as a Wharf beta user — startup founder/recruiter), personalized talking points, and a suggested email subject + opener.',
  inputSchema: {
    type: 'object' as const,
    required: ['github_username'],
    properties: {
      github_username: {
        type: 'string',
        description: 'GitHub login — e.g. "torvalds"',
      },
      outreach_goal: {
        type: 'string',
        enum: ['candidate', 'beta_user', 'both'],
        description: '"candidate" = evaluate as a potential hire | "beta_user" = evaluate as a Wharf beta user (founder/recruiter) | "both" = score both dimensions (default)',
      },
    },
  },
};

export async function handleEnrichContact(args: Record<string, unknown>) {
  const username = args.github_username as string;
  if (!username) throw new McpError(ErrorCode.InvalidParams, 'github_username is required');

  const goal = (args.outreach_goal as 'candidate' | 'beta_user' | 'both') ?? 'both';

  try {
    const profile = await getFullProfile(username);
    const e = await enrichProfile(profile, goal);

    const candidateBar = '█'.repeat(e.candidate_score) + '░'.repeat(10 - e.candidate_score);
    const betaBar      = '█'.repeat(e.beta_user_score) + '░'.repeat(10 - e.beta_user_score);
    const icpBadge     = e.passes_icp ? '✓ PASSES ICP' : '✗ FAILS ICP';

    const lines = [
      `${profile.name ?? username} (@${username})`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Role:          ${e.estimated_role}`,
      `Seniority:     ${e.seniority}`,
      `Work type:     ${e.work_type}`,
      `Company type:  ${e.company_type}`,
      `Company size:  ${e.company_size} employees`,
      `Funding stage: ${e.funding_stage}`,
      `Tech stack:    ${e.tech_stack.join(', ') || 'N/A'}`,
      `Email:         ${e.email ?? 'not public'}`,
      `GitHub:        ${e.github_url}`,
      ``,
      `ICP Filter: ${icpBadge}`,
      `  → ${e.icp_reason}`,
      ``,
      `Candidate fit:  ${e.candidate_score}/10  ${candidateBar}`,
      `Beta user fit:  ${e.beta_user_score}/10  ${betaBar}`,
      ``,
      `Why: ${e.relevance_reason}`,
      ``,
      `Talking points:`,
      ...e.talking_points.map(p => `  • ${p}`),
      ``,
      `Suggested subject: "${e.suggested_subject}"`,
      `Suggested opener:  "${e.suggested_opener}"`,
    ];

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (err) {
    if (err instanceof McpError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new McpError(ErrorCode.InternalError, `Enrich contact failed: ${message}`);
  }
}
