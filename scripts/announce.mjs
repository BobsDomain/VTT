// Tells the Telegram group (and the channel, if set) about a new release: the headlines from CHANGELOG.md, the
// requests it closes, and the download links. Run by the release workflow after the release is published.
// Environment: TELEGRAM_TOKEN (secret), TELEGRAM_CHAT_ID (the group) and, optionally, TELEGRAM_ANNOUNCE_CHAT_ID
// (where to post instead: a channel like @yourchannel or -100…, or several separated by commas). The bot must be
// in the group, and an admin of a channel, to post there.
import fs from 'node:fs';

const token = process.env.TELEGRAM_TOKEN;
const chats = String(process.env.TELEGRAM_ANNOUNCE_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!token || !chats.length) { console.log('No TELEGRAM_TOKEN or chat: nothing to announce'); process.exit(0); }

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const v = String(process.env.ANNOUNCE_VERSION || pkg.version).replace(/^v/, ''), repo = 'CPSDomain/VTT';
const log = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const start = log.indexOf(`## [${v}]`); if (start < 0) { console.log(`No CHANGELOG section for ${v}`); process.exit(0); }
const next = log.indexOf('\n## [', start + 1), section = log.slice(start, next < 0 ? undefined : next);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// the headline of each change: "- **Party panel (#2):** everyone…" → Party panel (#2)
const heads = section.split('\n').filter((l) => /^- /.test(l)).map((l) => (/\*\*(.+?)\*\*/.exec(l) || [, l.slice(2)])[1].replace(/[*`]/g, '').replace(/[:.]$/, '')).slice(0, 12);
const intro = (section.split('\n').slice(1).find((l) => l.trim() && !/^\s*[#-]/.test(l)) || '').trim();
const fixed = [...new Set([...section.matchAll(/\(#(\d+)\)/g)].map((m) => m[1]))];
const dl = (name) => `https://github.com/${repo}/releases/download/v${v}/${name}`;
const text = `🎉 <b>Tabletop ${esc(v)} is out!</b>\n` + (intro ? `${esc(intro)}\n` : '') + '\n' +
  heads.map((h) => '• ' + esc(h)).join('\n') +
  (fixed.length ? `\n\n✅ Done from your requests: ${fixed.map((n) => `<a href="https://github.com/${repo}/issues/${n}">#${n}</a>`).join(', ')}` : '') +
  `\n\n🎲 Players: <a href="${dl(`Tabletop-Player-Setup-${v}.exe`)}">Tabletop Player installer</a>\n🐉 The DM: <a href="${dl(`Tabletop-DM-Setup-${v}.exe`)}">Tabletop DM installer</a>\n📖 <a href="${dl('Tabletop-Player-Guide.pdf')}">Player guide (PDF)</a>\n\nThe apps also offer the update themselves. Everything that changed: https://github.com/${repo}/releases/tag/v${v}`;

let failed = 0;
for (const chat of chats) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }) });
  const j = await r.json().catch(() => ({}));
  if (j.ok) console.log(`Announced ${v} in ${chat}`); else { failed++; console.log(`Couldn't post in ${chat}: ${j.description || r.status}`); }
}
process.exit(failed === chats.length ? 1 : 0);
