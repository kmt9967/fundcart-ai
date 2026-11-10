// Fundraising publication eligibility (deterministic, server-side).
//
// Shopping and fundraising have different security boundaries. Anyone may research products, even
// with odd wording. Publishing a page that asks other people for money needs more: a signed-in
// account, a purpose consistent with the chosen need category, no stated intent to deceive supporters,
// server-verifiable product suitability, and story claims that the creator actually made.
//
// This module only computes signals and an outcome. It never marks anyone verified, and an AI model
// never feeds an outcome directly: advisory model output may only ADD review reasons.

import type { ModerationReason } from './moderation';

export type EligibilityReason =
  | 'login_required' | 'email_unverified' | 'fraud_intent' | 'prior_fraud_signal' | 'purpose_missing'
  | 'purpose_trivial' | 'category_purpose_conflict' | 'purpose_unrelated_to_category' | 'unsupported_story_claim'
  | 'no_suitability_evidence' | 'clarification_retries' | 'policy_review';

export type PublicationOutcome = 'login_required' | 'needs_clarification' | 'rejected' | 'pending_review' | 'publish';

export type EligibilityInput = {
  authenticated: boolean;
  emailVerified: boolean;
  needCategory: string | null;
  purpose: string;
  /** Recent assistant requests by this account (server-loaded, owner-checked). */
  shoppingRequests: string[];
  title: string;
  story: string;
  suitability: 'cheapest_adequate' | 'owner_pays_difference' | 'unchecked';
  contentReasons: ModerationReason[];
  contentBlocked: boolean;
  priorFraudSignal: boolean;
  clarificationAttempts24h: number;
  adminReviewRequired: boolean;
  contentScore: number;
  reviewThreshold: number;
};

export type EligibilityResult = {
  outcome: PublicationOutcome;
  reasons: EligibilityReason[];
  /** Questions shown to the creator when the outcome is needs_clarification (dictionary keys). */
  questions: string[];
  risk: 'low' | 'medium' | 'high';
};

const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ');

/** Remove quoted passages ("…", “…”, «…») so reported speech is not read as the creator's own statement. */
function stripQuotes(s: string): string {
  return s.replace(/"[^"]{0,300}"|“[^”]{0,300}”|«[^»]{0,300}»/g, ' ');
}

