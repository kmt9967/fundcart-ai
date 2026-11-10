import type { Family } from './types';

// Deterministic behaviour layer for the 29 intent families (team Shopping Intent Library, parts 1–5).
// The model may label a family; this module decides what the family *does*, from the text alone, so
// the behaviour is identical in rules-only mode and never depends on model output:
//   - which families are present (multi-label: real sentences mix 2–4 families);
//   - whether to ask one question before searching (compatibility without a model, safety-critical
//     vehicle parts without make/model/year) or alongside results (size for fit items);
//   - capability limits to state honestly (no image/voice understanding, no order history, no sales
//     or delivery data, no verified certifications) instead of inventing them;
//   - project kits, problem → solution types, comparisons, substitutes, contradictions.

export type CapabilityNote =
  | 'cap.image' | 'cap.voice' | 'cap.link' | 'cap.history' | 'cap.trend' | 'cap.deals' | 'cap.delivery'
  | 'cap.payment' | 'cap.certifications' | 'cap.gift' | 'cap.substitute' | 'cap.kit' | 'cap.problem'
  | 'cap.medical' | 'cap.allergen' | 'cap.spending' | 'cap.sensitive' | 'cap.childSpend' | 'cap.pii' | 'cap.fitCheck';

export type Kit = { id: string; items: string[] };
export type Directive = {
  families: Family[];
  notes: CapabilityNote[];
  askFirst: 'compat_model' | 'vehicle' | null;
  askAlongside: 'size' | 'compat_model' | null;
  rankBy: 'rating_count' | 'discount' | null;
  contradiction: 'contra.gpuBudget' | 'contra.weightScreen' | 'contra.cheapestBest' | 'contra.valuesPrice' | 'contra.flagshipBudget' | null;
  kit: Kit | null;
  problem: { id: string; solutions: string[] } | null;
  comparison: string[] | null;
  substituteOf: string | null;
  modelTokens: string[];
  compatTarget: string | null;
};

const KITS: Array<[RegExp, Kit]> = [
  [/home office|work from home setup|ghar (ka|par) office/i, { id: 'home_office', items: ['office desk', 'ergonomic office chair', '24 inch monitor', 'desk lamp', 'keyboard and mouse'] }],
  [/start(ing)? baking|baking (starter|kit|essentials)|everything (i need )?to (start )?bak/i, { id: 'baking', items: ['oven toaster grill', 'baking pans set', 'kitchen scale', 'hand mixer', 'measuring cups'] }],
  [/camping (trip|kit|gear)|go(ing)? camping/i, { id: 'camping', items: ['4 person tent', 'sleeping bag', 'camping stove', 'camping lantern', 'cooler box'] }],
  [/newborn|new ?born|baby essentials|baby (kit|checklist)/i, { id: 'newborn', items: ['baby diapers', 'baby bottles', 'baby carrier', 'baby crib', 'baby wipes'] }],
  [/start(ing)? (the )?gym|gym (kit|essentials|starter)|new to (the )?gym/i, { id: 'gym', items: ['training shoes', 'gym bag', 'water bottle', 'workout clothes'] }],
  [/first (apartment|flat|home)|moved into (my|a) (new )?(apartment|flat|home)|naya ghar/i, { id: 'first_home', items: ['cookware set', 'bedding set', 'toolkit', 'storage boxes', 'cleaning supplies'] }],
  [/beach picnic|picnic (kit|things|essentials)|things for a (beach )?picnic/i, { id: 'picnic', items: ['picnic mat', 'cooler bag', 'sunscreen', 'bluetooth speaker'] }],
  [/(gaming )?pc build|build (a|my) (gaming )?pc/i, { id: 'pc_build', items: ['CPU processor', 'motherboard', 'graphics card', 'RAM 16GB', 'power supply'] }],
];

