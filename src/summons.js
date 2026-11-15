// Spells that put a creature or a thing on the map (1.19), and spells that move creatures (teleports and pushes).
// Numbers only, by the 2014 rules (since 1.21): the Player's Handbook spells call creatures from the stat blocks (SRD
// 5.1), Tasha's Cauldron's spirits have their own (Bestial Spirit, Fey Spirit…): AC, hit points and attacks worked out
// for the spell's level. L = the slot level, mod = the caster's spellcasting ability modifier.
//   forms: the choices when casting (Air, Land, Water…), each with its own attacks or hit points
//   attacks: { name, dice(L, mod), type, melee, reach | range, extra } — made with the caster's spell attack bonus
//   multi(L): how many attacks it makes with its action
//   srd: a monster from the stat blocks instead (Find Familiar's owl, Animate Dead's skeletons); count(L): how many
//   cr / crMax(L) and kind: the caster picks a creature of that type and Challenge Rating (Conjure Animals, Conjure
//   Elemental…); count of them, times scale(L) for a higher slot
//   object: no hit points (Spiritual Weapon); zone: an area that moves with it (Conjure Animals' pack)
//   init: 'share' (Tasha's spirits: the caster's Initiative, its turn right after the caster's) or 'roll' (its own roll:
//   Find Familiar, the undead, conjured creatures); things without it (Spiritual Weapon, Bigby's Hand) act on the
//   caster's turn
const F = (n) => Math.floor(n);
const half = (L) => F(L / 2);
const SPIRIT = { icon: 'ghost', color: '#7dd3fc' };

