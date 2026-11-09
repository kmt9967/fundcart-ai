// Budget / money parsing in code (never by the model).
// Handles "$700", "700 dollars", "under 700$", "1.5 lac", "2 lakh", "1 crore", "50 hazar", "50k",
// "dhai hazar" (2,500), "Rs 5000", "PKR 80,000", "€500", "500 euros", "between 1.5 lac and 2 lac".
// Returns minor units (cents / paisa) plus the detected currency. Amounts are only *applied* as a USD
// budget when the currency is USD (the live catalog is priced in USD); other currencies are kept and
// shown back to the user instead of being silently converted with an unverified exchange rate.

export type ParsedMoney = { minor: number; currency: 'USD' | 'PKR' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | null };
export type ParsedBudget = { maxMinor: number | null; minMinor: number | null; currency: ParsedMoney['currency']; raw: string };

const URDU_FRACTIONS: Record<string, number> = { sawa: 1.25, derh: 1.5, dedh: 1.5, dhai: 2.5, adhai: 2.5, sarhe: 0.5 };
const URDU_NUMBERS: Record<string, number> = { ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10, bees: 20, pachas: 50, pachaas: 50 };
const DIGITS_UR = '۰۱۲۳۴۵۶۷۸۹';
const DIGITS_AR = '٠١٢٣٤٥٦٧٨٩';

/** Convert Urdu/Arabic-Indic digits to ASCII. */
export function asciiDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, d => String(DIGITS_UR.indexOf(d) >= 0 ? DIGITS_UR.indexOf(d) : DIGITS_AR.indexOf(d)));
}

function detectCurrency(s: string): ParsedMoney['currency'] {
  if (/\$|usd|dollars?|dólares?/i.test(s)) return /cad|canadian/i.test(s) ? 'CAD' : /aud|australian/i.test(s) ? 'AUD' : 'USD';
  if (/€|eur\b|euros?/i.test(s)) return 'EUR';
  if (/£|gbp|pounds?/i.test(s)) return 'GBP';
  if (/\brs\.?\s?\d|\bpkr\b|rupees?|روپے|lakh|lac\b|crore|karor|hazar|hazaar|ہزار|لاکھ/i.test(s)) return 'PKR';
  return null;
}

/** Parse one amount expression to minor units. Returns null when there is no number. */
export function parseAmount(text: string): ParsedMoney | null {
  const s = asciiDigits(text.toLowerCase()).replace(/(\d),(\d{2,3})/g, '$1$2').replace(/(\d),(\d{2,3})/g, '$1$2');
  const currency = detectCurrency(s);
  let m = s.match(/(\d+(?:\.\d+)?)\s*(crore|karor|کروڑ)/);
  if (m) return { minor: Math.round(Number(m[1]) * 1e7 * 100), currency: currency || 'PKR' };
  m = s.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|lacs|lakhs|لاکھ)\b/);
  if (m) return { minor: Math.round(Number(m[1]) * 1e5 * 100), currency: currency || 'PKR' };
  m = s.match(/(\d+(?:\.\d+)?)\s*(hazar|hazaar|ہزار|thousand|mil)\b/);
  if (m) return { minor: Math.round(Number(m[1]) * 1000 * 100), currency: currency || (/thousand|mil/.test(m[2]) ? null : 'PKR') };
  m = s.match(/\b(sawa|derh|dedh|dhai|adhai)\s+(hazar|hazaar|lakh|lac)\b/);
  if (m) return { minor: Math.round(URDU_FRACTIONS[m[1]] * (m[2].startsWith('h') ? 1000 : 1e5) * 100), currency: currency || 'PKR' };
  m = s.match(/\b(ek|do|teen|chaa?r|paa?nch|chhe|che|saat|aath|nau|das|bees|pachaa?s)\s+(hazar|hazaar|lakh|lac)\b/);
  if (m) return { minor: Math.round(URDU_NUMBERS[m[1]] * (m[2].startsWith('h') ? 1000 : 1e5) * 100), currency: currency || 'PKR' };
  m = s.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (m) return { minor: Math.round(Number(m[1]) * 1000 * 100), currency };
  m = s.match(/(\d+(?:\.\d{1,2})?)/);
  if (m) return { minor: Math.round(Number(m[1]) * 100), currency };
  return null;
}