const PROBLEMS: Array<[RegExp, { id: string; solutions: string[] }]> = [
  [/(too hot|garmi|heat).{0,60}(load ?shedding|power cuts?|bijli)|(load ?shedding|power cuts?|bijli (nahi|jati)).{0,60}(hot|garmi|heat)/i, { id: 'heat_power', solutions: ['rechargeable fan', 'UPS inverter', 'solar fan'] }],
  [/back pain|sitting all day.{0,30}(pain|hurts)|kamar (dard|mein dard)/i, { id: 'posture', solutions: ['ergonomic office chair', 'lumbar support pillow', 'standing desk'] }],
  [/phone (dies|battery dies|dies by)|battery (drains|dies) (fast|quickly)|charge khatam/i, { id: 'battery', solutions: ['power bank', 'fast charger'] }],
  [/wi-?fi (doesn'?t|does not|won'?t) reach|weak wi-?fi|wifi signal (in|is) (weak|bad)/i, { id: 'wifi', solutions: ['wifi range extender', 'mesh wifi system'] }],
  [/mosquito(es)?|machar/i, { id: 'mosquito', solutions: ['mosquito net', 'mosquito repellent', 'electric mosquito killer'] }],
  [/hard water|limescale|water stains on (my )?(taps|faucets)/i, { id: 'limescale', solutions: ['limescale remover', 'descaler'] }],
  [/standing (for )?\d+ hours|on my feet all day|stand all day/i, { id: 'standing', solutions: ['cushioned work shoes', 'insoles arch support'] }],
];

