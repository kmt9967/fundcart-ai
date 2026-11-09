// Product specification extraction from untrusted retailer data.
//
// Principles:
// - Never invent a value. A spec is either read from the listing (structured attributes, title, key
//   features, description) or left null ("unknown").
// - When sources disagree (e.g. title says 8GB RAM, features say 32GB), the field is marked as a
//   conflict and the LOWER value is used, so a conflicting listing can never pass a threshold by luck.
// - A small number of values are inferred from a well-known model name (e.g. a GPU model's minimum
//   VRAM). These are labelled `inferred` so the UI can say so.

export type SpecSource = 'attributes' | 'title' | 'features' | 'description' | 'inferred';

export type NumSpec = { value: number; max: number; conflict: boolean; source: SpecSource };
export type BoolSpec = { value: boolean; source: SpecSource };
export type StrSpec = { value: string; source: SpecSource };

export type Cpu = {
  label: string;
  vendor: 'intel' | 'amd' | 'apple' | 'qualcomm' | 'mediatek' | 'other';
  /** Intel generation (8 = 8th gen) when it can be read; null otherwise. */
  generation: number | null;
  suffix: string | null;
  /** Rough performance class 1 (entry/low-power) … 6 (enthusiast). */
  tier: number;
  /** Post-2017 x86 microarchitecture (Intel 8th gen+/Core Ultra/Core 3-7, AMD Ryzen) or Apple Silicon. */
  modern: boolean;
  arm: boolean;
  lowPower: boolean;
};

export type Specs = {
  kind: string | null; // canonical product kind from the category path, e.g. "laptop", "book"
  ramGB: NumSpec | null;
  storageGB: NumSpec | null;
  storageType: StrSpec | null; // ssd | hdd | emmc
  cpu: (Cpu & { source: SpecSource }) | null;
  gpuDedicated: BoolSpec | null;
  gpuVramGB: NumSpec | null;
  gpuLabel: string | null;
  os: StrSpec | null; // windows | macos | chromeos | linux | android | ios
  arm: BoolSpec | null;
  screenInches: NumSpec | null;
  refreshHz: NumSpec | null;
  anc: BoolSpec | null; // active noise cancellation
  wireless: BoolSpec | null;
  microphone: BoolSpec | null;
  interchangeableLens: BoolSpec | null;
  condition: StrSpec | null; // new | used | refurbished
  colors: string[];
};

export type SpecInput = {
  title: string;
  keyFeatures: string[];
  description: string;
  attributes: Record<string, string[]>;
  categoryPath: string[];
  condition: 'new' | 'used' | null;
};

const KIND_BY_SLUG: Array<[RegExp, string]> = [
  [/^(laptops|gaming-laptops|notebooks|chromebooks)$/, 'laptop'],
  [/^(desktop-computers|gaming-desktops|all-in-one-computers)$/, 'desktop'],
  [/^tablet-computers$/, 'tablet'],
  [/headphones|headsets|earbuds/, 'headphones'],
  [/^(cell-phones|mobile-phones|smartphones|unlocked-cell-phones)$/, 'phone'],
  [/monitors/, 'monitor'],
  [/cameras/, 'camera'],
  [/books|e-books|audiobooks/, 'book'],
  [/software/, 'software'],
  [/toys/, 'toy'],
  [/computer-components|computer-accessories|electronics-accessories|batteries/, 'accessory'],
  [/furniture|desks/, 'furniture'],
];

/** Canonical product kind from the Channel3 category path (leaf first). */
export function kindFromPath(path: string[]): string | null {
  for (const slug of [...path].reverse()) for (const [re, kind] of KIND_BY_SLUG) if (re.test(slug)) return kind;
  return null;
}

type Hit = { v: number; src: SpecSource };

function numSpec(hits: Hit[]): NumSpec | null {
  if (!hits.length) return null;
  // Prefer explicit sources over the free-text description when both exist.
  const explicit = hits.filter(h => h.src !== 'description');
  const use = explicit.length ? explicit : hits;
  const vals = [...new Set(use.map(h => h.v))];
  const min = Math.min(...vals); const max = Math.max(...vals);
  const src = use.find(h => h.v === min)!.src;
  return { value: min, max, conflict: vals.length > 1, source: src };
}

