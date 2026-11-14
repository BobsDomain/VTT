// The bot's GitHub side, run by .github/workflows/telegram-bot.yml:
//  • keeps docs/REQUESTS.md up to date (when a request issue changes, and on the schedule)
//  • backup: while no Cloudflare Worker is set up, reads the group every few minutes and answers (slower)
// Environment: TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, GITHUB_TOKEN, GITHUB_REPOSITORY. With no TELEGRAM_CHAT_ID it only
// prints the chats it sees, to find the id.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBot } from './core.mjs';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'REQUESTS.md');
const bot = createBot({ telegramToken: process.env.TELEGRAM_TOKEN, githubToken: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_REPOSITORY, chats: process.env.TELEGRAM_CHAT_ID });
const listOnly = process.argv.includes('--list');

if (!listOnly && process.env.TELEGRAM_TOKEN) {
  const hook = await bot.tg('getWebhookInfo');
  if (hook.url) console.log(`The Cloudflare Worker answers the group (${hook.url}); nothing to read here.`);
  else {
    const updates = await bot.tg('getUpdates', { timeout: 0, allowed_updates: ['message'] });
    for (const u of updates) await bot.handle(u);
    // tell Telegram these are handled, so the next run doesn't see them again
    if (updates.length) await bot.tg('getUpdates', { offset: updates[updates.length - 1].update_id + 1, timeout: 0, limit: 1 });
    console.log(`${updates.length} message(s) handled`);
  }
}
if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
  await bot.ensureLabel();
  const md = await bot.requestsMarkdown(), old = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
  if (md !== old && (old || !/None yet/.test(md))) { fs.writeFileSync(FILE, md); console.log('docs/REQUESTS.md updated'); }
}
