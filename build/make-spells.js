// Builds public/spells.json: every 2014 Player's Handbook spell (plus Xanathar's and Tasha's) with its game numbers (level, casting time, range,
// area, duration, concentration, saving throw, spell attack, damage and how it grows, healing, temporary hit points,
// conditions), so any spell can be cast in combat, by a player or by a monster. Descriptions are included only for
// the spells in the System Reference Document 5.1 (CC BY 4.0); the others say to see the Player's Handbook.
// Run: node build/make-spells.js <5etools data/spells/spells-phb.json> [spells-xge.json spells-tce.json]
// (1.21: the 2014 rules. Before that it was built from spells-xphb.json, the 2024 book.)
const fs = require('fs'), path = require('path');
const srcs = process.argv.slice(2); if (!srcs.length) { console.error('Usage: node build/make-spells.js spells-phb.json [spells-xge.json spells-tce.json]'); process.exit(1); }
const data = srcs.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).spell);

const SCHOOL = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation' };
const AB = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
const TYPES = 'acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder';
const flat = (x) => (typeof x === 'string' ? x : Array.isArray(x) ? x.map(flat).join('\n') : x && typeof x === 'object' ? [x.name ? x.name + '.' : '', flat(x.entries || x.items || x.entry || ''), x.rows ? x.rows.map((r) => r.map(flat).join(' | ')).join('\n') : ''].filter(Boolean).join(' ') : '');
const clean = (s) => s.replace(/\{@(\w+) ([^}]*)\}/g, (_, tag, body) => { const p = body.split('|'); if (tag === 'scaledamage' || tag === 'scaledice') return p[2]; return p.length > 2 && p[2] ? p[2] : p[0]; });
const timeOf = (t) => (t || []).map((x) => `${x.number} ${x.unit === 'bonus' ? 'Bonus Action' : x.unit === 'reaction' ? 'Reaction' : x.unit === 'action' ? 'Action' : x.unit + (x.number > 1 ? 's' : '')}`).join(' or ');
const SELFAREA = { radius: 'emanation', sphere: 'sphere', hemisphere: 'sphere', cone: 'cone', line: 'line', cube: 'cube', cylinder: 'cylinder' };
const rangeOf = (r) => { if (!r) return ''; const d = r.distance || {}; if (r.type === 'special') return 'Special'; if (d.type === 'self') return 'Self'; if (d.type === 'touch') return 'Touch'; if (d.type === 'sight') return 'Sight'; if (d.type === 'unlimited') return 'Unlimited'; return d.amount ? `${d.amount} ${d.type === 'miles' ? (d.amount > 1 ? 'miles' : 'mile') : 'ft'}` : d.type || ''; };
const durOf = (ds) => (ds || []).map((d) => d.type === 'instant' ? 'Instantaneous' : d.type === 'permanent' ? 'Until dispelled' : d.type === 'special' ? 'Special' : d.duration ? `${d.concentration ? 'Concentration, up to ' : ''}${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? 's' : ''}` : d.type).join(' or ');
const roundsOf = (ds) => { const d = (ds || []).find((x) => x.duration); if (!d) return 0; const n = d.duration.amount, u = d.duration.type; return n * ({ round: 1, minute: 10, hour: 600, day: 14400 }[u] || 0); };