const COMPAT = /\b(case|cover|charger|adapter|lens|ink|cartridge|toner|blade|screen protector|tempered glass|replacement battery|strap|cable|keyboard cover|remote|filter)s?\s+(for|of|compatible with)\s+(my |the |a )?([a-z][a-z0-9 .-]{1,40})/i;
const VEHICLE_PART = /\b(brake pads?|brake discs?|tyres?|tires|car battery|wiper blades?|oil filter|spark plugs?)\b/i;
const FIT_ITEMS = /\b(shoes|sneakers|boots|jeans|trousers|pants|shirt|kurta|dress|jacket|bra|kicks|joote|sandals)\b/i;
const SIZE = /\bsize\s*\w+|\b(xxs|xs|xxl|xl|small|medium|large)\b|\b\d{2}\s*(eu|uk|us)?\b(?! ?(gb|inch|"|k\b))|\bwaist\b|\d'\d/i;

const DETECT: Array<[Family, RegExp]> = [
  ['image_voice', /\b(photo|picture|image|screenshot|pic|voice (note|message)|audio clip)\b|تصویر|ye wala\b/i],
  ['donor', /(want to help|donate|support (a|someone)|contribute to|where did my money go|zakat|chanda)/i],
  ['non_product_support', /(where is my order|track (my )?order|return (policy|this)|warranty|installments?|cash on delivery|original or copy)/i],
  ['affordability_gap', /(only have|can'?t afford|short (of|by)|mere paas sirf|need help (paying|buying)|i have \$?\d+.{0,20}(need|but))/i],
  ['bundle_project', /(home office|start(ing)? baking|camping|newborn|starting gym|first (apartment|flat)|picnic|pc build|everything (i need|for))/i],
  ['problem_symptom', /(too hot|back pain|phone dies|wi-?fi (doesn'?t|won'?t) reach|mosquito|hard water|limescale|standing \d+ hours|keeps (breaking|dying)|problem with)/i],
  ['comparison', /\b(vs\.?|versus|compare|which is better|or the)\b/i],
  ['substitute', /\b(like|similar to|alternative to|dupe for|instead of|same as)\b.{0,40}\b(but|cheaper|in)\b|\bdupe\b|alternative to/i],
  ['compatibility', COMPAT],
  ['replacement', /(stopped working|broke|broken|replacement|spare|new blade|replace my)/i],
  ['gift', /\b(gift|present|tohfa|regalo|cadeau|for my (wife|husband|mom|mother|dad|father|boss|son|daughter|friend|sister|brother))\b/i],
  ['occasion_theme', /\b(eid|mehndi|wedding|shaadi|birthday|anniversary|christmas|winter|summer|interview|party|trip to)\b/i],
  ['body_persona_fit', /\b(tall|short|wide feet|plus size|oily skin|dry skin|pregnan|year old|toddler|for my (cat|dog))\b/i],
  ['skill_level', /\b(beginner|first (camera|guitar|time)|new to|upgrading from|professional|naya|seekhna)\b/i],
  ['subjective_vibe', /\b(premium( looking)?|aesthetic|cute|classy|old money|doesn'?t look cheap|good quality|stylish)\b/i],
  ['trend_social_proof', /\b(popular|trending|everyone (has|buys)|best ?sellers?|viral|most (people|bought))\b/i],
  ['deal_seeking', /\b(discounts?|on sale|deals?|coupons?|bargains?|value for money|refurbished|11\.11|black friday|buy \d get \d)\b/i],
  ['values_ethics', /\b(halal|vegan|cruelty[- ]free|eco[- ]?friendly|organic|sustainable|plastic[- ]free|fair trade|local brands?|pakistani brands?|made in)\b/i],
  ['urgency_delivery', /\b(today|tomorrow|by (friday|monday|tuesday|wednesday|thursday|saturday|sunday)|before (eid|friday)|same[- ]day|next[- ]day|deliver(y|ed)|arrive|ship(ping)? to)\b/i],
  ['recurring', /\b(my usual|same as last time|like last time|reorder|order again|running low|every month|remind me|subscri(be|ption))\b/i],
  ['contradictory', /(rtx ?(40|50)(80|90).{0,40}(under|below|\$\s?\d{2,3}\b))|(light(weight)?.{0,40}17 ?(inch|in\b|")|17 ?(inch|in\b|").{0,40}light)|(cheapest.{0,25}(best|top))|(organic.{0,30}imported.{0,30}cheap)/i],
  ['exact_item', /\b(iphone|galaxy|pixel|airpods|macbook|ipad|thinkpad|nivea)\b.{0,15}\d|\bwh-?1000 ?xm\d\b|\bsamsung (galaxy )?[asmz]\d{2,3}\b/i],
];

function modelTokens(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b([a-z]{1,8}[- ]?\d{2,5}[a-z0-9-]*|\d{2,4}[a-z]{1,3})\b/gi)) {
    const tok = m[1].toLowerCase().replace(/[\s-]/g, '');
    if (!/^\d+(gb|tb|k|mah|w|hz|in|inch|cm|mm|ml|fps|rs|pkr|usd)$/.test(tok) && !/^(under|below|budget)\d/.test(tok)) out.add(tok);
  }
  return [...out].slice(0, 4);
}

export function analyzeFamilies(raw: string, opts: { budgetCents?: number | null } = {}): Directive {
  const text = raw.slice(0, 600);
  const families = DETECT.filter(([, re]) => re.test(text)).map(([f]) => f);
  const notes = new Set<CapabilityNote>();
  if (/\b(photo|picture|image|screenshot|pic)\b|تصویر/i.test(text)) notes.add('cap.image');
  if (/voice (note|message)|audio clip/i.test(text)) notes.add('cap.voice');
  if (/https?:\/\/|www\./i.test(text)) notes.add('cap.link');
  if (families.includes('recurring')) notes.add('cap.history');
  if (families.includes('trend_social_proof')) notes.add('cap.trend');
  if (families.includes('deal_seeking')) notes.add('cap.deals');
  if (families.includes('urgency_delivery')) notes.add('cap.delivery');
  if (/installments?|cash on delivery|\bcod\b|bnpl/i.test(text)) notes.add('cap.payment');
  if (families.includes('values_ethics')) notes.add('cap.certifications');
  if (families.includes('gift')) notes.add('cap.gift');

  const kit = KITS.find(([re]) => re.test(text))?.[1] ?? null;
  if (kit) notes.add('cap.kit');
  const problem = PROBLEMS.find(([re]) => re.test(text))?.[1] ?? null;
  if (problem) notes.add('cap.problem');

  // Comparison: "iPhone 15 or Samsung S24, which is better" → two search terms.
  let comparison: string[] | null = null;
  if (families.includes('comparison')) {
    const m = text.replace(/\b(which is better|which one|for (camera|a student|gaming|battery).*$|\?)/gi, ' ').match(/([a-z0-9][a-z0-9 .+-]{1,40}?)\s+(?:vs\.?|versus|or)\s+([a-z0-9][a-z0-9 .+-]{1,40})/i);
    if (m) comparison = [m[1], m[2]].map(s => s.replace(/^(compare|is the|the|should i (buy|get))\s+/i, '').trim()).filter(s => s.length >= 2).slice(0, 2);
    if (comparison && comparison.length < 2) comparison = null;
  }
  const sub = text.match(/\b(?:like|similar to|alternative to|dupe for|instead of)\s+(?:the\s+|an?\s+)?([a-z0-9][a-z0-9 .-]{1,30}?)(?:\s+but\b|,|\s+cheaper|\s+in\b|$)/i);
  const substituteOf = families.includes('substitute') && sub ? sub[1].trim() : null;
  if (substituteOf) notes.add('cap.substitute');

  // Compatibility: never guess fit when the owned device has no model number.
  const compat = text.match(COMPAT);
  const compatTarget = compat ? compat[4].replace(/\b(please|chahiye|batao|under|below|for)\b.*$/i, '').trim() : null;
  let askFirst: Directive['askFirst'] = null;
  let askAlongside: Directive['askAlongside'] = null;
  if (compatTarget && !/\d/.test(compatTarget)) askFirst = 'compat_model';
  else if (compatTarget) notes.add('cap.fitCheck');
  if (VEHICLE_PART.test(text) && !(/\b(19|20)\d{2}\b/.test(text) && /\b(corolla|civic|city|alto|cultus|swift|camry|accord|mehran|wagon ?r|yaris|sportage|tucson|[a-z]+ \d{3,4})\b/i.test(text))) askFirst = 'vehicle';
  if (!askFirst && FIT_ITEMS.test(text) && !SIZE.test(text)) askAlongside = 'size';

  let contradiction: Directive['contradiction'] = null;
  const usd = opts.budgetCents ?? null;
  if (/rtx ?(40|50)(80|90)/i.test(text) && (usd == null ? /\b(under|below)\s*\$?\s?\d{2,3}\b|\b\d{2,3}k\b/i.test(text) : usd < 150_000)) contradiction = 'contra.gpuBudget';
  else if (/(light(weight)?|halka).{0,40}17 ?(inch|in\b|")|17 ?(inch|in\b|").{0,40}(light(weight)?|halka)/i.test(text)) contradiction = 'contra.weightScreen';
  else if (/cheapest.{0,25}(best|top)|(best|top).{0,25}cheapest/i.test(text)) contradiction = 'contra.cheapestBest';
  else if (/organic.{0,30}imported.{0,30}cheap|cheap.{0,30}organic.{0,30}imported/i.test(text)) contradiction = 'contra.valuesPrice';
  else if (/\b(iphone 1[5-9] pro|galaxy s2[4-9] ultra|macbook pro)\b/i.test(text) && usd != null && usd < 30_000) contradiction = 'contra.flagshipBudget';
  if (contradiction && !families.includes('contradictory')) families.push('contradictory');

  const rankBy: Directive['rankBy'] = families.includes('trend_social_proof') ? 'rating_count' : families.includes('deal_seeking') ? 'discount' : null;
  return { families: [...new Set(families)], notes: [...notes], askFirst, askAlongside, rankBy, contradiction, kit, problem, comparison, substituteOf, modelTokens: modelTokens(compatTarget || text), compatTarget };
}

/** ESCI-style relevance label for a listing: exact model match, compatible fit, or an alternative. */
export function matchType(title: string, d: Pick<Directive, 'modelTokens' | 'substituteOf' | 'compatTarget' | 'families'>): 'exact' | 'alternative' | 'fit_unconfirmed' | null {
  const norm = title.toLowerCase().replace(/[\s-]/g, '');
  const hasAll = d.modelTokens.length > 0 && d.modelTokens.every(t => norm.includes(t));
  if (d.compatTarget) return hasAll ? 'exact' : 'fit_unconfirmed';
  if (d.substituteOf) return norm.includes(d.substituteOf.toLowerCase().replace(/[\s-]/g, '')) ? 'exact' : 'alternative';
  if (d.families.includes('exact_item') && d.modelTokens.length) return hasAll ? 'exact' : 'alternative';
  return null;
}
