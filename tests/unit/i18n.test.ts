import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/dict/en';
import { ur } from '@/i18n/dict/ur';
import { es } from '@/i18n/dict/es';
import { fr } from '@/i18n/dict/fr';

const base = en as Record<string, string>;
const others = { ur, es, fr } as Record<string, Record<string, string>>;
const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const tags = (s: string) => (s.match(/<\/?b>/g) || []).join('');

// Values that are legitimately the same in every language (brand names, units, codes).
const SAME_OK = /^(FundCart( AI)?|PayPal( Sandbox)?|Channel3|Gemini|Supabase|AG Grid|RAM|SSD|GPU|CPU|OS|Hz|GB|USD|PKR|EUR|Email|E-mail|Total|Notes?|Description|Message|Date|Campaign|Contributions?|Sandbox|Android Studio|iOS \/ Xcode.*|Windows|macOS|Linux|ChromeOS|OK|—|·|\{[a-z]+\}.*)$/i;

// Reviewed: identical by design (French/Spanish cognates, Roman Urdu example prompts, an email placeholder).
const REVIEWED_SAME: Record<string, string[]> = {
  ur: ['assistant.ex2', 'assistant.ex4', 'contrib.emailPh'],
  es: ['pu.total', 'dc.total', 'contrib.emailPh'],
  fr: ['assistant.budgetChip', 'assistant.source', 'field.microphone', 'pick.alternative', 'contrib.capture', 'lg.capture', 'lg.type', 'pu.total', 'dc.total', 'contrib.emailPh'],
};

describe('translations', () => {
  for (const [lang, dict] of Object.entries(others)) {
    it(`${lang}: every key exists, no empty values, same placeholders and markup as English`, () => {
      const problems: string[] = [];
      for (const [k, v] of Object.entries(base)) {
        const o = dict[k];
        if (typeof o !== 'string' || !o.trim()) { problems.push(`${k}: missing/empty`); continue; }
        if (params(o) !== params(v)) problems.push(`${k}: placeholders {${params(o)}} vs {${params(v)}}`);
        if (tags(o) !== tags(v)) problems.push(`${k}: <b> markup differs`);
      }
      expect(problems).toEqual([]);
    });
    it(`${lang}: no English text left untranslated (except brand names and units)`, () => {
      const same = Object.entries(base).filter(([k, v]) => dict[k] === v && /[a-z]{4,}/i.test(v) && !SAME_OK.test(v.trim()) && !REVIEWED_SAME[lang].includes(k)).map(([k, v]) => `${k}: ${v.slice(0, 60)}`);
      expect(same).toEqual([]);
    });
  }
  it('Urdu strings are written in Urdu script', () => {
    const latinOnly = Object.entries(ur as Record<string, string>).filter(([k, v]) => /[a-z]{4,}/i.test(v) && !/[؀-ۿ]/.test(v) && !SAME_OK.test(v.trim()) && !REVIEWED_SAME.ur.includes(k)).map(([k, v]) => `${k}: ${v.slice(0, 50)}`);
    expect(latinOnly).toEqual([]);
  });
});
