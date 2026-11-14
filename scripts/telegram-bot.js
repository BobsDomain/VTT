// The Tabletop Telegram bot: feature requests from the group become GitHub issues and a list in docs/REQUESTS.md,
// and it answers "what's new?" and "where do I download it?". Run every few minutes by .github/workflows/telegram-bot.yml
// (no server needed). Set up: docs/TELEGRAM-BOT.md.
//
//   /request <idea>   a feature request (10 characters at least, 3 a day each); one like an open request adds a vote there
//   /requests         the open requests, most votes first
//   /status <n>       where request #n stands
//   /upvote <n>       a vote for request #n
//   /new              what's in the latest release      (also "what's new?")
//   /download         the download links                 (also "where do I download it?")
//   /help             these commands
//
// Environment: TELEGRAM_TOKEN, TELEGRAM_CHAT_ID (the group's id; several with commas), GITHUB_TOKEN, GITHUB_REPOSITORY
// (owner/repo). With no TELEGRAM_CHAT_ID it only prints the chats it sees, to find the id.
const fs = require('fs');
const path = require('path');

const TG = process.env.TELEGRAM_TOKEN, REPO = process.env.GITHUB_REPOSITORY, GH = process.env.GITHUB_TOKEN;
const CHATS = String(process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
const LABEL = 'feature-request', PLANNED = 'planned', DONE = 'done';
const PER_DAY = 3, MIN_LEN = 10;
const REQUESTS_FILE = path.join(__dirname, '..', 'docs', 'REQUESTS.md');

if (!TG) { console.error('TELEGRAM_TOKEN is not set'); process.exit(1); }

// ----- Telegram and GitHub -----
async function tg(method, body = {}) {
  const r = await fetch(`https://api.telegram.org/bot${TG}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json(); if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`); return j.result;
}
async function gh(method, url, body) {
  const r = await fetch(`https://api.github.com${url}`, { method, headers: { Authorization: `Bearer ${GH}`, Accept: 'application/vnd.github+json', 'User-Agent': 'tabletop-bot', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 404 && method === 'GET') return null;
  if (!r.ok) throw new Error(`GitHub ${method} ${url}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reply = (m, html) => tg('sendMessage', { chat_id: m.chat.id, text: html, parse_mode: 'HTML', disable_web_page_preview: true, reply_to_message_id: m.message_id, allow_sending_without_reply: true }).catch((e) => console.error(e.message));
const who = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'someone';

// ----- requests, kept as GitHub issues -----
// the issue body carries the votes and who asked, in lines the bot reads back
const meta = (body) => {
  const m = /<!-- tabletop-bot (\{.*?\}) -->/s.exec(body || ''); try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
};
const bodyFor = (text, asker, data) => `${text}\n\n---\nRequested in Telegram by **${asker}** · Votes: ${data.voters.length}\n\n<!-- tabletop-bot ${JSON.stringify(data)} -->`;
let issueCache = null;
async function requests(state = 'all') {
  if (!issueCache) {
    issueCache = [];
    for (let page = 1; page <= 5; page++) {
      const list = await gh('GET', `/repos/${REPO}/issues?labels=${LABEL}&state=all&per_page=100&page=${page}`) || [];
      issueCache.push(...list.filter((i) => !i.pull_request)); if (list.length < 100) break;
    }
  }
  return issueCache.filter((i) => state === 'all' || i.state === state);
}
const STOP = new Set('the a an and or to of for in on at with be can could would should please add make let have has it its this that from by as is are we you our your into more some when like also just way get able there their them then than'.split(' '));
const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(ing|es|s)$/, '')));
function similar(text, list) {
  const a = words(text); let best = null, score = 0;
  for (const i of list) {
    const b = words(i.title + ' ' + (i.body || '').split('\n---\n')[0]), common = [...a].filter((w) => b.has(w)).length;
    const s = common / Math.max(1, Math.min(a.size, b.size));
    if (common >= 2 && s >= 0.6 && s > score) { best = i; score = s; }
  }
  return best;
}
const statusOf = (i) => (i.state === 'closed' ? (i.labels.some((l) => l.name === DONE) || i.state_reason === 'completed' ? '✅ Done' : '✖ Closed') : i.labels.some((l) => l.name === PLANNED) ? '📅 Planned' : '💡 Requested');
async function vote(i, u) {
  const d = meta(i.body) || { voters: [] };
  if (d.voters.includes(u.id)) return false;
  d.voters.push(u.id);
  const updated = await gh('PATCH', `/repos/${REPO}/issues/${i.number}`, { body: (i.body || '').replace(/Votes: \d+/, `Votes: ${d.voters.length}`).replace(/<!-- tabletop-bot .*? -->/s, `<!-- tabletop-bot ${JSON.stringify(d)} -->`) });
  Object.assign(i, { body: updated.body });
  return true;
}

async function onRequest(m, text) {
  const u = m.from;
  if (text.length < MIN_LEN) return reply(m, `Tell me a bit more: <code>/request</code> and the idea, at least ${MIN_LEN} characters. For example <i>/request Let players draw on the map</i>`);
  const all = await requests();
  const tag = `${m.chat.id}:${m.message_id}`;
  if (all.some((i) => (meta(i.body) || {}).msg === tag)) return; // already done on an earlier run
  const today = new Date().toISOString().slice(0, 10);
  const mineToday = all.filter((i) => (meta(i.body) || {}).user === u.id && i.created_at.slice(0, 10) === today).length;
  if (mineToday >= PER_DAY) return reply(m, `That's ${PER_DAY} requests from you today, thanks! Send the next one tomorrow.`);
  const dup = similar(text, all.filter((i) => i.state === 'open'));
  if (dup) {
    const added = await vote(dup, u);
    return reply(m, `That looks like <a href="${dup.html_url}">#${dup.number}: ${esc(dup.title)}</a> (${statusOf(dup)}). ${added ? 'I added your vote to it.' : 'You already voted for it.'} If it's different, add more detail and send it again.`);
  }
  const title = (text.charAt(0).toUpperCase() + text.slice(1)).replace(/\s+/g, ' ').slice(0, 90);
  const issue = await gh('POST', `/repos/${REPO}/issues`, { title, labels: [LABEL], body: bodyFor(text, who(u) + (u.username ? ` (@${u.username})` : ''), { user: u.id, msg: tag, voters: [u.id] }) });
  issueCache.push(issue);
  return reply(m, `Thanks ${esc(u.first_name || '')}! Added as <a href="${issue.html_url}">#${issue.number}</a>. It's on the requests list now, and others can vote with <code>/upvote ${issue.number}</code>.`);
}
async function onList(m) {
  const open = (await requests('open')).map((i) => ({ i, v: (meta(i.body) || { voters: [] }).voters.length })).sort((a, b) => b.v - a.v).slice(0, 12);
  if (!open.length) return reply(m, 'No open requests yet. Send one with <code>/request</code> and your idea.');
  return reply(m, `<b>Open requests</b>\n` + open.map(({ i, v }) => `#${i.number} ${esc(i.title)} · ${v} vote${v === 1 ? '' : 's'} · ${statusOf(i)}`).join('\n') + `\n\nVote with <code>/upvote 12</code>. Full list: https://github.com/${REPO}/blob/HEAD/docs/REQUESTS.md`);
}
async function onStatus(m, n, up) {
  const i = (await requests()).find((x) => x.number === n);
  if (!i) return reply(m, `There's no request #${n || '?'}. <code>/requests</code> lists them.`);
  if (up) { if (i.state !== 'open') return reply(m, `#${n} is ${statusOf(i).toLowerCase()} already.`); return reply(m, (await vote(i, m.from)) ? `Vote added to #${n}: ${esc(i.title)}` : `You already voted for #${n}.`); }
  const v = (meta(i.body) || { voters: [] }).voters.length;
  return reply(m, `<a href="${i.html_url}">#${i.number}: ${esc(i.title)}</a>\n${statusOf(i)} · ${v} vote${v === 1 ? '' : 's'}`);
}

// ----- releases: what's new, and the downloads -----
let latest;
const release = async () => (latest !== undefined ? latest : (latest = await gh('GET', `/repos/${REPO}/releases/latest`)));
async function onNew(m) {
  const r = await release(); if (!r) return reply(m, 'No release yet.');
  // the headline of each change: "- **Summons in the initiative order**, for…" → Summons in the initiative order
  const lines = String(r.body || '').split('## Download')[0].split('\n').filter((l) => /^- /.test(l)).map((l) => (/\*\*(.+?)\*\*/.exec(l) || [, l.slice(2)])[1].replace(/[*`]/g, '').replace(/[:.]$/, '')).slice(0, 10);
  return reply(m, `<b>${esc(r.name || r.tag_name)}</b> (${r.published_at.slice(0, 10)})\n` + lines.map((l) => '• ' + esc(l)).join('\n') + `\n\nEverything that changed: ${r.html_url}`);
}
async function onDownload(m) {
  const r = await release(); if (!r) return reply(m, `No release yet: https://github.com/${REPO}/releases`);
  const a = (re) => (r.assets || []).find((x) => re.test(x.name));
  const pl = a(/^Tabletop-Player-Setup-.*\.exe$/), dm = a(/^Tabletop-DM-Setup-.*\.exe$/), pg = a(/^Tabletop-Player-Guide\.pdf$/);
  return reply(m, `<b>Tabletop ${esc(r.tag_name.replace(/^v/, ''))}</b> for Windows\n` +
    (pl ? `🎲 Players: <a href="${pl.browser_download_url}">Tabletop Player installer</a>\n` : '') +
    (dm ? `🐉 The DM: <a href="${dm.browser_download_url}">Tabletop DM installer</a>\n` : '') +
    (pg ? `📖 <a href="${pg.browser_download_url}">Player guide (PDF)</a>\n` : '') +
    `\nAll files, and the no-install zips: ${r.html_url}\nFirst run: click <b>More info → Run anyway</b> if Windows asks.`);
}
const HELP = '<b>Tabletop bot</b>\n/request <i>your idea</i>: ask for a feature\n/requests: what\'s been asked\n/upvote <i>12</i>: vote for #12\n/status <i>12</i>: where #12 stands\n/new: what\'s in the latest version\n/download: where to get the apps';

// ----- the requests list in the repo: docs/REQUESTS.md -----
async function writeList() {
  const all = await requests(); if (!all.length && !fs.existsSync(REQUESTS_FILE)) return;
  const rank = (i) => ({ '📅 Planned': 0, '💡 Requested': 1, '✅ Done': 2, '✖ Closed': 3 })[statusOf(i)];
  const rows = all.filter((i) => i.state === 'open' || i.state_reason === 'completed').map((i) => ({ i, v: (meta(i.body) || { voters: [] }).voters.length }))
    .sort((a, b) => rank(a.i) - rank(b.i) || b.v - a.v || a.i.number - b.i.number);
  const md = `# Requests from the group\n\nFeature requests sent to the Tabletop Telegram bot (\`/request\`). The bot keeps this list up to date; the [roadmap](ROADMAP.md) says what's planned. Vote in the group with \`/upvote <number>\`.\n\n` +
    (rows.length ? `| # | Request | Votes | Status |\n| --- | --- | --- | --- |\n` + rows.map(({ i, v }) => `| [#${i.number}](${i.html_url}) | ${i.title.replace(/\|/g, '/')} | ${v} | ${statusOf(i)} |`).join('\n') + '\n' : 'None yet.\n');
  const old = fs.existsSync(REQUESTS_FILE) ? fs.readFileSync(REQUESTS_FILE, 'utf8') : '';
  if (old !== md) { fs.writeFileSync(REQUESTS_FILE, md); console.log('docs/REQUESTS.md updated'); }
}

// ----- one run: read what's new in Telegram, answer it, update the list -----
async function allowed(m) {
  if (CHATS.includes(String(m.chat.id))) return true;
  if (m.chat.type !== 'private') return false;
  // a private message: fine from anyone in the group
  for (const c of CHATS) { try { const s = await tg('getChatMember', { chat_id: c, user_id: m.from.id }); if (['creator', 'administrator', 'member', 'restricted'].includes(s.status)) return true; } catch { /* not there */ } }
  return false;
}
(async () => {
  await tg('deleteWebhook').catch(() => {});
  const me = await tg('getMe');
  if (GH) await gh('POST', `/repos/${REPO}/labels`, { name: LABEL, color: 'a855f7', description: 'Asked for in the Telegram group' }).catch(() => {});
  const updates = await tg('getUpdates', { timeout: 0, allowed_updates: ['message'] });
  for (const up of updates) {
    const m = up.message; if (!m || !m.text || !m.from || m.from.is_bot) continue;
    if (!CHATS.length) { console.log(`Message in chat ${m.chat.id} (${m.chat.title || m.chat.type}) from ${who(m.from)}`); continue; }
    if (!(await allowed(m))) continue;
    const t = m.text.trim(), cmd = /^\/(\w+)(?:@(\w+))?\s*([\s\S]*)$/.exec(t);
    try {
      if (cmd && (!cmd[2] || cmd[2].toLowerCase() === me.username.toLowerCase())) {
        const [, c, , rest] = cmd, n = parseInt((rest.match(/\d+/) || [])[0], 10);
        if (c === 'request' || c === 'idea') await onRequest(m, rest.trim());
        else if (c === 'requests' || c === 'ideas') await onList(m);
        else if (c === 'status') await onStatus(m, n, false);
        else if (c === 'upvote' || c === 'vote') await onStatus(m, n, true);
        else if (c === 'new' || c === 'whatsnew' || c === 'changes') await onNew(m);
        else if (c === 'download' || c === 'downloads' || c === 'get') await onDownload(m);
        else if (c === 'help' || c === 'start') await reply(m, HELP);
        continue;
      }
      // plain questions: only when they're asked of the bot (a mention, a reply to it, a private chat, or a question mark)
      const toMe = m.chat.type === 'private' || (m.reply_to_message && m.reply_to_message.from && m.reply_to_message.from.id === me.id) || t.toLowerCase().includes('@' + me.username.toLowerCase()) || /\?\s*$/.test(t);
      if (!toMe) continue;
      if (/what'?s new|whats new|what is new|new (?:version|release|update)|latest (?:version|release|update)|changelog/i.test(t)) await onNew(m);
      else if (/download|install(?:er)?\b|where (?:do|can) (?:i|we) get|link (?:to|for) (?:the )?app/i.test(t)) await onDownload(m);
      else if (m.chat.type === 'private') await reply(m, HELP);
    } catch (e) { console.error(e.message); await reply(m, 'Something went wrong on my side; try again in a few minutes.'); }
  }
  // tell Telegram these are handled, so the next run doesn't see them again
  if (updates.length) await tg('getUpdates', { offset: updates[updates.length - 1].update_id + 1, timeout: 0, limit: 1 });
  if (GH && CHATS.length) await writeList();
  console.log(`${updates.length} update(s) handled`);
})().catch((e) => { console.error(e); process.exit(1); });