function texts(p: SpecInput): Array<[SpecSource, string]> {
  return [['title', p.title], ['features', p.keyFeatures.join(' ; ')], ['description', p.description]];
}

function attr(p: SpecInput, ...keys: string[]): string[] {
  return keys.flatMap(k => p.attributes[k] || []);
}

function toGB(n: number, unit: string): number { return /tb/i.test(unit) ? n * 1024 : n; }

// --- RAM --------------------------------------------------------------------------------------
// Matches "16GB RAM", "16 GB DDR4", "16GB LPDDR5x", "System Memory (RAM)16 gigabytes", "8G Ram".
// Excludes graphics memory (GDDR) and storage words.
const RAM_RE = /(\d{1,3})\s?(?:GB|G|gigabytes?)\b\s*(?:of\s+)?(?:high[- ]speed\s+|high[- ]bandwidth\s+)?(?:(?:LP)?DDR\d\w*\s*(?:SO-?DIMM\s*)?(?:\d{4}\s?(?:MHz|MT\/s)\s*)?)?(?:RAM|memory|unified memory)\b|(\d{1,3})\s?GB\s+(?:LP)?DDR\d(?!\w*\s*(?:graphics|vram))|(?:RAM|memory)\)?\s*:?\s*(\d{1,3})\s?(?:GB|gigabytes)/gi;

function ramHits(p: SpecInput): Hit[] {
  const hits: Hit[] = [];
  for (const a of attr(p, 'ram', 'memory', 'system-memory', 'ram-size')) {
    const m = a.match(/(\d{1,3})\s?GB/i); if (m) hits.push({ v: Number(m[1]), src: 'attributes' });
  }
  for (const [src, t] of texts(p)) {
    for (const m of t.matchAll(RAM_RE)) {
      const before = t.slice(Math.max(0, m.index! - 12), m.index!);
      const around = t.slice(m.index!, m.index! + m[0].length + 14);
      if (/GDDR|VRAM|graphics/i.test(around) || /expandable|up to|upgradable|max(imum)?/i.test(before)) continue;
      const n = Number(m[1] || m[2] || m[3]);
      if (n >= 1 && n <= 256) hits.push({ v: n, src });
    }
  }
  // Two RAM values in the attributes alone with no textual confirmation are ambiguous (often storage leaked in).
  return hits;
}

// --- Storage ----------------------------------------------------------------------------------
const STORAGE_RE = /(\d+(?:\.\d+)?)\s?(TB|GB)\b\s*(?:of\s+)?(?:(?:PCIe|NVMe|M\.2|Gen\s?\d|SATA|high[- ]speed|solid[- ]state)\s*)*(SSD|HDD|eMMC|UFS|storage|solid state drive|hard drive|ROM|flash)/gi;

