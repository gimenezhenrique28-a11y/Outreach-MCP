import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { findContactsTool, handleFindContacts } from './tools/findContacts.js';
import { searchContactsTool, handleSearchContacts } from './tools/searchContacts.js';
import { sendEmailTool, handleSendEmail } from './tools/sendEmail.js';
import { logOutreachTool, handleLogOutreach } from './tools/logOutreach.js';
import { getStatsTool, handleGetStats } from './tools/getStats.js';
import { enrichContactTool, handleEnrichContact } from './tools/enrichContact.js';
import { researchMarketTool, handleResearchMarket } from './tools/researchMarket.js';
import { findCustomersWebTool, handleFindCustomersWeb } from './tools/findCustomersWeb.js';

const server = new Server(
  {
    name: 'wharf-outreach-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── Tool registry ──────────────────────────────────────────────────────────────

const tools = [
  findContactsTool,
  enrichContactTool,
  researchMarketTool,
  findCustomersWebTool,
  searchContactsTool,
  sendEmailTool,
  logOutreachTool,
  getStatsTool,
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case 'find_contacts':
      return handleFindContacts(args);
    case 'search_contacts':
      return handleSearchContacts(args);
    case 'send_email':
      return handleSendEmail(args);
    case 'log_outreach':
      return handleLogOutreach(args);
    case 'get_outreach_stats':
      return handleGetStats(args);
    case 'enrich_contact':
      return handleEnrichContact(args);
    case 'research_market':
      return handleResearchMarket(args);
    case 'find_customers_web':
      return handleFindCustomersWeb(args);
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// ── Start ──────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Wharf Outreach MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