const SUMMONS = {
  'find familiar': { init: 'roll', label: 'Familiar', n: () => 1, forms: ['Bat', 'Cat', 'Crab', 'Frog', 'Hawk', 'Lizard', 'Octopus', 'Owl', 'Poisonous Snake', 'Quipper', 'Rat', 'Raven', 'Sea Horse', 'Spider', 'Weasel'].map((x) => ({ name: x, srd: x.toLowerCase().replace(/ /g, '-') })) },
  'find steed': { init: 'roll', label: 'Steed', n: () => 1, forms: ['Warhorse', 'Pony', 'Camel', 'Elk', 'Mastiff'].map((x) => ({ name: x, srd: x.toLowerCase() })) },
  'summon beast': { init: 'share', label: 'Bestial Spirit', ...SPIRIT, icon: 'wolf-head', ac: (L) => 11 + L, multi: half,
    forms: [{ name: 'Air', hp: (L) => 20 + 5 * (L - 2) }, { name: 'Land', hp: (L) => 30 + 5 * (L - 2) }, { name: 'Water', hp: (L) => 30 + 5 * (L - 2) }].map((f) => ({ ...f, attacks: [{ name: 'Rend', dice: (L) => '1d8+' + (4 + L), type: 'piercing', melee: true }] })) },
  'summon fey': { init: 'share', label: 'Fey Spirit', ...SPIRIT, icon: 'fairy', ac: (L) => 12 + L, hp: (L) => 30 + 10 * (L - 3), multi: half,
    forms: ['Fuming', 'Mirthful', 'Tricksy'].map((name) => ({ name, attacks: [{ name: 'Fey Blade', dice: (L) => '2d6+' + (3 + L), type: 'force', melee: true }] })) },
  'summon undead': { init: 'share', label: 'Undead Spirit', ...SPIRIT, icon: 'skeleton', ac: (L) => 11 + L, multi: half,
    forms: [{ name: 'Ghostly', hp: (L) => 30 + 10 * (L - 3), attacks: [{ name: 'Deathly Touch', dice: (L) => '1d8+' + (3 + L), type: 'necrotic', melee: true }] },
      { name: 'Putrid', hp: (L) => 30 + 10 * (L - 3), attacks: [{ name: 'Rotting Claw', dice: (L) => '1d6+' + (3 + L), type: 'slashing', melee: true }] },
      { name: 'Skeletal', hp: (L) => 20 + 10 * (L - 3), attacks: [{ name: 'Grave Bolt', dice: (L) => '2d4+' + (3 + L), type: 'necrotic', range: 150 }] }] },
  'summon aberration': { init: 'share', label: 'Aberrant Spirit', ...SPIRIT, icon: 'interlaced-tentacles', ac: (L) => 11 + L, hp: (L) => 40 + 10 * (L - 4), multi: half,
    forms: [{ name: 'Beholderkin', attacks: [{ name: 'Eye Ray', dice: (L) => '1d8+' + (3 + L), type: 'psychic', range: 150 }] },
      { name: 'Mind Flayer', attacks: [{ name: 'Psychic Slam', dice: (L) => '1d8+' + (3 + L), type: 'psychic', melee: true }] },
      { name: 'Slaad', attacks: [{ name: 'Claw', dice: (L) => '1d10+' + (3 + L), type: 'slashing', melee: true }] }] },
  'summon construct': { init: 'share', label: 'Construct Spirit', ...SPIRIT, icon: 'golem-head', ac: (L) => 13 + L, hp: (L) => 40 + 15 * (L - 4), multi: half,
    forms: ['Clay', 'Metal', 'Stone'].map((name) => ({ name, attacks: [{ name: 'Slam', dice: (L) => '1d8+' + (4 + L), type: 'bludgeoning', melee: true }] })) },
  'summon elemental': { init: 'share', label: 'Elemental Spirit', ...SPIRIT, icon: 'whirlwind', ac: (L) => 11 + L, hp: (L) => 50 + 10 * (L - 4), multi: half,
    forms: [['Air', 'lightning'], ['Earth', 'bludgeoning'], ['Fire', 'fire'], ['Water', 'cold']].map(([name, type]) => ({ name, attacks: [{ name: 'Slam', dice: (L) => '1d10+' + (4 + L), type, melee: true }] })) },
  'summon celestial': { init: 'share', label: 'Celestial Spirit', ...SPIRIT, icon: 'sun-priest', size: 2, multi: half, hp: (L) => 40 + 10 * (L - 5),
    forms: [{ name: 'Avenger', ac: (L) => 11 + L, attacks: [{ name: 'Radiant Bow', dice: (L) => '2d6+' + (2 + L), type: 'radiant', range: 600 }] },
      { name: 'Defender', ac: (L) => 13 + L, attacks: [{ name: 'Radiant Mace', dice: (L) => '1d10+' + (3 + L), type: 'radiant', melee: true }] }] },
  'summon fiend': { init: 'share', label: 'Fiendish Spirit', ...SPIRIT, icon: 'daemon-skull', size: 2, ac: (L) => 12 + L, multi: half,
    forms: [{ name: 'Demon', hp: (L) => 50 + 15 * (L - 6), attacks: [{ name: 'Bite', dice: (L) => '1d12+' + (3 + L), type: 'necrotic', melee: true }] },
      { name: 'Devil', hp: (L) => 40 + 15 * (L - 6), attacks: [{ name: 'Fiery Strike', dice: (L) => '2d6+' + (3 + L), type: 'fire', melee: true, range: 150 }] },
      { name: 'Yugoloth', hp: (L) => 60 + 15 * (L - 6), attacks: [{ name: 'Claws', dice: (L) => '1d8+' + (3 + L), type: 'slashing', melee: true }] }] },
  'summon dragon': { init: 'share', label: 'Draconic Spirit', ...SPIRIT, icon: 'dragon-head', size: 2, ac: (L) => 14 + L, hp: (L) => 50 + 10 * (L - 5), multi: half,
    forms: ['Chromatic', 'Gem', 'Metallic'].map((name) => ({ name, attacks: [{ name: 'Rend', dice: (L) => '1d6+' + (4 + L), type: 'piercing', melee: true, reach: 10 }] })) },
  // 2014: ordinary insects grown into giant ones
  'giant insect': { init: 'roll', label: 'Giant Insect', forms: [{ name: 'Ten giant centipedes', srd: 'giant-centipede', count: () => 10 }, { name: 'Three giant spiders', srd: 'giant-spider', count: () => 3 }, { name: 'Five giant wasps', srd: 'giant-wasp', count: () => 5 }, { name: 'One giant scorpion', srd: 'giant-scorpion', count: () => 1 }] },
  // one skeleton or zombie, two more for each slot level above 3rd
  'animate dead': { init: 'roll', label: 'Undead', n: (L) => 1 + 2 * (L - 3), forms: [{ name: 'Skeleton', srd: 'skeleton' }, { name: 'Zombie', srd: 'zombie' }], keep: true },
  'create undead': { init: 'roll', label: 'Undead', n: (L) => Math.max(3, L - 3), forms: [{ name: 'Ghouls', srd: 'ghoul' }, { name: 'Ghasts (level 8+)', srd: 'ghast', count: (L) => (L >= 9 ? 3 : 2) }, { name: 'Wights (level 8+)', srd: 'wight', count: (L) => (L >= 9 ? 3 : 2) }, { name: 'Mummies (level 9)', srd: 'mummy', count: () => 2 }], keep: true },
  // 2014: ten objects, or fewer bigger ones; each attacks with its own bonus (the caster's spell attack here)
  'animate objects': { init: 'share', label: 'Animated Object', icon: 'magic-shield', color: '#a8a29e',
    forms: [['Tiny', 10, 18, 20, '1d4+4', 1], ['Small', 10, 16, 25, '1d8+2', 1], ['Medium', 5, 13, 40, '2d6+1', 1], ['Large', 2, 10, 50, '2d10+2', 2], ['Huge', 1, 10, 80, '2d12+4', 3]]
      .map(([name, n, ac, hp, dice, size]) => ({ name, size, count: (L) => n + (n === 10 ? 2 * (L - 5) : 0), ac: () => ac, hp: () => hp, attacks: [{ name: 'Slam', dice: () => dice, type: 'bludgeoning', melee: true }] })) },
  'spiritual weapon': { label: 'Spiritual Weapon', icon: 'star-swirl', color: '#facc15', object: true,
    forms: [{ name: 'Weapon', attacks: [{ name: 'Spiritual Weapon', dice: (L, mod) => `${1 + half(L - 2)}d8+${mod}`, type: 'force', melee: true }] }] },
  "mordenkainen's sword": { label: 'Arcane Sword', icon: 'star-swirl', color: '#93c5fd', object: true,
    forms: [{ name: 'Sword', attacks: [{ name: 'Arcane Sword', dice: () => '3d10', type: 'force', melee: true }] }] },
  "bigby's hand": { label: "Bigby's Hand", icon: 'hand', color: '#93c5fd', size: 2, ac: () => 20, hp: (L, mod, maxHp) => maxHp || 40,
    forms: [{ name: 'Clenched Fist', attacks: [{ name: 'Clenched Fist', dice: (L) => `${4 + 2 * (L - 5)}d8`, type: 'force', melee: true }] }] },
  // 2014 conjurings: the caster picks a creature of that type and Challenge Rating from the stat blocks
  'conjure animals': { init: 'roll', label: 'Beasts', kind: 'beast', scale: (L) => (L >= 9 ? 4 : L >= 7 ? 3 : L >= 5 ? 2 : 1),
    forms: [{ name: 'One beast of CR 2', cr: 2, count: 1 }, { name: 'Two beasts of CR 1', cr: 1, count: 2 }, { name: 'Four beasts of CR 1/2', cr: 0.5, count: 4 }, { name: 'Eight beasts of CR 1/4', cr: 0.25, count: 8 }] },
  'conjure woodland beings': { init: 'roll', label: 'Fey', kind: 'fey', scale: (L) => (L >= 8 ? 3 : L >= 6 ? 2 : 1),
    forms: [{ name: 'One fey of CR 2', cr: 2, count: 1 }, { name: 'Two fey of CR 1', cr: 1, count: 2 }, { name: 'Four fey of CR 1/2', cr: 0.5, count: 4 }, { name: 'Eight fey of CR 1/4', cr: 0.25, count: 8 }] },
  'conjure minor elementals': { init: 'roll', label: 'Elementals', kind: 'elemental', scale: (L) => (L >= 8 ? 3 : L >= 6 ? 2 : 1),
    forms: [{ name: 'One elemental of CR 2', cr: 2, count: 1 }, { name: 'Two elementals of CR 1', cr: 1, count: 2 }, { name: 'Four elementals of CR 1/2', cr: 0.5, count: 4 }, { name: 'Eight elementals of CR 1/4', cr: 0.25, count: 8 }] },
  'conjure elemental': { init: 'roll', label: 'Elemental', kind: 'elemental', forms: [{ name: 'An elemental (CR 5, +1 a level above 5th)', crMax: (L) => L, count: 1 }] },
  'conjure fey': { init: 'roll', label: 'Fey', kind: 'fey|beast', forms: [{ name: 'A fey or beast (CR 6, +1 a level above 6th)', crMax: (L) => L, count: 1 }] },
  'conjure celestial': { init: 'roll', label: 'Celestial', kind: 'celestial', forms: [{ name: 'A celestial (CR 4; CR 5 at 9th level)', crMax: (L) => (L >= 9 ? 5 : 4), count: 1 }] },
  'dancing lights': { label: 'Dancing Light', icon: 'sparkles', color: '#fde68a', object: true, n: () => 4, light: [0, 10], forms: [{ name: 'Lights' }] },
  'unseen servant': { init: 'roll', label: 'Unseen Servant', icon: 'ghost', color: '#d6d3d1', ac: () => 10, hp: () => 1, forms: [{ name: 'Servant' }], keep: true },
  "mordenkainen's faithful hound": { label: 'Faithful Hound', icon: 'wolf-head', color: '#93c5fd', object: true, forms: [{ name: 'Hound', attacks: [{ name: 'Bite', dice: () => '4d8', type: 'piercing', melee: true }] }], keep: true },
  'phantom steed': { label: 'Phantom Steed', icon: 'horse-head', color: '#d6d3d1', size: 2, ac: () => 10, hp: () => 1, forms: [{ name: 'Steed' }], keep: true }
};


// moving by magic: teleport (feet, who can come along) and push (feet, on a failed save)
const TELEPORTS = {
  'misty step': { feet: 30 },
  'dimension door': { feet: 500, bring: 1 },
  'steel wind strike': { feet: 0, nearTarget: true },
  'thunder step': { feet: 90, bring: 1 },
  'far step': { feet: 60 },
  'arcane gate': { feet: 500 },
  'scatter': { feet: 120, targets: true }
};
const PUSHES = {
  'thunderwave': { feet: 10, onFail: true },
  'gust of wind': { feet: 15, onFail: true },
  'thorn whip': { feet: -10, onHit: true },
  'lightning lure': { feet: -10, onFail: true },
  'telekinesis': { feet: 30, onFail: true }
};
module.exports = { SUMMONS, TELEPORTS, PUSHES };
