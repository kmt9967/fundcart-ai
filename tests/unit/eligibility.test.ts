import { describe, it, expect } from 'vitest';
import { detectFraudIntent, purposeSignals, assessPublication, unsupportedClaims, stripUnsupportedClaims, type EligibilityInput } from '@/lib/eligibility';

const base: EligibilityInput = {
  authenticated: true, emailVerified: true, needCategory: 'education',
  purpose: 'I need a laptop for my university programming classes and assignments.',
  shoppingRequests: ['laptop for university coding under $700'],
  title: 'Help me get a laptop for university', story: 'I need a laptop for my university programming classes and assignments. Contributions go through PayPal.',
  suitability: 'cheapest_adequate', contentReasons: [], contentBlocked: false, priorFraudSignal: false,
  clarificationAttempts24h: 0, adminReviewRequired: false, contentScore: 0, reviewThreshold: 4,
};

describe('detectFraudIntent: self-described intent to deceive', () => {
  it.each([
    'I am a scammer i want computer wirth $2000',
    "i'm a scammer lol",
    'im a fraud and need money',
    'I want to scam people with this campaign',
    'I plan to trick donors into paying for my laptop',
    'this is a fake campaign, I just want free stuff',
    "I'll keep the money for myself",
    "I don't actually need it",
    'soy un estafador y quiero una laptop',
    'je suis un arnaqueur',
    'je veux arnaquer les gens',
    'میں ایک فراڈ ہوں',
    'main fraud hun mujhe laptop chahiye',
  ])('flags %s', s => expect(detectFraudIntent(s)).toBe(true));

  it.each([
    'How do I avoid scams when buying a used laptop?',
    'I am not a scammer, I really need this for school',
    'My neighbour called me a scammer but this is real',
    'People think I am a scammer because I am new here',
    'He said "I am a scammer" as a joke in the video',
    'laptop for a fraud investigation course',
    'Is this listing a scam? It looks too cheap',
    'I study scam detection and cybersecurity',
    'I want a laptop to learn anti-fraud analytics',
    'Worried they will think I am a fraud. I need it for classes.',
  ])('does not flag %s', s => expect(detectFraudIntent(s)).toBe(false));
});

describe('purposeSignals: purpose vs need category', () => {
  it('for fun + work/livelihood is a conflict', () => {
    const r = purposeSignals('for fun', 'work_livelihood');
    expect(r).toContain('purpose_missing');
    expect(r).toContain('category_purpose_conflict');
  });
  it('a real work purpose passes', () => expect(purposeSignals('I do freelance design work for clients and my old laptop died', 'work_livelihood')).toEqual([]));
  it('Urdu education purpose passes', () => expect(purposeSignals('مجھے یونیورسٹی کی پڑھائی کے لیے لیپ ٹاپ چاہیے', 'education')).toEqual([]));
  it('Spanish work purpose passes', () => expect(purposeSignals('Necesito una laptop para mi trabajo con clientes', 'work_livelihood')).toEqual([]));
  it('unrelated purpose is noted, not a conflict', () => expect(purposeSignals('I would like a better computer to replace my broken one', 'education')).toEqual(['purpose_unrelated_to_category']));
});

describe('assessPublication', () => {
  it('guest -> login required', () => expect(assessPublication({ ...base, authenticated: false }).outcome).toBe('login_required'));
  it('reported production case -> high-risk review, never published', () => {
    const r = assessPublication({ ...base, emailVerified: false, needCategory: 'work_livelihood', purpose: 'for fun', shoppingRequests: ['I am a scammer i want computer wirth $2000'],
      title: 'Help Brendan Get an HP OmniBook 5 Laptop', story: 'I have worked hard and saved $10 toward this laptop. Every bit helps me reach my goal through PayPal.' });
    expect(r.outcome).toBe('pending_review');
    expect(r.risk).toBe('high');
    expect(r.reasons).toContain('fraud_intent');
  });
  it('fraud intent cannot be cleared by rewording the purpose (shopping history persists)', () => {
    const r = assessPublication({ ...base, shoppingRequests: ['I am a scammer i want computer'], purpose: 'I need it for my university classes and homework' });
    expect(r.outcome).toBe('pending_review');
  });
  it('prior fraud signal on the account -> review even with a clean new request', () => {
    expect(assessPublication({ ...base, priorFraudSignal: true }).outcome).toBe('pending_review');
  });
  it('category/purpose contradiction without fraud words -> clarification', () => {
    const r = assessPublication({ ...base, needCategory: 'work_livelihood', purpose: 'just for fun, why not' });
    expect(r.outcome).toBe('needs_clarification');
    expect(r.questions).toContain('elig.q.conflict');
  });
  it('repeated clarification attempts -> review instead of endless retries', () => {
    expect(assessPublication({ ...base, purpose: 'for fun', clarificationAttempts24h: 3 }).outcome).toBe('pending_review');
  });
  it('unverified email -> review', () => {
    const r = assessPublication({ ...base, emailVerified: false });
    expect(r.outcome).toBe('pending_review');
    expect(r.reasons).toEqual(['email_unverified']);
  });
  it('no suitability evidence -> review', () => expect(assessPublication({ ...base, suitability: 'unchecked' }).reasons).toContain('no_suitability_evidence'));
  it('AI-invented hardship -> review', () => {
    const r = assessPublication({ ...base, story: 'I have been struggling financially and my family cannot afford this. I need it for university classes.' });
    expect(r.reasons).toContain('unsupported_story_claim');
    expect(r.outcome).toBe('pending_review');
  });
  it('blocked content -> rejected', () => expect(assessPublication({ ...base, contentBlocked: true }).outcome).toBe('rejected'));
  it('benign scam-awareness campaign is publishable for a verified creator', () => {
    const r = assessPublication({ ...base, purpose: 'I need a laptop for my cybersecurity course on how to spot online scams', shoppingRequests: ['laptop for a course about avoiding scams'] });
    expect(r.outcome).toBe('publish');
  });
  it('verified, consistent, suitable -> publish', () => expect(assessPublication(base).outcome).toBe('publish'));
  it('fake charity declaration -> review even below the score threshold', () => expect(assessPublication({ ...base, contentReasons: ['charity_or_tax_claim'], contentScore: 3 }).outcome).toBe('pending_review'));
  it('policy admin review -> review', () => expect(assessPublication({ ...base, adminReviewRequired: true }).outcome).toBe('pending_review'));
});

describe('story claims must come from the creator', () => {
  it('detects invented employment and sacrifice', () => {
    expect(unsupportedClaims('I have worked hard and saved for months.', 'for fun').sort()).toEqual(['employment', 'hardship']);
  });
  it('keeps claims the creator made', () => {
    expect(unsupportedClaims('I lost my job and freelance now.', 'I lost my job last month and now freelance')).toEqual([]);
  });
  it('strips only the unsupported sentences', () => {
    const r = stripUnsupportedClaims('I need a laptop for classes. I have worked hard for this. Contributions go through PayPal.', 'I need a laptop for classes');
    expect(r.text).toBe('I need a laptop for classes. Contributions go through PayPal.');
    expect(r.removed).toEqual(['employment']);
  });
});
