import { z } from 'zod';

// Versioned, strictly validated shopping intent (adapted from the team's Shopping Intent Library,
// "IntentV2"). The LLM fills it; code validates it, parses money, and never lets it set prices,
// verification, funding or safety outcomes.

export const INTENT_VERSION = 2 as const;

export const FAMILIES = [
  'exact_item', 'category_browse', 'spec_constrained', 'budget_led', 'compatibility', 'replacement',
  'substitute', 'use_case', 'problem_symptom', 'skill_level', 'body_persona_fit', 'occasion_theme',
  'gift', 'comparison', 'subjective_vibe', 'trend_social_proof', 'deal_seeking', 'values_ethics',
  'urgency_delivery', 'recurring', 'bundle_project', 'vague_exploratory', 'refinement',
  'slang_mixed_language', 'contradictory', 'non_product_support', 'affordability_gap', 'donor', 'image_voice',
] as const;
export type Family = typeof FAMILIES[number];

/** Spec fields the engine can verify against listings. Anything else is a soft preference. */
export const FIELDS = [
  'ram_gb', 'storage_gb', 'storage_type', 'cpu_modern', 'cpu_tier', 'arm', 'gpu_dedicated', 'gpu_vram_gb',
  'os', 'screen_in', 'refresh_hz', 'anc', 'wireless', 'microphone', 'interchangeable_lens', 'condition',
] as const;
export type Field = typeof FIELDS[number];

export const OPS = ['==', '!=', '>=', '<=', 'in', 'not_in', '~='] as const;
export type Op = typeof OPS[number];

export type ReqValue = string | number | boolean | string[];

export type Requirement = {
  field: Field;
  op: Op;
  value: ReqValue;
  level: 'minimum' | 'recommended' | 'premium';
  /** stated = the user said it; official = vendor documentation; derived = FundCart knowledge base; ai = model estimate (never filters). */
  origin: 'stated' | 'official' | 'derived' | 'ai';
  why: string;
  when?: { osNot?: string[]; osIn?: string[] };
  source?: { title: string; url: string };
};

const ConstraintSchema = z.object({
  field: z.enum(FIELDS),
  op: z.enum(OPS),
  value: z.union([z.string().max(40), z.number(), z.boolean(), z.array(z.string().max(30)).max(8)]),
});

export const LANGS = ['en', 'ur', 'roman_ur', 'es', 'fr', 'mixed', 'other'] as const;
export const ACTIONS = ['find_options', 'compare', 'refine', 'ask_clarifying', 'start_campaign', 'donate', 'support', 'answer'] as const;

export const IntentV2Schema = z.object({
  version: z.literal(INTENT_VERSION),
  primaryFamily: z.enum(FAMILIES),
  secondaryFamilies: z.array(z.enum(FAMILIES)).max(3),
  /** Canonical English product category noun, e.g. "laptop". "unknown" when not inferable. */
  category: z.string().min(1).max(40),
  /** physical | software | service | unknown — "Android Studio" in a laptop request is NOT the product. */
  productKind: z.enum(['physical', 'software', 'service', 'unknown']),
  /** Concise English catalog query without prices, 2–8 words. */
  searchQuery: z.string().min(2).max(100),
  goal: z.string().max(200),
  useCases: z.array(z.string().max(60)).max(5),
  software: z.array(z.string().max(40)).max(5),
  skillLevel: z.enum(['beginner', 'intermediate', 'pro', 'unknown']),
  recipient: z.object({ who: z.enum(['self', 'other']), relation: z.string().max(40).nullable() }),
  hardConstraints: z.array(ConstraintSchema).max(10),
  softPreferences: z.array(z.string().max(60)).max(8),
  brandsInclude: z.array(z.string().max(40)).max(5),
  brandsExclude: z.array(z.string().max(40)).max(8),
  colors: z.array(z.string().max(20)).max(4),
  usedOk: z.boolean().nullable(),
  budgetRaw: z.string().max(60).nullable(),
  ownFundsRaw: z.string().max(60).nullable(),
  /** Refinement controls (multi-turn). */
  isRefinement: z.boolean(),
  clearBudget: z.boolean(),
  priceDirection: z.enum(['cheaper', 'premium']).nullable(),
  references: z.array(z.number().int().min(1).max(30)).max(3),
  rankingMode: z.enum(['best_fit', 'cheapest_adequate']).nullable(),
  noEmulator: z.boolean().nullable(),
  language: z.enum(LANGS),
  requestedAction: z.enum(ACTIONS),
  missingCritical: z.array(z.string().max(40)).max(3),
  followUpQuestion: z.string().max(220).nullable(),
  confidence: z.number().min(0).max(1),
  injectionSuspected: z.boolean(),
});
export type IntentV2 = z.infer<typeof IntentV2Schema>;
export type Constraint = z.infer<typeof ConstraintSchema>;

/** Merged multi-turn state persisted server-side (ai_sessions.intent). Money is parsed by code. */
export type SessionState = {
  version: typeof INTENT_VERSION;
  turn: number;
  category: string;
  searchQuery: string;
  goal: string;
  useCases: string[];
  software: string[];
  skillLevel: IntentV2['skillLevel'];
  recipient: IntentV2['recipient'];
  stated: Constraint[];
  softPreferences: string[];
  brandsInclude: string[];
  brandsExclude: string[];
  colors: string[];
  usedOk: boolean | null;
  /** currency '?' = ambiguous, not applied until the user says which currency. assumed = USD inferred from a plain English amount (shown to the user). */
  budget: { maxCents: number | null; minCents: number | null; currency: string; raw: string | null; usable: boolean; assumed?: boolean } | null;
  ownFundsCents: number | null;
  priceCapCents: number | null; // from "cheaper" refinements: below the previous top pick
  rankingMode: 'best_fit' | 'cheapest_adequate';
  profileId: string | null;
  noEmulator: boolean;
  /** Android testing method: physical phone, Emulator, or not stated yet (null). */
  androidWorkflow?: 'device' | 'emulator' | null;
  /** Own funds were stated without a recognisable currency, so they were not used. */
  ownFundsAmbiguous?: string | null;
  language: IntentV2['language'];
  primaryFamily: Family;
  lastProductIds: string[];
  lastPrices: Record<string, number>;
};
