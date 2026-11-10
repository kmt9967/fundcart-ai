// Deterministic intent parser used when the model is unavailable, and to cross-check the model.
// Covers English, Urdu (Arabic script), Roman Urdu, Spanish and French shopping vocabulary.

import { INTENT_VERSION, type Constraint, type IntentV2 } from './types';
import { asciiDigits } from './money-parse';
import { GPU_MIN_VRAM } from './specs';

const CATEGORY_WORDS: Array<[string, RegExp]> = [
  ['laptop', /\b(lap ?tops?|labtops?|leptops?|notebook computer|macbook|macbok|chromebook|ultrabook|gaming notebook|computadora port[aá]til|port[aá]til|ordinateur portable|pc portable)\b|لیپ\s?ٹاپ|لیپٹاپ/i],
  ['desktop', /\b(desktop|gaming pc|pc build|tower pc|all[- ]in[- ]one pc|ordenador de sobremesa|ordinateur de bureau)\b|ڈیسک\s?ٹاپ/i],
  ['phone', /\b(phones?|smartphones?|mobiles?|iphone|galaxy [asz]\d+|samsung (galaxy )?[asmz]\d{2,3}|pixel \d|redmi|tel[eé]fono|celular|m[oó]vil|t[eé]l[eé]phone|smartphone)\b|موبائل|فون/i],
  ['headphones', /\b(head ?phones?|earbuds?|airpods|wh-?1000 ?xm\d|wf-?1000 ?xm\d|headsets?|earphones?|auriculares|casque|[eé]couteurs)\b|ہیڈ\s?فون/i],
  ['tablet', /\b(tablets?|ipad|tableta|tablette)\b|ٹیبلٹ/i],
  ['monitor', /\b(monitors?|moniteur)\b/i],
  ['camera', /\b(cameras?|dslr|mirrorless|c[aá]mara|appareil photo)\b|کیمرہ|کیمرا/i],
  ['tv', /\b(tvs?|television|smart tv|led tv|t[eé]l[eé]vision|televisor)\b/i],
  ['shoes', /\b(shoes?|sneakers?|kicks|trainers|joot[ae]|joote|zapatos|zapatillas|chaussures|baskets)\b|جوتے|جوتا/i],
  // Fragrance: generic words in five languages plus well-known fragrance lines, so "dupe for Dior Sauvage"
  // is understood as a perfume request even though the word "perfume" never appears.
  ['perfume', /\b(perfumes?|parfums?|fragrances?|colognes?|eau de (toilette|parfum|cologne)|edp|edt|attars?|ittars?|itr|khushbu|body mist|dior sauvage|sauvage|bleu de chanel|chanel (no\.? ?5|coco|chance|allure)|creed aventus|aventus|acqua di gi[oò]|tom ford (oud|noir|tobacco)|versace eros|ysl (y|libre|myslf)|jo malone|baccarat rouge|paco rabanne|invictus|one million)\b|خوشبو|عطر|پرفیوم/i],
  // Pet food: a pet species together with a food word ("food for my cat", "billi ka khana", "dog kibble").
  ['pet food', /\b(cats?|kittens?|dogs?|puppy|puppies|billi|kutt[ae]|gato|perro|chat|chien)\b.{0,40}\b(food|kibble|treats?|khana|comida|pienso|croquettes|nourriture)\b|\b(food|kibble|treats?|khana|comida|pienso|croquettes|nourriture)\b.{0,40}\b(cats?|kittens?|dogs?|puppy|puppies|billi|kutt[ae]|gato|perro|chat|chien)\b|بلی.{0,20}(کھانا|خوراک)|کتے.{0,20}(کھانا|خوراک)/i],
];

