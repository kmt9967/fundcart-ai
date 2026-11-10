// Campaign content review (deterministic rules). Produces a risk score and reasons; the route decides
// whether a campaign goes live (sandbox), waits for a moderator, or is refused. The AI never sets
// verification, urgency or moderation outcomes. Personal data is scrubbed before publishing.

export type ModerationReason =
  | 'personal_info_removed' | 'contact_or_payment_redirect' | 'external_links' | 'spam_pattern' | 'shouting'
  | 'unverifiable_medical_claim' | 'false_verification_claim' | 'charity_or_tax_claim' | 'guarantee_claim'
  | 'urgency_pressure' | 'luxury_framing' | 'child_details' | 'abusive_language' | 'duplicate_content'
  | 'velocity' | 'no_suitability_check' | 'high_amount' | 'premium_over_adequate' | 'injection_text';

export type ModerationResult = { score: number; reasons: ModerationReason[]; title: string; story: string; block: boolean };

const WEIGHTS: Record<ModerationReason, number> = {
  personal_info_removed: 1, contact_or_payment_redirect: 4, external_links: 3, spam_pattern: 4, shouting: 1,
  unverifiable_medical_claim: 2, false_verification_claim: 5, charity_or_tax_claim: 3, guarantee_claim: 2,
  urgency_pressure: 1, luxury_framing: 2, child_details: 2, abusive_language: 5, duplicate_content: 4,
  velocity: 3, no_suitability_check: 1, high_amount: 2, premium_over_adequate: 2, injection_text: 5,
};

/** Score at or above which a campaign waits for a moderator instead of going live. */
export const REVIEW_THRESHOLD = 4;
/** Reasons that refuse publication outright. */
const BLOCKING: ModerationReason[] = ['abusive_language', 'injection_text', 'false_verification_claim'];

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d[\s().-]?){9,15}\d/g;
const CNIC = /\b\d{5}-?\d{7}-?\d\b/g;           // Pakistani national ID
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const ADDRESS = /\b(house|flat|apartment|apt|street|st\.|road|rd\.|block|sector|mohalla|gali|makan)\s*(no\.?|#|number)?\s*\d+[a-z]?\b/gi;
const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+|\b\S+\.(com|net|org|pk|io|ly|me)\/\S*/gi;
const REDIRECT = /\b(whats ?app|telegram|signal|jazz ?cash|easypaisa|venmo|cash ?app|zelle|western union|bank transfer|send (money|cash) (to|directly)|crypto|bitcoin|usdt|btc|eth wallet|gift cards?)\b/i;
const SPAM = /(\b(\w+)\b)(\s+\2\b){3,}|(.)\4{6,}|\b(earn|win|free money|investment|profit|double your|lottery|casino|forex|mlm)\b/i;
const MEDICAL = /\b(cancer|tumou?r|chemo|dying|terminal|surgery|kidney|transplant|icu|heart attack|leukemia|hiv)\b|کینسر|آپریشن/i;
const VERIFIED = /\b(verified|approved by fundcart|fundcart (approved|verified|endorsed)|officially (verified|approved)|kyc (done|passed)|100% genuine)\b/i;
const CHARITY = /\b(tax[- ]deductible|registered charity|non-?profit|zakat[- ]eligible|charitable donation receipt|501\(c\))\b/i;
const GUARANTEE = /\b(guaranteed|guarantee|risk[- ]free|100% safe|paypal (guarantees|protected))\b/i;
const URGENCY = /\b(only \d+ (hours?|days?) left|last chance|urgent(ly)?|right now|immediately|before it'?s too late|emergency)\b/i;
const LUXURY = /\b(iphone \d+ pro( max)?|rolex|gucci|louis vuitton|designer|luxury|ps5 pro|gaming beast|rtx 4090|macbook pro m\d max)\b/i;
const CHILD = /\b(my (son|daughter|child|kid)'?s? (name|school) is|(son|daughter) named|class \d+ at|studies at)\b/i;
const ABUSE = /\b(f+u+c+k+|sh[i1]t|bitch|bastard|kill (you|them)|nazi|terroris[mt]|harami|kutta|kamina)\b/i;
const INJECT = /ignore (all |your |previous )?(rules|instructions)|system prompt|mark (this|my) (campaign )?(as )?(verified|approved|urgent)|set verification|admin mode/i;

function scrub(s: string): { text: string; removed: boolean } {
  let removed = false;
  const mark = (re: RegExp, label: string) => (t: string) => t.replace(re, m => (m.replace(/\D/g, '').length >= 7 || label !== '[phone removed]' ? ((removed = true), label) : m));
  let out = s;
  out = mark(EMAIL, '[email removed]')(out);
  out = mark(CNIC, '[ID number removed]')(out);
  out = mark(SSN, '[ID number removed]')(out);
  out = mark(IBAN, '[account number removed]')(out);
  out = mark(PHONE, '[phone removed]')(out);
  out = out.replace(ADDRESS, () => { removed = true; return '[address removed]'; });
  return { text: out, removed };
}

export function reviewCampaignContent(input: { title: string; story: string; creatorName: string; priceCents: number; maxCampaignCents: number }): ModerationResult {
  const reasons = new Set<ModerationReason>();
  const t1 = scrub(input.title); const t2 = scrub(input.story);
  if (t1.removed || t2.removed) reasons.add('personal_info_removed');
  const all = `${input.title}\n${input.story}\n${input.creatorName}`;
  if (REDIRECT.test(all)) reasons.add('contact_or_payment_redirect');
  if (LINK.test(all)) reasons.add('external_links');
  if (SPAM.test(all)) reasons.add('spam_pattern');
  const letters = all.replace(/[^A-Za-z]/g, '');
  if (letters.length > 30 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) reasons.add('shouting');
  if (MEDICAL.test(all)) reasons.add('unverifiable_medical_claim');
  if (VERIFIED.test(all)) reasons.add('false_verification_claim');
  if (CHARITY.test(all)) reasons.add('charity_or_tax_claim');
  if (GUARANTEE.test(all)) reasons.add('guarantee_claim');
  if (URGENCY.test(all)) reasons.add('urgency_pressure');
  if (LUXURY.test(all)) reasons.add('luxury_framing');
  if (CHILD.test(all)) reasons.add('child_details');
  if (ABUSE.test(all)) reasons.add('abusive_language');
  if (INJECT.test(all)) reasons.add('injection_text');
  if (input.priceCents > input.maxCampaignCents) reasons.add('high_amount');
  const list = [...reasons];
  return { score: scoreOf(list), reasons: list, title: t1.text.replace(LINK, '[link removed]'), story: t2.text.replace(LINK, '[link removed]'), block: list.some(r => BLOCKING.includes(r)) };
}

export function scoreOf(reasons: ModerationReason[]): number {
  return reasons.reduce((s, r) => s + WEIGHTS[r], 0);
}

/** Stable fingerprint of a story, used to detect copy-pasted campaigns. */
export function contentFingerprint(title: string, story: string): string {
  const norm = `${title} ${story}`.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim().split(' ').filter(w => w.length > 2).slice(0, 60).sort().join(' ');
  let h = 2166136261;
  for (let i = 0; i < norm.length; i++) { h ^= norm.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

export const REPORT_REASONS = ['scam', 'misleading', 'personal_info', 'offensive', 'duplicate', 'other'] as const;
/** Distinct reporters needed to pause a campaign automatically until a moderator looks at it. */
export const AUTO_HIDE_REPORTS = 3;