const out = [];
for (const s of data) {
  const main = clean(flat(s.entries || [])), higher = flat(s.entriesHigherLevel || []), all = main + ' ' + clean(higher);
  const e = { name: s.name, level: s.level, school: SCHOOL[s.school] || s.school, time: timeOf(s.time), range: rangeOf(s.range), duration: durOf(s.duration), rounds: roundsOf(s.duration),
    conc: (s.duration || []).some((d) => d.concentration), ritual: !!(s.meta && s.meta.ritual), comps: [s.components && s.components.v ? 'V' : '', s.components && s.components.s ? 'S' : '', s.components && s.components.m ? 'M' : ''].filter(Boolean).join(', ') };
  if (s.time && s.time[0] && s.time[0].unit === 'reaction') e.reaction = true;
  if (s.savingThrow) e.save = AB[s.savingThrow[0]];
  if (s.spellAttack) e.attack = s.spellAttack[0] === 'M' ? 'melee' : 'ranged';
  // damage: the dice in the sentence that first deals damage (Ice Storm's bludgeoning and cold together)
  const raw = flat(s.entries || []);
  const sentences = raw.split(/(?<=\.)\s+/);
  const first = sentences.find((x) => /\{@damage [^}]+\}\s*(?:\w+\s+)?(?:damage|\w+ damage)/i.test(x) || /\{@damage [^}]+\}/.test(x));
  if (first && s.damageInflict) {
    const parts = []; const re = new RegExp('\\{@damage ([^}|]+)[^}]*\\}\\s*(' + TYPES + ')?', 'gi'); let m;
    while ((m = re.exec(first))) parts.push({ dice: m[1].replace(/\s/g, ''), type: (m[2] || (s.damageInflict.length === 1 ? s.damageInflict[0] : '')).toLowerCase() });
    // "3d8 Radiant damage (if you're good) or 3d8 Necrotic damage (if you're evil)": one or the other, not both
    for (let i = 1; i < parts.length; i++) if (parts[i].dice === parts[0].dice && new RegExp(parts[0].type + '[^.]*? or [^.]*?' + parts[i].type, 'i').test(clean(first))) { e.types = [...new Set([...(e.types || [parts[0].type]), parts[i].type])]; parts.splice(i--, 1); }
    if (parts.length) e.dmg = parts;
    // no type given: the caster picks one of the types the spell names (Chromatic Orb, Dragon's Breath)
    if (parts.some((p) => !p.type)) e.types = [...new Set((main.match(new RegExp('\\b(' + TYPES + ')\\b', 'gi')) || []).map((x) => x.toLowerCase()))];
    const choice = new RegExp('((?:' + TYPES + ')(?:, (?:' + TYPES + '))*,? or (?:' + TYPES + ')) damage \\((?:your|its) choice\\)|damage type of your choice|(?:' + TYPES + ') or (?:' + TYPES + ') damage \\(your choice\\)', 'i').exec(clean(first) + ' ' + main);
    if (choice && !e.types) e.types = [...new Set((clean(choice[0]).match(new RegExp(TYPES, 'gi')) || []).map((x) => x.toLowerCase()))];
    if (e.types && e.types.length < 2) delete e.types;
  }
  e.half = /half as much damage/i.test(main);
  // how damage grows: a cantrip with your level, a spell with the slot
  if (s.scalingLevelDice) { const sc = Array.isArray(s.scalingLevelDice) ? s.scalingLevelDice[0] : s.scalingLevelDice; e.cantrip = sc.scaling; }
  let m2; const sd = /\{@scaledamage ([^|}]+)\|[^|}]*\|([^}]+)\}/.exec(higher); if (sd) e.per = sd[2].replace(/\s/g, '');
  const sh = /\{@scaledice ([^|}]+)\|[^|}]*\|([^}]+)\}/.exec(higher); if (sh) e.scale = { base: sh[1].replace(/\s/g, ''), per: sh[2].replace(/\s/g, '') };
  // healing
  if ((s.miscTags || []).includes('HL')) {
    const D = '(\\d+d\\d+(?:\\s*\\+\\s*\\d+)?)';
    if ((m2 = new RegExp('regains?[^.]*?Hit Points equal to ' + D + '( (?:plus|\\+) your spellcasting ability modifier)?', 'i').exec(main)) || (m2 = new RegExp('regains?[^.]*?' + D + '[^.]*?Hit Points( (?:plus|\\+) your spellcasting ability modifier)?', 'i').exec(main)) || (m2 = new RegExp(D + ' (?:plus|\\+) your spellcasting ability modifier[^.]*Hit Points', 'i').exec(main)) || (m2 = new RegExp('Hit Points equal to ' + D + '( (?:plus|\\+) your spellcasting ability modifier)?', 'i').exec(main))) { e.heal = m2[1].replace(/\s/g, ''); e.healMod = /(?:plus|\+) your spellcasting ability modifier/i.test(m2[0]); }
    else if ((m2 = /regains? (\d+) Hit Points/i.exec(main))) e.heal = m2[1];
    if (e.scale && e.heal && e.scale.base.replace(/\+.*/, '') === e.heal.replace(/\+.*/, '')) e.healPer = e.scale.per;
    if (e.scale && !e.heal) { e.heal = e.scale.base; e.healPer = e.scale.per; }
    if (/^Mass Heal$/i.test(s.name)) { e.heal = '700'; e.pool = true; }
  }
  if ((s.miscTags || []).includes('THP')) {
    if ((m2 = /(\d+d\d+)\s*(?:\+\s*(\d+))?\s*Temporary Hit Points/i.exec(main))) e.temp = m2[1] + (m2[2] ? '+' + m2[2] : '');
    else if ((m2 = /(\d+) Temporary Hit Points/i.exec(main))) e.temp = m2[1];
    if ((m2 = /Temporary Hit Points increase by (\d+) for each spell slot level above/i.exec(clean(higher)) || /(\d+) additional temporary hit points for each slot level above/i.exec(clean(higher)))) e.tempPer = +m2[1];
  }
  if ((m2 = /Hit Point maximum and current Hit Points increase by (\d+)/i.exec(main))) e.maxUp = +m2[1];
  const area = /(\d+)-foot(?:-radius)? (Sphere|Cone|Cube|Line|Emanation|Cylinder)/i.exec(main) || /(Line)[^.]*?(\d+) feet long/i.exec(main);
  if (area) e.aoe = /^\d/.test(area[1]) ? { shape: area[2].toLowerCase(), size: +area[1] } : { shape: 'line', size: +area[2] };
  // the 2014 wording: "a 20-foot-tall cylinder with a 40-foot radius", "in a 60-foot radius", "within 20 feet of a point"
  if (!e.aoe) { const r = /cylinder[^.]*?(\d+)-foot radius/i.exec(main); if (r) e.aoe = { shape: 'cylinder', size: +r[1] }; }
  if (!e.aoe) { const r = /(\d+)-foot[- ]radius/i.exec(main) || /within (\d+) feet of a point/i.exec(main); if (r) e.aoe = { shape: 'sphere', size: +r[1] }; }
  if (!e.aoe && s.range && SELFAREA[s.range.type] && s.range.distance && s.range.distance.amount) e.aoe = { shape: SELFAREA[s.range.type], size: s.range.distance.amount };
  if (!e.aoe && e.range === 'Self') { const r = /within (\d+) feet of you\b/i.exec(main) || /to a distance of (\d+) feet/i.exec(main); if (r) e.aoe = { shape: 'emanation', size: +r[1] }; }
  if (e.aoe && e.aoe.shape === 'sphere' && /^(Self|\d+ ft)$/.test(e.range) && e.range === 'Self') e.aoe.shape = 'emanation';
  if (e.aoe && s.range && s.range.type === 'radius') e.aoe.shape = 'emanation';
  if (!e.aoe && /^(Thunderclap|Word of Radiance)$/.test(s.name)) e.aoe = { shape: 'emanation', size: 5 };
  if (!e.aoe && s.name === 'Cloud of Daggers') e.aoe = { shape: 'cube', size: 5 };
  if (s.conditionInflict) e.conds = s.conditionInflict;
  // how many it can target: "up to three creatures", "a creature you can see", and more with a higher slot
  const W = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
  {
    const lead = main.split(/(?<=\.)\s+/).slice(0, 3).join(' ');
    let m3 = /\bup to (one|two|three|four|five|six|seven|eight|nine|ten|twelve) (?:willing |other )?(?:creatures?|targets?|Humanoids?|Beasts?|allies)/i.exec(main) || (!e.aoe && /\b(one|a|an) (?:willing |other )?(?:creature|target|Humanoid|Beast|Undead|corpse|ally)\b(?! or object)/i.exec(lead));
    if (m3 && !(e.aoe && !/up to/i.test(m3[0])) && !/(dart|ray|beam)s?\b/i.test(main.slice(0, 200))) {
      e.targets = { n: W[m3[1].toLowerCase()] || 1 };
      const more = /(one|two|three) additional (?:creature|target|Humanoid|Beast|Undead|ally|ray|dart|beam)s? for each (?:spell )?slot level above/i.exec(clean(higher));
      if (more) e.targets.up = W[more[1].toLowerCase()];
    }
  }
  if (s.srd) e.desc = (clean(main) + (higher ? '\n\n' + clean(higher) : '')).replace(/\s*\n\s*/g, '\n').slice(0, 2400);
  else e.desc = '';
  e.srd = !!s.srd;
  if (typeof s.srd === 'string') e.srdName = s.srd;
  out.push(e);
}
// 2014's Divine Smite is a Paladin feature, not a spell: listed here so it can be used like one (it spends a slot)
if (!out.some((e) => e.name === 'Divine Smite')) out.push({ name: 'Divine Smite', level: 1, school: 'Evocation', time: 'On a melee weapon hit', range: 'Self', duration: 'Instantaneous', rounds: 0, conc: false, ritual: false, comps: '', dmg: [{ dice: '2d8', type: 'radiant' }], per: '1d8', half: false, targets: { n: 1 }, srd: true, feature: true,
  desc: 'Paladin, 2nd level. When you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target, in addition to the weapon\'s damage. The extra damage is 2d8 for a 1st-level spell slot, plus 1d8 for each spell level higher than 1st, to a maximum of 5d8. The damage increases by 1d8 if the target is an undead or a fiend.' });
