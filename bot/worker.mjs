// The Tabletop bot on Cloudflare Workers: Telegram sends each message here (a webhook) and the bot answers at once.
// Set up: docs/TELEGRAM-BOT.md. Paste bot/worker.js (this file with core.mjs folded in, made by bot/build.mjs) into the
// Worker. Settings it needs (Worker → Settings → Variables and Secrets):
//   TELEGRAM_TOKEN (secret)     the token from @BotFather
//   GITHUB_TOKEN (secret)       a fine-grained GitHub token: the VTT repository, Issues read and write, Contents read
//   WEBHOOK_SECRET (secret)     any long random word; Telegram sends it with every message so strangers can't
//   TELEGRAM_CHAT_ID (text)     the group's id, e.g. -944196680
//   GITHUB_REPOSITORY (text)    CPSDomain/VTT
// Then open https://<your worker>.workers.dev/setup?key=<WEBHOOK_SECRET> once: it points Telegram at the Worker.
import { createBot } from './core.mjs';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const bot = () => createBot({ telegramToken: env.TELEGRAM_TOKEN, githubToken: env.GITHUB_TOKEN, repo: env.GITHUB_REPOSITORY || 'CPSDomain/VTT', chats: env.TELEGRAM_CHAT_ID });
    // one-time setup: Telegram sends messages here from now on, and the command list shows in the chat's menu
    if (req.method === 'GET' && url.pathname === '/setup') {
      if (!env.WEBHOOK_SECRET || url.searchParams.get('key') !== env.WEBHOOK_SECRET) return new Response('Add ?key= with your WEBHOOK_SECRET', { status: 403 });
      const b = bot(), out = [];
      try {
        await b.tg('setWebhook', { url: `${url.origin}/telegram`, secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message'], drop_pending_updates: false });
        out.push('✔ Telegram now sends messages to this Worker');
        await b.tg('setMyCommands', { commands: [
          { command: 'request', description: 'Ask for a feature' }, { command: 'requests', description: "What's been asked" },
          { command: 'upvote', description: 'Vote for a request (its number)' }, { command: 'status', description: 'Where a request stands (its number)' },
          { command: 'new', description: "What's in the latest version" }, { command: 'download', description: 'Where to get the apps' }, { command: 'help', description: 'What I can do' }] });
        out.push('✔ Command list set');
        await b.requestsMarkdown(); await b.ensureLabel(); out.push('✔ GitHub reached with GITHUB_TOKEN');
        const info = await b.tg('getWebhookInfo'); out.push(`Webhook: ${info.url} · waiting: ${info.pending_update_count}${info.last_error_message ? ' · last error: ' + info.last_error_message : ''}`);
        if (!env.TELEGRAM_CHAT_ID) out.push('⚠ TELEGRAM_CHAT_ID is not set: the bot will ignore every chat');
      } catch (e) { out.push('✖ ' + e.message); }
      return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    if (req.method === 'POST' && url.pathname === '/telegram') {
      if (!env.WEBHOOK_SECRET || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return new Response('Forbidden', { status: 403 });
      const update = await req.json().catch(() => null);
      ctx.waitUntil(bot().handle(update).catch((e) => console.error(e))); // answer Telegram straight away, work after
      return new Response('ok');
    }
    return new Response('The Tabletop bot is running.', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
};