const SOFTWARE_WORDS = /android\s*studio|xcode|visual studio|vs ?code|photoshop|premiere|davinci|autocad|blender|unity|unreal|matlab|solidworks|اینڈرائیڈ\s?اسٹوڈیو/i;
const BEGINNER = /\b(new to|beginner|just starting|first time|learn(ing)?|novice|naya|nayi|seekh(na|ne|ta)|shuru|aprender|principiante|d[eé]butant|apprendre)\b|سیکھنے|سیکھنا|نیا|پہلی بار/i;
const PRO = /\b(professional|pro user|expert|advanced|for work|freelanc|profesional|professionnel)\b/i;
const CHEAP = /\b(cheap(est)?|affordable|budget|inexpensive|sasta|sasti|kam (qeemat|price)|econ[oó]mic[oa]|barat[oa]|abordable|pas cher|bon march[eé])\b|سستا|سستی|مناسب/i;
const CHEAPEST = /\b(cheapest|lowest price|sab se sasta|sabse sasta|m[aá]s barato|le moins cher)\b|سب سے سستا/i;
const CHEAPER = /\b(cheaper|less expensive|lower price|more affordable|kam price|is se sasta|aur sasta|zyada sasta|m[aá]s barat[oa]|moins cher)\b|اس سے سستا|مزید سستا/i;
const PREMIUM = /\b(premium|high[- ]end|best possible|top of the line|flagship|money is no object)\b/i;
const CLEAR_BUDGET = /\b(forget|ignore|remove|drop|no) (the |my )?budget\b|budget (hata|chhor|chor) do|sin presupuesto|olvida el presupuesto|oublie le budget|sans budget/i;
const COMPARE = /\b(compare|comparison|versus|vs\.?|which is better|kaunsa behtar|muqabla|comparar|comparer)\b/i;
const USED_OK = /\b(refurbished|renewed|used is (fine|ok)|second[- ]hand|pre-?owned|reacondicionado|reconditionn[eé]|purana (bhi )?chalega)\b/i;
const NEW_ONLY = /\b(new only|brand new|only new|sirf naya|nuevo solamente|neuf uniquement)\b/i;
// How an Android learner will run their apps. This decides the hardware: Android Studio alone needs 8 GB RAM and
// no dedicated GPU; the Emulator needs 16 GB RAM and (on Windows/Linux) a 4 GB VRAM GPU.
const ACCESSORY = /\b(cases?|covers?|chargers?|charging cable|cables?|screen protectors?|tempered glass|adapters?|stands?|holders?|mounts?|straps?|sleeves?|bags?|skins?|cartridges?|ink|blades?|keyboard cover)\b|ka charger|ki blade|کور|چارجر/i;
const VAGUE = /\b(help me (shop|find something|choose)|show me something|something (nice|good|cool)|anything|surprise me|kuch (acha|achha|bhi|dikhao)|koi cheez|algo bonito|lo que sea|quelque chose|n'importe quoi)\b/i;
const NO_PHONE = /\b(don'?t|do not|dont|doesn'?t) (have|own) (an? |any )?(android )?(phone|device|smartphone)|\bno (android )?(phone|smartphone)\b|without (an? |any )?(android )?(phone|smartphone)|phone nahi|phone nahin|mobile nahi|فون نہیں|no tengo (un |ningún )?(tel[eé]fono|m[oó]vil|celular)|sin (tel[eé]fono|m[oó]vil|celular)|je n'?ai pas de (t[eé]l[eé]phone|smartphone|portable)|sans (t[eé]l[eé]phone|smartphone)/i;
const NO_EMULATOR = /without (the |an |using (the )?)?emulator|no emulator|not (use|using|need) (the |an )?emulator|(own|my|real|physical|modern) (android )?(phone|device|smartphone)( to test| for testing| over usb)?|(have|got|own) an? (android )?(phone|smartphone)|usb debugging|device streaming|physical device|mere paas (android |apna )?(phone|mobile)|apne (phone|mobile) par|میرے پاس .{0,12}فون|اپنے فون|mi (propio )?(tel[eé]fono|m[oó]vil|celular)|tengo un (tel[eé]fono|m[oó]vil|celular)|dispositivo f[ií]sico|mon (propre )?(t[eé]l[eé]phone|smartphone)|j'?ai un (t[eé]l[eé]phone|smartphone)|appareil physique/i;
const EMULATOR = /emulat|ایمولیٹر|émulateur|emulador|virtual device|\bavd\b/i;

/** true = tests on a physical phone (no emulator), false = will use the Emulator, null = not stated. */
export function parseAndroidTesting(text: string): boolean | null {
  if (NO_PHONE.test(text)) return false; // checked first: "I don't have an Android phone" mentions a phone
  if (NO_EMULATOR.test(text)) return true;
  if (EMULATOR.test(text)) return false;
  return null;
}

const BRANDS = ['hp', 'dell', 'lenovo', 'asus', 'acer', 'apple', 'samsung', 'msi', 'microsoft', 'razer', 'sony', 'bose', 'jbl', 'xiaomi', 'huawei', 'google', 'lg', 'toshiba', 'gigabyte', 'alienware', 'anker', 'beats', 'sennheiser', 'oneplus', 'motorola', 'nokia', 'canon', 'nikon', 'fujifilm', 'realme', 'oppo', 'vivo', 'infinix', 'tecno'];
const COLORS: Record<string, string> = { black: 'black', kala: 'black', kaala: 'black', negro: 'black', noir: 'black', white: 'white', safed: 'white', blanco: 'white', blanc: 'white', blue: 'blue', neela: 'blue', azul: 'blue', bleu: 'blue', red: 'red', laal: 'red', rojo: 'red', rouge: 'red', silver: 'silver', grey: 'gray', gray: 'gray', pink: 'pink', green: 'green', gold: 'gold', titanium: 'titanium' };
const ORDINALS: Array<[number, RegExp]> = [
  [1, /\b(first|1st|pehla|pehli|pehle|primer[oa]?|premi[eè]re?|number one)\b|پہلا|پہلی/i],
  [2, /\b(second|2nd|dusra|doosra|dusri|doosri|segund[oa]|deuxi[eè]me|second wala)\b|دوسرا|دوسری/i],
  [3, /\b(third|3rd|teesra|tisra|teesri|tercer[oa]?|troisi[eè]me)\b|تیسرا|تیسری/i],
  [4, /\b(fourth|4th|chautha|cuart[oa]|quatri[eè]me)\b/i],
  [5, /\b(fifth|5th|panchwa|quint[oa]|cinqui[eè]me)\b/i],
];

export function detectLanguage(text: string): IntentV2['language'] {
  if (/[؀-ۿ]/.test(text)) return 'ur';
  const t = text.toLowerCase();
  const ru = (t.match(/\b(chahiye|chahye|hai|hain|ka|ki|ke|kya|mujhe|mere|mera|wala|wali|liye|kar|karna|batao|dikhao|nahi|acha|achi|sasta|tak|bhai|koi|hun|hoon|seekhne)\b/g) || []).length;
  const en = (t.match(/\b(the|a|for|i|want|need|with|and|under|my|is|to|in|of|laptop|phone)\b/g) || []).length;
  const es = (t.match(/\b(necesito|quiero|busco|una?|para|con|económica|computadora|portátil|aprender|barato|el|la|de|por|presupuesto|auriculares|regalo|teléfono|mi|tengo)\b/g) || []).length;
  const fr = (t.match(/\b(j'ai|besoin|je|veux|cherche|un|une|pour|avec|ordinateur|portable|abordable|apprendre|le|la|des|pas|casque|cadeau|téléphone|mon|ma)\b/g) || []).length;
  if (ru >= 2 && en >= 2) return 'mixed';
  if (ru >= 1 && ru >= es && ru >= fr) return en > ru ? 'mixed' : 'roman_ur';
  if (es >= 2 && es > fr && es >= en) return 'es';
  if (fr >= 2 && fr >= es && fr >= en) return 'fr';
  return 'en';
}

/** Map model category labels ("laptops", "smartphones", "notebook computers") to canonical categories. */
const CATEGORY_SYNONYMS: Array<[RegExp, string]> = [
  [/^(laptops?|notebooks?|notebook computers?|computers?|laptop computers?|gaming laptops?|macbooks?|chromebooks?|ultrabooks?|personal computers?)$/, 'laptop'],
  [/^(desktops?|desktop computers?|gaming pcs?|gaming desktops?|pcs?|all-in-ones?)$/, 'desktop'],
  [/^(phones?|smartphones?|mobile phones?|cell ?phones?|mobiles?|iphones?)$/, 'phone'],
  [/^(headphones?|earbuds?|headsets?|earphones?|wireless earbuds|audio)$/, 'headphones'],
  [/^(tablets?|ipads?|tablet computers?)$/, 'tablet'],
  [/^(monitors?|computer monitors?|displays?)$/, 'monitor'],
  [/^(cameras?|digital cameras?|dslrs?|mirrorless cameras?)$/, 'camera'],
  [/^(tvs?|televisions?|smart tvs?)$/, 'tv'],
];
export function normalizeCategory(label: string): string {
  const l = label.trim().toLowerCase();
  for (const [re, c] of CATEGORY_SYNONYMS) if (re.test(l)) return c;
  return l;
}

export function detectCategory(text: string): string | null {
  // "computer science" is a degree, not a product.
  const t = text.replace(/computer science|ciencias de la computaci[oó]n|informatique/gi, ' ');
  // "Case for Samsung Galaxy S24", "phone charger", "laptop stand": an accessory, not the device itself.
  if (ACCESSORY.test(t)) return null;
  for (const [cat, re] of CATEGORY_WORDS) if (re.test(t)) return cat;
  if (/\b(computer|pc|kampyutar|computadora|ordenador|ordinateur)\b|کمپیوٹر/i.test(t)) return 'laptop';
  return null;
}

/** Explicit spec constraints stated by the user (e.g. "16GB RAM", "512GB SSD", "Windows", "17 inch"). */
export function parseStatedConstraints(text: string): Constraint[] {
  const t = asciiDigits(text);
  const out: Constraint[] = [];
  const ram = t.match(/(\d{1,3})\s?gb\s*(?:of\s+)?(?:ram|memory|ddr\d?)\b|(?:ram|memory)\s*(?:of\s*)?(\d{1,3})\s?gb/i) || t.match(/\b(8|16|32|64)\s?gb\b(?!\s*(?:ssd|storage|hdd|rom|emmc|vram|gddr))/i);
  if (ram) out.push({ field: 'ram_gb', op: '>=', value: Number(ram[1] || ram[2]) });
  const st = t.match(/(\d+(?:\.\d)?)\s?(tb|gb)\s*(?:ssd|storage|hdd|nvme|rom)\b/i);
  if (st) out.push({ field: 'storage_gb', op: '>=', value: Number(st[1]) * (/tb/i.test(st[2]) ? 1024 : 1) });
  // Phones and tablets are sold by storage: "iPhone 15 Pro 256GB", "Samsung A55 8/256".
  const handheld = /\b(i?phones?|smartphones?|mobiles?|galaxy|pixel|redmi|samsung [a-z]?\d+|ipad|tablets?)\b/i.test(t);
  const pair = handheld ? t.match(/\b(\d{1,2})\s?\/\s?(64|128|256|512|1024)\b/) : null;
  if (pair) {
    if (!out.some(c => c.field === 'ram_gb')) out.push({ field: 'ram_gb', op: '>=', value: Number(pair[1]) });
    if (!st) out.push({ field: 'storage_gb', op: '>=', value: Number(pair[2]) });
  } else if (!st && handheld) {
    const ps = t.match(/\b(64|128|256|512)\s?gb\b|\b(1)\s?tb\b/i);
    if (ps) {
      const i = out.findIndex(c => c.field === 'ram_gb' && c.value === Number(ps[1])); // "256GB" on a phone is storage, not RAM
      if (i >= 0) out.splice(i, 1);
      out.push({ field: 'storage_gb', op: '>=', value: ps[1] ? Number(ps[1]) : 1024 });
    }
  }
  if (/\bssd\b/i.test(t)) out.push({ field: 'storage_type', op: '==', value: 'ssd' });
  const vram = t.match(/(\d{1,2})\s?gb\s*(?:vram|gddr\d?|graphics)/i);
  if (vram) out.push({ field: 'gpu_vram_gb', op: '>=', value: Number(vram[1]) });
  if (/\b(rtx|gtx|dedicated (gpu|graphics)|graphics card)\b/i.test(t)) out.push({ field: 'gpu_dedicated', op: '==', value: true });
  // A named GPU model ("RTX 4080") implies at least that model's graphics memory.
  const gpuModel = t.match(/\b(?:rtx|gtx|rx)\s?\d{4}(?:\s?ti)?\b/i);
  if (gpuModel && !vram) { const hit = GPU_MIN_VRAM.find(([re]) => re.test(gpuModel[0])); if (hit) out.push({ field: 'gpu_vram_gb', op: '>=', value: hit[1] }); }
  const scr = t.match(/(\d{2}(?:\.\d)?)\s?(?:"|”|''|-?\s?inch(?:es)?\b|-?in\b)/i);
  if (scr && Number(scr[1]) >= 10 && Number(scr[1]) <= 90) out.push({ field: 'screen_in', op: '~=', value: Number(scr[1]) });
  const hz = t.match(/(\d{2,3})\s?hz\b/i);
  if (hz) out.push({ field: 'refresh_hz', op: '>=', value: Number(hz[1]) });
  if (/\b(actually|i want|prefer|only|need|chahiye)?\s*windows\b/i.test(t) && !/not windows|no windows|windows nahi/i.test(t)) out.push({ field: 'os', op: '==', value: 'windows' });
  else if (/\b(mac ?os|macbook|apple laptop)\b/i.test(t)) out.push({ field: 'os', op: '==', value: 'macos' });
  else if (/\bchrome ?(os|book)\b/i.test(t)) out.push({ field: 'os', op: '==', value: 'chromeos' });
  if (/\bnot (a )?chromebook|no chromebook|chromebook nahi/i.test(t)) out.push({ field: 'os', op: '!=', value: 'chromeos' });
  if (/noise[- ]cancel|\banc\b/i.test(t)) out.push({ field: 'anc', op: '==', value: true });
  if (/\bwireless|bluetooth\b/i.test(t)) out.push({ field: 'wireless', op: '==', value: true });
  return out;
}

export function parseBrandExclusions(text: string): string[] {
  const t = text.toLowerCase();
  const out = new Set<string>();
  for (const b of BRANDS) {
    const re = new RegExp(`\\b(not|no|without|except|avoid|exclude|sin|pas de|sans)\\s+(an?\\s+)?${b}\\b|\\b${b}\\s+(nahi|nahin|na|mat|nai|not|no)\\b|\\b${b}\\s+\\w*\\s*(nahi|nahin)\\b`, 'i');
    if (re.test(t)) out.add(b);
  }
  return [...out];
}

export function parseBrandIncludes(text: string, excluded: string[]): string[] {
  const t = text.toLowerCase();
  return BRANDS.filter(b => !excluded.includes(b) && new RegExp(`\\b${b}\\b`).test(t)).slice(0, 3);
}

export function parseColors(text: string): string[] {
  const t = text.toLowerCase();
  return [...new Set(Object.entries(COLORS).filter(([w]) => new RegExp(`\\b${w}\\b`).test(t)).map(([, c]) => c))].slice(0, 3);
}

export function parseReferences(text: string): number[] {
  return ORDINALS.filter(([, re]) => re.test(text)).map(([n]) => n).slice(0, 3);
}

const STOP = /\b(i|need|want|a|an|the|for|to|use|it|in|on|my|me|please|with|good|best|am|is|new|this|software|learn|learning|that|can|run|which|some|any|looking|find|show|get|buy|under|below|budget|only|have|but|and|or|of|so|just|really|very|also|im|i'm|chahiye|mujhe|ke|liye|ka|ki|hai|koi|acha|aur|batao|dikhao|wala|seekhne|necesito|quiero|una?|para|aprender|j'ai|besoin|d'un|pour|apprendre)\b/gi;

/** Build a full IntentV2 from rules only. */
export function parseIntentFallback(raw: string, hasPrior: boolean): IntentV2 {
  const text = raw.slice(0, 600);
  // "I'll test on my own phone" while choosing a laptop is not a phone search.
  const testing = parseAndroidTesting(text);
  let category = hasPrior && testing != null ? null : detectCategory(text);
  if (category === 'phone' && testing != null && /android\s*studio|اینڈرائیڈ/i.test(text)) category = null; // the phone is the test device, not the purchase
  const software = (text.match(SOFTWARE_WORDS) || []).map(s => (/اینڈرائیڈ/.test(s) ? 'Android Studio' : s.replace(/\s+/g, ' ').trim()));
  const brandsExclude = parseBrandExclusions(text);
  const stated = parseStatedConstraints(text);
  const refs = parseReferences(text);
  const words = text.trim().split(/\s+/).length;
  const refinementCue = CHEAPER.test(text) || CLEAR_BUDGET.test(text) || brandsExclude.length > 0 || refs.length > 0 || /^(actually|also|and|but|now|instead|show|only|what about|how about|aur|bas|ab|sirf)\b/i.test(text.trim());
  const isRefinement = hasPrior && (refinementCue || (!category && words <= 10));
  const compare = COMPARE.test(text);
  const cleaned = asciiDigits(text).replace(/[$€£]\s?\d[\d.,]*|\d[\d.,]*\s?(k|lac|lakh|hazar|dollars|usd)\b/gi, ' ').replace(STOP, ' ').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  const searchQuery = (category ? [category, ...stated.filter(c => c.field === 'ram_gb').map(c => `${c.value}GB RAM`)].join(' ') : cleaned.split(' ').slice(0, 6).join(' ')) || 'popular products';
  // Without a known category the rules cannot name the product, but a message that names one ("Dell Inspiron
  // charger", "fridge for a 70cm space") is still a search, not a vague request. Only genuinely open requests ask.
  const vague = !category && (VAGUE.test(text) || cleaned.split(' ').filter(w => w.length > 2).length < 1);
  const family: IntentV2['primaryFamily'] = isRefinement ? 'refinement' : compare ? 'comparison' : software.length ? 'use_case' : stated.length ? 'spec_constrained' : CHEAP.test(text) ? 'budget_led' : vague ? 'vague_exploratory' : 'category_browse';
  return {
    version: INTENT_VERSION,
    primaryFamily: family,
    secondaryFamilies: [],
    category: category || (software.length ? 'laptop' : 'unknown'),
    productKind: category || software.length ? 'physical' : 'unknown',
    searchQuery: searchQuery.slice(0, 100),
    goal: text.slice(0, 200),
    useCases: [],
    software: software.slice(0, 3),
    skillLevel: BEGINNER.test(text) ? 'beginner' : PRO.test(text) ? 'pro' : 'unknown',
    recipient: { who: /\b(for my|gift|for (her|him)|ke liye gift|para mi|pour mon|pour ma)\b/i.test(text) ? 'other' : 'self', relation: null },
    hardConstraints: stated,
    softPreferences: CHEAP.test(text) ? ['affordable'] : [],
    brandsInclude: parseBrandIncludes(text, brandsExclude),
    brandsExclude,
    colors: parseColors(text),
    usedOk: USED_OK.test(text) ? true : NEW_ONLY.test(text) ? false : null,
    budgetRaw: null,
    ownFundsRaw: null,
    isRefinement,
    clearBudget: CLEAR_BUDGET.test(text),
    priceDirection: CHEAPER.test(text) ? 'cheaper' : PREMIUM.test(text) ? 'premium' : null,
    references: refs,
    rankingMode: CHEAPEST.test(text) ? 'cheapest_adequate' : null,
    noEmulator: parseAndroidTesting(text),
    language: detectLanguage(text),
    requestedAction: compare && refs.length >= 2 ? 'compare' : isRefinement ? 'refine' : vague && !software.length ? 'ask_clarifying' : 'find_options',
    missingCritical: [],
    followUpQuestion: null,
    confidence: 0.5,
    injectionSuspected: false,
  };
}
