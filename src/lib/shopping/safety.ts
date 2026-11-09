// Safety gate (rules, run before any search; the model's injection hint is an extra signal only).
// Any flag short-circuits the turn: no product search, a short explanation instead.
// Card numbers are redacted from the message before it reaches the model, logs or the database.

export type SafetyFlag =
  | 'self_harm' | 'restricted_item' | 'minor_age_restricted' | 'covert_surveillance' | 'counterfeit'
  | 'dangerous' | 'injection' | 'promo_extraction' | 'off_topic' | 'deceptive_campaign';

export type SafetyResult = { flags: SafetyFlag[]; redacted: string; piiRedacted: boolean; block: boolean; supportRoute: 'orders' | 'donor' | 'zakat' | null };

const RULES: Array<[SafetyFlag, RegExp]> = [
  ['self_harm', /(kill myself|end my life|suicid|want to die|nothing matters anymore|no reason to live|self[- ]harm|khudkushi|mar jana chahta|مرنا چاہتا|خودکشی|quiero morir|me suicider)|(strongest|lethal|overdose).{0,30}(pills?|tablets?|dose)|(sleeping pills?).{0,30}(strongest|most|lethal|many)/i],
  ['restricted_item', /(antibiotic|opioid|oxycodone|tramadol|xanax|alprazolam|codeine|steroids?|prescription (drugs?|meds?|medicine)).{0,40}(without|bina|no|sin|sans) (a )?(prescription|nuskh|parchi|receta|ordonnance)|bina (prescription|nuskhe|parchi)|without (a )?prescription|\b(gun|pistol|firearm|ammo|ammunition|explosive)s?\b.{0,20}\b(buy|sell|kharid|chahiye|need|want)|\b(buy|sell|kharid|chahiye|need|want)\b.{0,20}\b(gun|pistol|firearm|ammo|ammunition|explosive)s?\b/i],
  ['minor_age_restricted', /\b(i'?m|i am|main|mein|tengo|j'ai)\s*(1[0-7]|[5-9])\b.{0,40}\b(vape|e-?cig|cigarette|alcohol|beer|wine|vodka|nicotine|juul|tobacco|knife)|\b(vape|alcohol|cigarettes?|beer)\b.{0,30}\b(for my|for a) (1[0-7]|[5-9])[- ]year/i],
  ['covert_surveillance', /(secretly|without (him|her|them) knowing|chupke|chupkay|chhup ke|hidden|spy).{0,40}(track|monitor|record|spy|follow|listen)|(track|spy on|monitor|read).{0,30}(my )?(wife|husband|girlfriend|boyfriend|partner|ex|biwi|shohar).{0,30}(secretly|without|chupke|phone|location|messages)|stalkerware|spy ?(app|camera) (on|for) (my )?(wife|husband|partner)/i],
  ['counterfeit', /(first copy|1st copy|master copy|replica|fake|counterfeit|ditto copy|copy jo original|bilkul original lage|AAA quality|super copy).{0,40}(rolex|gucci|louis|lv|nike|adidas|iphone|chanel|dior|watch|bag|shoes|joote|ghadi)|(rolex|gucci|louis vuitton|chanel|dior).{0,20}(first copy|replica|fake|copy)/i],
  ['dangerous', /(make|mix|create|bana).{0,30}(toxic|poison(ous)? gas|chlorine gas|mustard gas|explosive|bomb|napalm)|(bleach).{0,20}(ammonia|vinegar).{0,20}(mix|gas)|how to (make|build) (a )?(bomb|weapon|poison)/i],
  ['injection', /ignore (all |your |previous |the )?(rules|instructions|prompt)|you are now|admin mode|developer mode|\bsystem\s*:|mark (my |this )?campaign (as )?(verified|urgent|approved)|set (the )?price (of [^.]{0,40})?to|change (the )?price|give (me )?(a )?100% discount|reveal (your|the) (system )?prompt|apna (prompt|rule) bhool/i],
  ['promo_extraction', /(all|every|list|give me).{0,25}(discount|promo|coupon|voucher) codes?|staff (discount|codes?)|employee (discount )?codes?/i],
  ['off_topic', /(write|do|solve|complete).{0,25}(my )?(assignment|homework|essay|thesis|exam|quiz|code for me)|forget (about )?shopping/i],
  ['deceptive_campaign', /(say|pretend|claim|write|likh).{0,30}(i have|mujhe|i'm|i am).{0,20}(cancer|dying|terminal|disease|bimari|orphan).{0,40}(so|taake|to make|donate|more money|zyada paise)/i],
];

const SUPPORT = /(where is my order|track (my )?order|order status|mera order|order kahan|return (karna|this|an item)|wapis (kaise|karna)|refund my (order|purchase)|is this original or copy|seller pe bharosa)/i;
const DONOR = /(want to help|help a student|donate to|support someone|where did my money go|donate kiya|meri donation|chanda|contribute to a campaign|ayudar a|aider un)/i;
const ZAKAT = /\bzakat\b|زکوٰۃ|زکات|sadqa|sadaqah|خیرات/i;

// Card numbers (13–19 digits, optional spaces/dashes) — never stored or sent to the model.
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;

export function screenMessage(text: string): SafetyResult {
  let piiRedacted = false;
  const redacted = text.replace(CARD_RE, m => { const digits = m.replace(/\D/g, ''); if (digits.length >= 13 && luhn(digits)) { piiRedacted = true; return '[card number removed]'; } return m; });
  const flags = RULES.filter(([, re]) => re.test(redacted)).map(([f]) => f);
  const supportRoute = ZAKAT.test(redacted) ? 'zakat' : DONOR.test(redacted) ? 'donor' : SUPPORT.test(redacted) ? 'orders' : null;
  return { flags, redacted, piiRedacted, block: flags.length > 0, supportRoute };
}

function luhn(d: string): boolean {
  let sum = 0; let alt = false;
  for (let i = d.length - 1; i >= 0; i--) { let n = Number(d[i]); if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
  return sum % 10 === 0;
}