// the older names (SRD 5.1 and 2014 books) that monsters' spell lists use
const ALIAS = {};
for (const e of out) { const m = /^[A-Z][\w-]*'s (.+)$/.exec(e.name); if (m) ALIAS[m[1].toLowerCase()] = e.name; if (e.srdName) { ALIAS[e.srdName.toLowerCase()] = e.name; delete e.srdName; } }
// the 2024 names, for characters made with the 2024 book on D&D Beyond
Object.assign(ALIAS, { befuddlement: 'Feeblemind', 'shining smite': 'Branding Smite', 'jump ': 'Jump' });
Object.assign(ALIAS, { 'arcane hand': "Bigby's Hand", 'arcane sword': "Mordenkainen's Sword", 'black tentacles': "Evard's Black Tentacles", 'faithful hound': "Mordenkainen's Faithful Hound", 'floating disk': "Tenser's Floating Disk", 'freezing sphere': "Otiluke's Freezing Sphere", 'hideous laughter': "Tasha's Hideous Laughter", 'instant summons': "Drawmij's Instant Summons", 'irresistible dance': "Otto's Irresistible Dance", 'magnificent mansion': "Mordenkainen's Magnificent Mansion", 'private sanctum': "Mordenkainen's Private Sanctum", 'resilient sphere': "Otiluke's Resilient Sphere", 'secret chest': "Leomund's Secret Chest", 'telepathic bond': "Rary's Telepathic Bond", 'tiny hut': "Leomund's Tiny Hut", 'acid arrow': "Melf's Acid Arrow", 'firebolt': 'Fire Bolt', 'power word heal': 'Power Word Heal' });
for (const k of Object.keys(ALIAS)) if (!out.some((e) => e.name === ALIAS[k])) delete ALIAS[k];
fs.writeFileSync(path.join(__dirname, '..', 'public', 'spells.json'), JSON.stringify({ credit: 'Spell rules from the 2014 Player\'s Handbook, Xanathar\'s Guide and Tasha\'s Cauldron (numbers only). Descriptions from the System Reference Document 5.1 by Wizards of the Coast LLC, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).', spells: out, alias: ALIAS }));
console.log(out.length, 'spells,', out.filter((e) => e.dmg).length, 'with damage,', out.filter((e) => e.heal).length, 'healing,', out.filter((e) => e.desc).length, 'with SRD 5.1 text,', Object.keys(ALIAS).length, 'aliases');