function storage(p: SpecInput): { size: NumSpec | null; type: StrSpec | null } {
  const hits: Hit[] = []; let type: StrSpec | null = null;
  for (const a of attr(p, 'storage-capacity', 'hard-drive-capacity', 'storage')) {
    const m = a.match(/(\d+(?:\.\d+)?)\s?(TB|GB)/i); if (m) hits.push({ v: toGB(Number(m[1]), m[2]), src: 'attributes' });
  }
  for (const [src, t] of texts(p)) {
    for (const m of t.matchAll(STORAGE_RE)) {
      // Only look at the same list item (stop at "+", ",", ";", "(").
      const after = t.slice(m.index! + m[0].length, m.index! + m[0].length + 22).split(/[+,;(|]/)[0];
      const before = t.slice(Math.max(0, m.index! - 14), m.index!).split(/[,;(|]/).pop() || '';
      if (/dock|docking|external|cloud|card/i.test(after + before) || /\+\s*$/.test(before)) continue; // bundled docks / cloud
      if (/expandable|up to|upgradable/i.test(before)) continue;
      hits.push({ v: toGB(Number(m[1]), m[2]), src });
      const w = m[3].toLowerCase();
      if (!type) type = { value: w === 'hdd' || w === 'hard drive' ? 'hdd' : w === 'emmc' || w === 'ufs' || w === 'flash' ? 'emmc' : /ssd|solid/.test(w) ? 'ssd' : '', source: src };
      if (type && !type.value) type = null;
    }
  }
  const installed = attr(p, 'storage-drive-type-installed').join(' ');
  if (!type && /ssd|solid/i.test(installed)) type = { value: 'ssd', source: 'attributes' };
  else if (!type && /hard disk|hdd/i.test(installed)) type = { value: 'hdd', source: 'attributes' };
  if (!type) for (const [src, t] of texts(p)) { if (/\bSSD\b|solid[- ]state/i.test(t)) { type = { value: 'ssd', source: src }; break; } if (/\beMMC\b/i.test(t)) { type = { value: 'emmc', source: src }; break; } }
  // Storage sizes legitimately vary by configuration; keep the smallest as the conservative value.
  return { size: numSpec(hits.filter(h => h.v >= 16 && h.v <= 16384)), type };
}

// --- CPU --------------------------------------------------------------------------------------
export function parseCpu(text: string): Cpu | null {
  const t = text.replace(/®|™|\(R\)|\(TM\)/g, '');
  let m: RegExpMatchArray | null;

  if ((m = t.match(/\bApple\s+M([1-6])(?:\s+(Pro|Max|Ultra))?\b/i)) || (m = t.match(/\bM([1-6])(?:\s+(Pro|Max|Ultra))?\s+(?:chip|processor)\b/i))
    || (/\b(macbook|imac|mac\s?mini|mac\s?studio)\b/i.test(t) && (m = t.match(/\bM([1-6])(?:\s+(Pro|Max|Ultra))?\b/)))) {
    const gen = Number(m[1]); const variant = (m[2] || '').toLowerCase();
    const tier = variant === 'max' || variant === 'ultra' ? 6 : variant === 'pro' ? 5 : gen >= 3 ? 5 : 4;
    return { label: `Apple M${gen}${m[2] ? ' ' + m[2] : ''}`, vendor: 'apple', generation: gen, suffix: m[2] || null, tier, modern: true, arm: true, lowPower: false };
  }
  if ((m = t.match(/\bSnapdragon\s*(X\d?\s*(?:Elite|Plus)?|\w+)/i))) {
    return { label: `Qualcomm Snapdragon ${m[1].trim()}`, vendor: 'qualcomm', generation: null, suffix: null, tier: 4, modern: false, arm: true, lowPower: false };
  }
  if ((m = t.match(/\bMediaTek\s*(\w+)?/i)) || (m = t.match(/\b(Kompanio\s*\w+)/i))) {
    return { label: `MediaTek ${m[1] || ''}`.trim(), vendor: 'mediatek', generation: null, suffix: null, tier: 1, modern: false, arm: true, lowPower: true };
  }
  if ((m = t.match(/\bCore\s*Ultra\s*([579])\s*[- ]?\s*(\d{3})([A-Z]{0,2})\b/i)) || (m = t.match(/\bUltra\s*([579])\s*[- ]?\s*(\d{3})([A-Z]{0,2})\b/i)) || (m = t.match(/\bCore\s*Ultra\s*U?([579])\b()()/i))) {
    const cls = Number(m[1]); const suffix = (m[3] || '').toUpperCase() || null;
    const tier = cls === 9 ? 6 : suffix && /^H/.test(suffix) ? 5 : 4;
    return { label: `Intel Core Ultra ${cls}${m[2] ? ' ' + m[2] + (suffix || '') : ''}`, vendor: 'intel', generation: null, suffix, tier, modern: true, arm: false, lowPower: suffix === 'U' };
  }
  if ((m = t.match(/\bCore\s*([357])\s+(\d{3})([A-Z]{0,2})\b/i))) {
    const cls = Number(m[1]); const suffix = (m[3] || '').toUpperCase() || null;
    const tier = suffix && /^H/.test(suffix) ? 5 : cls >= 5 ? 4 : 3;
    return { label: `Intel Core ${cls} ${m[2]}${suffix || ''}`, vendor: 'intel', generation: null, suffix, tier, modern: true, arm: false, lowPower: suffix === 'U' };
  }
  if ((m = t.match(/\bi([3579])[- ]?(\d{4,5})([A-Z]{0,2})\d?\b/i))) {
    const cls = Number(m[1]); const num = m[2]; const suffix = (m[3] || '').toUpperCase() || null;
    // i7-10875H / i5-13420H (5 digits) and i5-1135G7 / i5-1334U (4 digits starting with 1x) are 10th–14th gen.
    const generation = num.length === 5 || (num[0] === '1' && Number(num.slice(0, 2)) >= 10) ? Number(num.slice(0, 2)) : Number(num[0]);
    return intelCore(cls, generation, suffix);
  }
  if ((m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)\s*Gen(?:eration)?\.?\s*(?:Intel\s*)?(?:Core\s*)?(?:\d+-Core\s*)?i([3579])\b/i))) {
    return intelCore(Number(m[2]), Number(m[1]), null);
  }
  if ((m = t.match(/\bCore\s*i([3579])\b.{0,30}?\b(\d{1,2})(?:st|nd|rd|th)\s*Gen/i))) {
    return intelCore(Number(m[1]), Number(m[2]), null);
  }
  if ((m = t.match(/\bRyzen\s*(?:AI\s*)?([3579])\s*(?:PRO\s*)?(\d{3,4})?([A-Z]{0,2})\b/i))) {
    const cls = Number(m[1]); const suffix = (m[3] || '').toUpperCase() || null;
    const tier = cls === 9 ? 6 : cls === 3 ? 3 : suffix && /^H/.test(suffix) ? 5 : 4;
    return { label: `AMD Ryzen ${cls}${m[2] ? ' ' + m[2] + (suffix || '') : ''}`, vendor: 'amd', generation: null, suffix, tier, modern: true, arm: false, lowPower: suffix === 'U' };
  }
  if ((m = t.match(/\b(?:Intel\s*)?(?:Alder Lake[- ])?(?:Processor\s*)?(N\d{2,4})\b/)) || (m = t.match(/\b(Celeron|Pentium|Atom)\b\s*(\w+)?/i)) || (m = t.match(/\b(Athlon|A\d{1,2}-\d{4})\b/i))) {
    return { label: `${/^N\d/.test(m[1]) ? 'Intel ' : ''}${m[1]}${m[2] ? ' ' + m[2] : ''}`, vendor: /athlon|^A\d/i.test(m[1]) ? 'amd' : 'intel', generation: null, suffix: null, tier: 1, modern: false, arm: false, lowPower: true };
  }
  if ((m = t.match(/\bCore\s*i([3579])\b/i)) || (m = t.match(/\bIntel\s+i([3579])\b/i))) {
    // Class known, generation not stated: cannot confirm the microarchitecture.
    return { label: `Intel Core i${m[1]} (generation not listed)`, vendor: 'intel', generation: null, suffix: null, tier: Number(m[1]) >= 5 ? 3 : 2, modern: false, arm: false, lowPower: false };
  }
  return null;
}