const BUDGET_CUES = /(under|below|less than|max(?:imum)?|budget|up to|upto|within|no more than|at most|tak\b|se zyada nahi|se kam|ke andar|menos de|hasta|presupuesto|moins de|jusqu'?à|budget de|maximum|حد|تک|بجٹ)/i;

/**
 * Find a budget in a message. Prefers amounts next to budget cues; supports ranges
 * ("between X and Y", "X to Y", "X se Y").
 */
export function parseBudget(text: string): ParsedBudget | null {
  const s = asciiDigits(text);
  const range = s.match(/(?:between|from|entre|de)\s+([^\s].{0,25}?)\s+(?:and|to|y|à|a|se|-)\s+([^\s].{0,25}?)(?=[,.;!?]|$|\s(?:for|para|pour|ke|wala))/i)
    || s.match(/(\$?\s?\d[\d.,]*\s*(?:k|lac|lakh|hazar|dollars?|usd)?)\s*(?:-|to|se)\s*(\$?\s?\d[\d.,]*\s*(?:k|lac|lakh|hazar|dollars?|usd)?)/i);
  if (range) {
    const a = parseAmount(range[1]); const b = parseAmount(range[2]);
    if (a && b) {
      const cur = a.currency || b.currency || detectCurrency(s);
      const unitB = /lac|lakh/i.test(range[2]) && !/lac|lakh/i.test(range[1]) && a.minor < 1000 ? { minor: Math.round(parseFloat(asciiDigits(range[1])) * 1e7), currency: cur } : a;
      return { minMinor: Math.min(unitB.minor, b.minor), maxMinor: Math.max(unitB.minor, b.minor), currency: cur, raw: range[0].trim().slice(0, 60) };
    }
  }
  // Amount expressions: currency symbols, number words or numbers followed by units.
  const re = /(?:\$|€|£|rs\.?|pkr|usd)\s?\d[\d.,]*(?:\s?(?:k|lac|lakh|crore|hazar))?|\d[\d.,]*\s?(?:(?:k|lac|lakhs?|lacs|crore|hazar|hazaar|thousand|dollars?|dólares|euros?|usd|pkr|rupees?)\b|\$|€|ہزار|لاکھ)|\b(?:sawa|derh|dedh|dhai|adhai|ek|do|teen|chaa?r|paa?nch|das|bees|pachaa?s)\s+(?:hazar|hazaar|lakh|lac)\b|\d{2,7}(?:\.\d{1,2})?/gi;
  const hits = [...s.matchAll(re)].map(m => ({ text: m[0], index: m.index! }))
    .filter(h => !/^\d+(?:gb|tb|hz|mp|inch)/i.test(s.slice(h.index, h.index + h.text.length + 4).replace(/\s/g, '')));
  const candidates: Array<{ text: string; index: number; marked: boolean; cued: boolean }> = [];
  for (const h of hits) {
    const around = s.slice(Math.max(0, h.index - 30), h.index + h.text.length + 30);
    const before = s.slice(Math.max(0, h.index - 12), h.index);
    const after = s.slice(h.index + h.text.length, h.index + h.text.length + 10);
    if (/^\s?(gb|tb|hz|mp|mah|w\b|cm|mm|inch|in\b|"|”|years?|saal|yo\b|ft|'|p\b|tv|video|footage|display|monitor|screen|resolution|ultra hd|uhd|hdr)/i.test(after)) continue; // specs, ages, sizes, "4k tv"
    if ((/(rtx|gtx|rx|radeon|ryzen\s?\d?|core\s?i?\d?|i[3579]|galaxy\s?[a-z]?|iphone|pixel|series|gen|model|no\.?|corolla|size)[\s-]?$/i.test(before) || /[a-z]-?$/i.test(before)) && !/([$€£]|rs\.?)\s?$/i.test(before)) continue; // model numbers (RTX 4080, S24, i5-1335U)
    if (/(have|i've got|saved|only got|mere paas|mery pas|tengo|j'ai)/i.test(s.slice(Math.max(0, h.index - 25), h.index))) continue; // own funds, not budget
    const marked = /[$€£]|rs|pkr|usd|dollar|dólar|euro|lac|lakh|hazar|crore|thousand|k$|ہزار|لاکھ/i.test(h.text);
    if (/^\d{1,2}$/.test(h.text) && !marked) continue; // tiny bare numbers are rarely budgets
    const cued = BUDGET_CUES.test(around);
    if (marked || cued) candidates.push({ ...h, marked, cued });
  }
  // Prefer amounts with a currency/unit next to a budget cue, then any currency-marked amount, then a cued bare number.
  const best = candidates.find(c => c.marked && c.cued) || candidates.find(c => c.marked) || candidates.find(c => c.cued) || null;
  if (!best) return null;
  const amt = parseAmount(best.text);
  if (!amt || amt.minor <= 0) return null;
  return { maxMinor: amt.minor, minMinor: null, currency: amt.currency || detectCurrency(s), raw: best.text.trim().slice(0, 60) };
}

/** Money the user says they already have ("I only have $200", "mere paas 20 hazar hain"). */
export function parseOwnFunds(text: string): ParsedMoney | null {
  const s = asciiDigits(text);
  const m = s.match(/(?:only have|i have|i've got|i got|saved(?: up)?|have saved|only got|mere paas|mery pas|mere pas|tengo|j'ai|میرے پاس)\s*(?:only\s*|sirf\s*)?((?:\$|€|£|rs\.?|pkr)?\s?\d[\d.,]*\s?(?:k|lac|lakh|hazar|dollars?|usd|euros?)?)/i);
  if (!m) return null;
  return parseAmount(m[1]);
}
