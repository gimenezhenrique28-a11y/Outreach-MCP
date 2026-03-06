import { Telegraf, Context } from 'telegraf';
import { runAgent, clearHistory } from './agent.js';

// Run agent detached from Telegraf's middleware timeout.
// Sends a "thinking" message immediately, then edits it when done.
function runDetached(
  ctx: Context,
  chatId: number,
  thinkingMsgId: number,
  userMessage: string
) {
  runAgent(chatId, userMessage)
    .then(async (result) => {
      const text = result.length > 4000 ? result.slice(0, 3997) + '...' : result;
      await ctx.telegram.editMessageText(chatId, thinkingMsgId, undefined, text);
    })
    .catch(async (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.telegram
        .editMessageText(chatId, thinkingMsgId, undefined, `Error: ${msg}`)
        .catch(() => {});
    });
}

export function startBot(token: string, allowedChatId?: number) {
  // Disable Telegraf's built-in handler timeout — our tasks can take several minutes
  const bot = new Telegraf(token, { handlerTimeout: Infinity });

  function isAllowed(ctx: Context): boolean {
    if (!allowedChatId) return true;
    return ctx.chat?.id === allowedChatId;
  }

  bot.start((ctx) => {
    if (!isAllowed(ctx)) return;
    ctx.reply(
      `Hey! I'm your Wharf outreach co-pilot.\n\n` +
      `Just tell me what you need. Examples:\n\n` +
      `"Find 10 seed founders in London and reach out about Wharf beta"\n` +
      `"Find me 5 senior React engineers in Brazil"\n` +
      `"Validate my product thesis against the market"\n` +
      `"Who replied but hasn't booked yet?"\n\n` +
      `Commands:\n` +
      `/stats — pipeline overview\n` +
      `/pending — pending contacts\n` +
      `/replied — replied contacts\n` +
      `/clear — reset conversation memory`
    );
  });

  bot.command('stats', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const thinking = await ctx.reply('Fetching stats...');
    runDetached(ctx, ctx.chat.id, thinking.message_id, 'Show me the outreach stats');
  });

  bot.command('pending', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const thinking = await ctx.reply('Fetching pending contacts...');
    runDetached(ctx, ctx.chat.id, thinking.message_id, 'Show me all contacts with status pending');
  });

  bot.command('replied', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const thinking = await ctx.reply('Fetching replied contacts...');
    runDetached(ctx, ctx.chat.id, thinking.message_id, 'Show me all contacts with status replied');
  });

  bot.command('clear', (ctx) => {
    if (!isAllowed(ctx)) return;
    clearHistory(ctx.chat.id);
    ctx.reply('Conversation memory cleared.');
  });

  // All text messages → agent (detached, no timeout)
  bot.on('text', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const thinking = await ctx.reply('Working on it...');
    runDetached(ctx, ctx.chat.id, thinking.message_id, ctx.message.text);
  });

  bot.launch();
  console.log('Wharf Telegram bot is running...');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
