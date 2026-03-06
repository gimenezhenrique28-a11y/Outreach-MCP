import 'dotenv/config';
import { startBot } from './bot/telegram.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN must be set in .env');
  process.exit(1);
}

// Optional: restrict bot to your own chat ID so nobody else can use it
const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID
  ? parseInt(process.env.TELEGRAM_ALLOWED_CHAT_ID, 10)
  : undefined;

startBot(token, allowedChatId);