// First-person statements of intent to deceive. Each pattern needs the speaker to describe THEMSELF
// (I am / I want to / my fake …). Talking about scams, avoiding them or being accused of one does not match.
const INTENT: RegExp[] = [
  /\b(i am|i'm|im|i m)\s+(a |an |the |actually a |really a |just a )?(scammer|fraudster|fraud|con ?artist|con ?man|swindler|thief|crook)\b/,
  /\bi\s+(want|wanna|plan|intend|am going|'m going|m going|will|'ll|am trying|'m trying|would like)\s+(to\s+)?(scam|defraud|con|swindle|trick|cheat|fool|rip off|steal from)\b/,
  /\b(let me|help me|i can|i could|i'll|i will)\s+(scam|defraud|swindle|trick|fool|cheat)\s+(people|donors|supporters|everyone|them|you|strangers|users)\b/,
  /\b(this is|it's|its|it is|i'm (making|writing|posting|creating)|i am (making|writing|posting|creating))\s+(a |an )?(fake|bogus|made[- ]up|false)\s+(campaign|story|fundraiser|need|page|sob story)\b/,
  /\bmy\s+(fake|bogus|made[- ]up)\s+(campaign|story|fundraiser|need|reason)\b/,
  /\b(keep|pocket|take|run off with|spend)\s+(all\s+)?(the|their|your)\s+(money|donations|contributions|funds)\s+(for myself|myself|on (myself|partying|drugs|gambling))\b/,
  /\b(i|we)\s+(don't|do not|dont)\s+(actually|really|even)\s+need\s+(it|this|the|a|any)\b/,
  /\b(none of this|nothing here|the story) is (true|real)\b/,
  // Spanish / French
  /\b(soy|yo soy)\s+(un |una )?(estafador|estafadora|ladr[oó]n|ladrona|timador|timadora)\b/,
  /\bquiero\s+(estafar|enga[nñ]ar|timar|robar)\b/,
  /\bje suis\s+(un |une )?(arnaqueur|arnaqueuse|escroc|voleur|voleuse)\b/,
  /\bje (veux|vais)\s+(arnaquer|escroquer|tromper|voler)\b/,
  // Urdu (script and common romanisation)
  /میں\s*(ایک\s*)?(فراڈ|فراڈیا|دھوکے\s*باز|دھوکہ\s*باز|چور|نوسر\s*باز)\s*(ہوں|هوں)/,
  /دھوکہ\s*(دینا|دوں\s*گا|دوں\s*گی)/,
  /\b(main|mein|mai)\s+(ek\s+)?(fraud|fraudiya|dhokebaaz|dhokebaz|dhoke ?baaz|chor|scammer)\s+(hun|hoon|hu|hoo)\b/,
  /\b(logon|logo|sab) (ko )?(dhoka|dhokha|bewakoof)\s+(dunga|dungi|doon ?ga|banaunga)\b/,
];

// Contexts in which a match is someone else's claim, a denial, or a question about scams.
const REPORTED_BEFORE = /(?:^|\s)(said|says|say|claim|claims|claimed|think|thinks|thought|accuse[sd]?|accused me of being|call|calls|called|believe[sd]?|told me|tell me|assume[sd]?|worried|afraid|scared|fear|if|whether|not because|ask(ed)? if|dicen que|dijo que|ils disent que|il dit que|کہتے|کہا)\s+(that\s+|que\s+)?(?:[a-z']+\s+){0,2}$/;

export function detectFraudIntent(text: string): boolean {
  const s = norm(stripQuotes(text));
  for (const re of INTENT) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = g.exec(s))) {
      const before = s.slice(Math.max(0, m.index - 40), m.index);
      if (!REPORTED_BEFORE.test(before)) return true;
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  return false;
}

const TRIVIAL = /\b(for fun|just for fun|for the fun of it|for kicks|for the lulz|lol|lmao|just because|no reason|because i can|why not|i'm bored|im bored|bored|to flex|to show off|for a laugh|idk|asdf|qwerty|para divertirme|por diversi[oó]n|por gusto|pour (le )?fun|pour m'amuser|pour rigoler|mazay? (ke|k) liye|mazay ke liye|shauq|timepass|time pass)\b|مزے\s*کے\s*لیے|شوق/;

// Words that make a purpose consistent with each need category (en/es/fr/ur, kept broad on purpose:
// these only decide whether to ASK, never whether to refuse).
const CATEGORY_WORDS: Record<string, RegExp> = {
  education: /\b(school|class|classes|course|courses|college|universit|degree|study|studies|studying|student|exam|homework|assignment|lecture|semester|tuition|learn|learning|teacher|research|thesis|coding bootcamp|bootcamp|escuela|universidad|estudi|clases|curso|[ée]cole|universit[ée]|[ée]tudes|[ée]tudiant|cours|examen|parh|parhai)|کالج|یونیورسٹی|پڑھائی|اسکول|تعلیم|امتحان/,
  work_livelihood: /\b(work|job|jobs|business|freelanc|client|clients|income|earn a living|livelihood|shop|store|stall|career|employ|self[- ]employed|gig|deliver|delivery|design work|programming|developer|office|interview|portfolio|customers|trabajo|negocio|empleo|clientes|travail|emploi|entreprise|clients|naukri|kaam|karobar|dukaan)|روزگار|کام|نوکری|کاروبار|دکان/,
  health_mobility: /\b(health|medical|doctor|clinic|therapy|mobility|wheelchair|walker|injur|recovery|physio|hearing|vision|glasses|salud|m[ée]dic|sant[ée]|fauteuil|ilaj)|صحت|علاج|ڈاکٹر/,
  disability_access: /\b(disab|accessib|blind|deaf|low vision|screen reader|hearing aid|wheelchair|impair|mobility aid|adaptive|discapaci|handicap)|معذور/,
  home_essentials: /\b(home|house|kitchen|cook|fridge|refrigerator|stove|heater|heating|cooling|fan|bed|mattress|washing|laundry|water|family needs|apartment|hogar|cocina|maison|cuisine|ghar)|گھر|باورچی/,
  family_child: /\b(child|children|kid|kids|son|daughter|baby|newborn|family|parent|mother|father|school supplies|hijo|hija|familia|beb[eé]|enfant|famille|b[ée]b[ée]|bacha|bachay|bachon)|بچ|خاندان|بیٹ/,
};

// Claims an AI draft must never add on its own. Matched on the story and compared with what the
// creator actually wrote in the purpose field.
export const CLAIM_PATTERNS: Record<string, RegExp> = {
  employment: /\b(worked hard|working hard|hard work|my job|part[- ]time|full[- ]time|my employer|lost my job|unemployed|laid off|my boss|my shifts?|freelancing for)\b/,
  hardship: /\b(struggl\w*|hardship|can't afford|cannot afford|couldn't afford|difficult times|tough times|financial(ly)? (difficult|strain|hardship)|poverty|poor family|living paycheck|every penny|scrimp\w*|sacrific\w*|skipp(ed|ing) meals|saving for months|saved for months|saved up for|saved hard|been saving)\b/,
  medical: /\b(illness|sick|disease|diagnos\w*|hospital|surgery|cancer|disabilit\w*|chronic|condition|treatment|therapy)\b/,
  family: /\b(my (wife|husband|kids|children|son|daughter|mother|mom|mum|father|dad|parents|family|siblings|brother|sister)|single (mom|mother|dad|father)|widow\w*|orphan\w*)\b/,
  academic: /\b(top of my class|straight a|scholarship|honou?r roll|gpa|valedictorian|first in my class|award[- ]winning|dean's list)\b/,
  verification: /\b(verified|kyc|identity (checked|confirmed)|background check|vetted)\b/,
  charity: /\b(registered charity|non[- ]?profit|tax[- ]deductible|501\(c\)|zakat[- ]eligible)\b/,
  guarantee: /\b(guarantee\w*|risk[- ]free|100% (safe|secure)|will definitely)\b/,
};

/** Claim families present in `story` that the creator's own words (purpose, plus anything else they typed) never mention. */
export function unsupportedClaims(story: string, creatorFacts: string): string[] {
  const s = norm(story); const f = norm(creatorFacts);
  return Object.entries(CLAIM_PATTERNS).filter(([, re]) => re.test(s) && !re.test(f)).map(([k]) => k);
}

/** Remove sentences that carry claims the creator never made. Returns the cleaned text and the removed claim families. */
export function stripUnsupportedClaims(story: string, creatorFacts: string): { text: string; removed: string[] } {
  const f = norm(creatorFacts);
  const removed = new Set<string>();
  const sentences = story.split(/(?<=[.!?۔])\s+/);
  const kept = sentences.filter(sentence => {
    const s = norm(sentence);
    const bad = Object.entries(CLAIM_PATTERNS).filter(([, re]) => re.test(s) && !re.test(f)).map(([k]) => k);
    bad.forEach(b => removed.add(b));
    return bad.length === 0;
  });
  return { text: kept.join(' ').trim(), removed: [...removed] };
}

export function purposeSignals(purpose: string, needCategory: string | null): EligibilityReason[] {
  const p = norm(purpose).trim();
  const out: EligibilityReason[] = [];
  const meaningful = p.replace(/[^\p{L}\p{N} ]/gu, '').trim();
  if (meaningful.length < 12 || meaningful.split(' ').length < 3) out.push('purpose_missing');
  const trivial = TRIVIAL.test(p);
  if (trivial) out.push('purpose_trivial');
  const supports = needCategory ? CATEGORY_WORDS[needCategory]?.test(p) ?? false : false;
  if (needCategory && trivial && !supports) out.push('category_purpose_conflict');
  else if (needCategory && !supports && !out.includes('purpose_missing')) out.push('purpose_unrelated_to_category');
  return out;
}

const CLARIFY_LIMIT = 3;
/** Content findings that always need a person, whatever the total score (claims supporters can't check). */
const ALWAYS_REVIEW: ModerationReason[] = ['charity_or_tax_claim', 'unverifiable_medical_claim', 'guarantee_claim', 'contact_or_payment_redirect', 'external_links', 'duplicate_content', 'velocity', 'premium_over_adequate', 'high_amount'];

export function assessPublication(i: EligibilityInput): EligibilityResult {
  if (!i.authenticated) return { outcome: 'login_required', reasons: ['login_required'], questions: [], risk: 'low' };
  const reasons = new Set<EligibilityReason>();
  const questions: string[] = [];

  const ownWords = `${i.purpose}\n${i.title}\n${i.story}`;
  const intent = detectFraudIntent(ownWords) || i.shoppingRequests.some(detectFraudIntent);
  if (intent) reasons.add('fraud_intent');
  if (i.priorFraudSignal) reasons.add('prior_fraud_signal');
  if (i.contentBlocked) return { outcome: 'rejected', reasons: [...reasons], questions: [], risk: 'high' };
  // High risk: never published automatically, never bounced back for a quick re-word. A person decides.
  if (intent || i.priorFraudSignal) {
    if (!i.emailVerified) reasons.add('email_unverified');
    return { outcome: 'pending_review', reasons: [...reasons], questions: [], risk: 'high' };
  }

  const purpose = purposeSignals(i.purpose, i.needCategory);
  purpose.forEach(r => reasons.add(r));
  const unsupported = unsupportedClaims(i.story, i.purpose);
  if (unsupported.length) reasons.add('unsupported_story_claim');

  const needsAsk = purpose.includes('purpose_missing') || purpose.includes('category_purpose_conflict') || purpose.includes('purpose_trivial');
  if (needsAsk) {
    if (i.clarificationAttempts24h >= CLARIFY_LIMIT) reasons.add('clarification_retries');
    else {
      if (purpose.includes('purpose_missing')) questions.push('elig.q.purpose');
      if (purpose.includes('category_purpose_conflict') || purpose.includes('purpose_trivial')) questions.push('elig.q.conflict');
      return { outcome: 'needs_clarification', reasons: [...reasons], questions, risk: 'medium' };
    }
  }

  if (i.suitability === 'unchecked') reasons.add('no_suitability_evidence');
  if (!i.emailVerified) reasons.add('email_unverified');
  if (i.adminReviewRequired) reasons.add('policy_review');

  const reviewNeeded = reasons.has('email_unverified') || reasons.has('no_suitability_evidence') || reasons.has('policy_review')
    || reasons.has('clarification_retries') || reasons.has('unsupported_story_claim') || reasons.has('purpose_unrelated_to_category')
    || i.contentScore >= i.reviewThreshold || i.contentReasons.some(r => ALWAYS_REVIEW.includes(r));
  const risk = reasons.has('clarification_retries') || reasons.has('unsupported_story_claim') || i.contentScore >= i.reviewThreshold ? 'medium' : 'low';
  return { outcome: reviewNeeded ? 'pending_review' : 'publish', reasons: [...reasons], questions: [], risk };
}
