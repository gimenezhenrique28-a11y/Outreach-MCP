import Anthropic from '@anthropic-ai/sdk';

// Tool definitions in Anthropic format — mirrors the MCP tool schemas
export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'find_contacts',
    description:
      'Search GitHub for technical prospects (founders, CTOs, engineers). Free with no API key needed. Returns name, email, company, location, bio.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords — e.g. "founder", "CTO", "open source"' },
        location: { type: 'string', description: 'City or country — e.g. "London", "Brazil"' },
        language: { type: 'string', description: 'Primary programming language — e.g. "python", "typescript"' },
        followers: { type: 'number', description: 'Minimum followers (e.g. 100 for established people)' },
        limit: { type: 'number', description: 'Max results (default 10, max 30)' },
      },
    },
  },
  {
    name: 'search_contacts',
    description: 'Query Supabase outreach_contacts by status, role, and/or company.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'sent', 'replied', 'booked'] },
        role: { type: 'string', description: 'Partial match on role/title' },
        company: { type: 'string', description: 'Partial match on company name' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'send_email',
    description:
      'Send an email via Gmail OAuth2. Pass contact_id to auto-update status to "sent" and log the message.',
    input_schema: {
      type: 'object',
      required: ['to', 'subject', 'body'],
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Plain-text email body' },
        contact_id: { type: 'string', description: 'Supabase contact UUID — triggers auto status update' },
      },
    },
  },
  {
    name: 'log_outreach',
    description: 'Upsert a contact + status in Supabase. Creates or updates by email.',
    input_schema: {
      type: 'object',
      required: ['name', 'email', 'status'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'sent', 'replied', 'booked'] },
        company: { type: 'string' },
        role: { type: 'string' },
        linkedin_url: { type: 'string' },
        apollo_id: { type: 'string' },
        channel: { type: 'string' },
        message_sent: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  },
  {
    name: 'enrich_contact',
    description:
      'Deeply analyze a GitHub user with Claude AI for Wharf outreach. Returns role, tech stack, seniority, candidate_score (fit as a hire), beta_user_score (fit as a Wharf beta user — startup founder/recruiter/talent lead), talking points specific to their work, and a suggested email subject + opener. Always run this before sending outreach.',
    input_schema: {
      type: 'object',
      required: ['github_username'],
      properties: {
        github_username: { type: 'string', description: 'GitHub login — e.g. "torvalds"' },
        outreach_goal: {
          type: 'string',
          enum: ['candidate', 'beta_user', 'both'],
          description: '"beta_user" = score as potential Wharf user (founder/recruiter) | "candidate" = score as potential hire | "both" = score both (default)',
        },
      },
    },
  },
  {
    name: 'research_market',
    description: 'Search the web to validate Wharf\'s product thesis. Researches competitors, market size, real customer pain points, and how Wharf compares. Returns a structured analysis with thesis check.',
    input_schema: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          enum: ['competitors', 'pain_points', 'market_size', 'positioning', 'full'],
          description: '"competitors" | "pain_points" | "market_size" | "positioning" | "full" (default: full)',
        },
        custom_query: { type: 'string', description: 'Optional extra search query to include' },
      },
    },
  },
  {
    name: 'find_customers_web',
    description: 'Search the web for real potential Wharf customers — founders actively hiring, recruiters frustrated with ATS tools, recently funded startups. Returns named individuals, companies, and pain point quotes.',
    input_schema: {
      type: 'object',
      properties: {
        segment: {
          type: 'string',
          enum: ['founders_hiring', 'early_recruiters', 'funded_startups', 'ats_frustrated', 'all'],
          description: '"founders_hiring" | "early_recruiters" | "funded_startups" | "ats_frustrated" | "all"',
        },
        location: { type: 'string', description: 'Optional location — e.g. "London", "Brazil"' },
        industry: { type: 'string', description: 'Optional industry — e.g. "fintech", "SaaS"' },
      },
    },
  },
  {
    name: 'get_outreach_stats',
    description: 'Return counts by outreach status: pending, sent, replied, booked.',
    input_schema: { type: 'object', properties: {} },
  },
];