function intelCore(cls: number, generation: number, suffix: string | null): Cpu {
  const modern = generation >= 8;
  let tier = !modern ? 2 : cls === 3 ? 3 : suffix && /^H/.test(suffix) ? (cls >= 7 && /HX/.test(suffix) ? 6 : 5) : 4;
  if (cls === 9 && modern) tier = 6;
  const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
  return { label: `Intel Core i${cls}${generation ? ` (${ord(generation)} gen)` : ''}${suffix ? ` ${suffix}-series` : ''}`, vendor: 'intel', generation, suffix, tier, modern, arm: false, lowPower: suffix === 'U' || suffix === 'Y' };
}

/** CPU generation can't be known from "Core i5" alone; a listing that names the class only is `modern: false` (unverified). */
function cpuSpec(p: SpecInput): (Cpu & { source: SpecSource }) | null {
  const fam = attr(p, 'processor-family', 'processor', 'cpu-model').join(' ');
  const sources: Array<[SpecSource, string]> = [['title', p.title], ['features', p.keyFeatures.join(' ; ')], ['description', p.description], ['attributes', fam]];
  let fallback: (Cpu & { source: SpecSource }) | null = null;
  for (const [src, t] of sources) {
    const c = parseCpu(t);
    if (!c) continue;
    if (c.label.includes('generation not listed')) { fallback ||= { ...c, source: src }; continue; }
    return { ...c, source: src };
  }
  return fallback;
}

// --- GPU --------------------------------------------------------------------------------------
// Minimum VRAM shipped with common laptop GPU models (used only when the listing does not state VRAM).
export const GPU_MIN_VRAM: Array<[RegExp, number]> = [
  [/RTX\s?50[89]0/i, 12], [/RTX\s?5070/i, 8], [/RTX\s?50[56]0/i, 8],
  [/RTX\s?40[89]0/i, 12], [/RTX\s?40[67]0/i, 8], [/RTX\s?4050/i, 6],
  [/RTX\s?30[789]0/i, 8], [/RTX\s?3060/i, 6], [/RTX\s?3050/i, 4], [/RTX\s?2050/i, 4],
  [/RTX\s?20[678]0/i, 6], [/GTX\s?16[56]0/i, 4], [/GTX\s?1050/i, 2],
  [/RX\s?7[67]00[MS]?/i, 8], [/RX\s?6[5-8]00[MS]/i, 4],
];

function gpu(p: SpecInput): { dedicated: BoolSpec | null; vram: NumSpec | null; label: string | null } {
  let label: string | null = null; let dedicated: BoolSpec | null = null; const vramHits: Hit[] = [];
  for (const [src, t] of texts(p)) {
    const g = t.match(/\b(?:NVIDIA\s*)?(?:GeForce\s*)?(RTX\s?\d{4}(?:\s?Ti)?|GTX\s?\d{3,4}(?:\s?Ti)?)\b|\bRadeon\s*(RX\s?\d{4}[MS]?)\b|\bArc\s*(A\d{3}M)\b/i);
    if (g && !label) { label = (g[1] || g[2] || g[3]).replace(/\s+/g, ' '); dedicated = { value: true, source: src }; }
    for (const m of t.matchAll(/(\d{1,2})\s?GB\s*(?:of\s+)?(?:dedicated\s+)?(?:GDDR\d\w*|VRAM|dedicated|graphics memory)/gi)) vramHits.push({ v: Number(m[1]), src });
    for (const m of t.matchAll(/(?:RTX|GTX|RX)\s?\d{4}\w*\s*(?:Laptop GPU\s*)?(?:with\s*)?\(?(\d{1,2})\s?GB/gi)) vramHits.push({ v: Number(m[1]), src });
  }
  const types = attr(p, 'graphics-card-type');
  if (!dedicated && types.length) {
    if (types.some(x => /dedicated|discrete/i.test(x)) && !types.some(x => /integrated/i.test(x))) dedicated = { value: true, source: 'attributes' };
    else if (types.every(x => /integrated/i.test(x))) dedicated = { value: false, source: 'attributes' };
  }
  if (!dedicated) for (const [src, t] of texts(p)) if (/\b(Iris\s?Xe|UHD Graphics|Intel Graphics|Arc Graphics|Radeon\s+(?:Vega|Graphics|\d{3}M)|integrated graphics|Adreno)\b/i.test(t)) { dedicated = { value: false, source: src }; break; }
  let vram = numSpec(vramHits.filter(h => h.v >= 1 && h.v <= 48));
  if (!vram && label) { const hit = GPU_MIN_VRAM.find(([re]) => re.test(label!)); if (hit) vram = { value: hit[1], max: hit[1], conflict: false, source: 'inferred' }; }
  if (dedicated?.value === false) vram = null;
  return { dedicated, vram, label };
}

// --- OS / misc --------------------------------------------------------------------------------
function os(p: SpecInput, cpu: Cpu | null): StrSpec | null {
  const a = attr(p, 'operating-system').join(' ').toLowerCase();
  const fromText = (t: string): string | null =>
    /chrome\s?os|chromebook/i.test(t) ? 'chromeos' : /\bmacos\b|\bmacbook\b|\bimac\b|\bmac mini\b/i.test(t) ? 'macos'
      : /\bwindows\b/i.test(t) ? 'windows' : /\bandroid\s?\d{0,2}(\.\d)?\b(?!\s*studio)/i.test(t) ? 'android'
        : /\bipad\s?os\b|\bios\b/i.test(t) ? 'ios' : /\b(ubuntu|linux)\b/i.test(t) ? 'linux' : null;
  // Title/features beat the attribute (attributes sometimes default to Windows).
  for (const [src, t] of texts(p).slice(0, 2)) { const v = fromText(t); if (v) return { value: v, source: src }; }
  if (a) { const v = fromText(a); if (v) return { value: v, source: 'attributes' }; }
  if (cpu?.vendor === 'apple') return { value: 'macos', source: 'inferred' };
  const d = fromText(p.description); return d ? { value: d, source: 'description' } : null;
}

function screen(p: SpecInput): NumSpec | null {
  const hits: Hit[] = [];
  for (const [src, t] of texts(p)) for (const m of t.matchAll(/(\d{1,2}(?:\.\d)?)\s?(?:"|”|''|-?\s?inch(?:es)?\b|-?in\b)/gi)) {
    const v = Number(m[1]); if (v >= 5 && v <= 49) hits.push({ v, src });
  }
  return numSpec(hits.slice(0, 3));
}

function flag(p: SpecInput, yes: RegExp, no?: RegExp, attrKeys: string[] = []): BoolSpec | null {
  for (const v of attr(p, ...attrKeys)) { if (no && no.test(v)) return { value: false, source: 'attributes' }; if (yes.test(v)) return { value: true, source: 'attributes' }; }
  for (const [src, t] of texts(p)) { if (no && no.test(t)) return { value: false, source: src }; if (yes.test(t)) return { value: true, source: src }; }
  return null;
}

/** Extract specs from a normalized product. Pure and deterministic (unit-tested). */
export function extractSpecs(p: SpecInput): Specs {
  const cpu = cpuSpec(p);
  const st = storage(p);
  const g = gpu(p);
  const ramHitsList = ramHits(p);
  const osSpec = os(p, cpu);
  const conditionText = `${p.title} ${p.keyFeatures.join(' ')}`;
  const condition: StrSpec | null = /\b(renewed|refurbished|refurb)\b/i.test(conditionText) ? { value: 'refurbished', source: 'title' }
    : /\b(pre-?owned|used)\b/i.test(p.title) ? { value: 'used', source: 'title' }
      : p.condition ? { value: p.condition, source: 'attributes' } : null;
  return {
    kind: kindFromPath(p.categoryPath),
    ramGB: numSpec(ramHitsList),
    storageGB: st.size,
    storageType: st.type,
    cpu,
    gpuDedicated: g.dedicated,
    gpuVramGB: g.vram,
    gpuLabel: g.label,
    os: osSpec,
    arm: cpu ? { value: cpu.arm, source: cpu.source } : null,
    screenInches: screen(p),
    refreshHz: (() => { const hits: Hit[] = []; for (const [src, t] of texts(p)) for (const m of t.matchAll(/(\d{2,3})\s?Hz\b/gi)) { const v = Number(m[1]); if (v >= 30 && v <= 540) hits.push({ v, src }); } return hits.length ? { value: Math.max(...hits.map(h => h.v)), max: Math.max(...hits.map(h => h.v)), conflict: false, source: hits[0].src } : null; })(),
    anc: flag(p, /active noise cancel|\bANC\b|noise[- ]cancell?ing/i, /passive noise|no noise cancel/i, ['headphone-features', 'audio-features']),
    wireless: flag(p, /wireless|bluetooth/i, /\bwired only\b/i, ['connectivity', 'connection-type']),
    microphone: flag(p, /\bmic(rophone)?s?\b/i),
    interchangeableLens: flag(p, /interchangeable lens|DSLR|mirrorless|lens kit|EF-S|RF-S|\bE-mount\b|Z-mount/i),
    condition,
    colors: attr(p, 'color', 'colour').map(c => c.toLowerCase()).slice(0, 6),
  };
}
