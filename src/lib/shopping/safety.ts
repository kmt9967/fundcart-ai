// Safety gate (deterministic rules, run before any search or model call). Two kinds of output:
//  - blocking flags: the turn short-circuits (no product search) with an explanation and, where
//    possible, a safe alternative;
//  - notices: shopping continues, but the reply carries a caution (medical claims, allergens,
//    spending pressure, sensitive purchases, safety-critical fit).
// The model's injectionSuspected hint is an extra signal only; it can add caution, never remove it.
// Card numbers, national ID numbers, emails and phone numbers are redacted before the text reaches
// the model, logs or the database.

export type SafetyFlag =
  | 'self_harm' | 'restricted_item' | 'minor_age_restricted' | 'covert_surveillance' | 'counterfeit'
  | 'dangerous' | 'injection' | 'promo_extraction' | 'off_topic' | 'deceptive_campaign'
  | 'fake_authority' | 'other_user_data' | 'return_fraud' | 'auto_purchase' | 'fake_verification';

export type SafetyNotice = 'medical' | 'allergen' | 'spending_pressure' | 'sensitive_purchase' | 'child_spend' | 'pii_removed' | 'safety_critical_fit';

export type SupportRoute = 'orders' | 'donor' | 'zakat' | 'returns' | 'payment_info' | 'cross_border' | 'donation_refund' | 'medical_symptom';

export type SafetyResult = {
  flags: SafetyFlag[]; notices: SafetyNotice[]; redacted: string; piiRedacted: boolean; block: boolean;
  supportRoute: SupportRoute | null;
};

// Order matters only for which explanation is shown first.
const RULES: Array<[SafetyFlag, RegExp]> = [
  ['self_harm', /(kill myself|end my life|suicid|want to die|nothing matters anymore|no reason to live|self[- ]harm|khudkushi|mar jana chahta|مرنا چاہتا|خودکشی|quiero morir|me suicider|envie de mourir)|(strongest|lethal|overdose).{0,30}(pills?|tablets?|dose)|(sleeping pills?).{0,30}(strongest|most|lethal|many)/i],
  ['restricted_item', /(antibiotic|opioid|oxycodone|tramadol|xanax|alprazolam|codeine|steroids?|prescription (drugs?|meds?|medicine)).{0,40}(without|bina|no|sin|sans) (a )?(prescription|nuskh|parchi|receta|ordonnance)|bina (prescription|nuskhe|parchi)|without (a )?prescription|sin receta|sans ordonnance|\b(gun|pistol|firearm|ammo|ammunition|explosive)s?\b.{0,20}\b(buy|sell|kharid|chahiye|need|want)|\b(buy|sell|kharid|chahiye|need|want)\b.{0,20}\b(gun|pistol|firearm|ammo|ammunition|explosive)s?\b/i],
  ['minor_age_restricted', /\b(i'?m|i am|main|mein|tengo|j'ai)\s*(1[0-7]|[5-9])\b.{0,40}\b(vape|e-?cig|cigarette|alcohol|beer|wine|vodka|nicotine|juul|tobacco|knife)|\b(vape|alcohol|cigarettes?|beer)\b.{0,30}\b(for my|for a) (1[0-7]|[5-9])[- ]year/i],
  ['covert_surveillance', /(secretly|without (him|her|them) knowing|chupke|chupkay|chhup ke|hidden|spy|en secreto|en secret).{0,40}(track|monitor|record|spy|follow|listen|rastrear|suivre)|(track|spy on|monitor|read).{0,30}(my )?(wife|husband|girlfriend|boyfriend|partner|ex|biwi|shohar).{0,30}(secretly|without|chupke|phone|location|messages)|stalkerware|spy ?(app|camera) (on|for) (my )?(wife|husband|partner)/i],
  ['counterfeit', /(first copy|1st copy|master copy|replica|fake|counterfeit|ditto copy|copy jo original|bilkul original lage|AAA quality|super copy|r[eé]plica|contrefa[çc]on).{0,40}(rolex|gucci|louis|lv|nike|adidas|iphone|chanel|dior|watch|bag|shoes|joote|ghadi)|(rolex|gucci|louis vuitton|chanel|dior).{0,20}(first copy|replica|fake|copy)/i],
  ['dangerous', /(make|mix|create|bana).{0,30}(toxic|poison(ous)? gas|chlorine gas|mustard gas|explosive|bomb|napalm)|(bleach).{0,20}(ammonia|vinegar).{0,20}(mix|gas)|how to (make|build) (a )?(bomb|weapon|poison)/i],
  ['fake_authority', /\b(i'?m|i am|main|this is) (the )?(store |shop |site )?(owner|admin(istrator)?|manager|ceo|developer|staff|moderator|fundcart team)\b.{0,60}(discount|free|approve|override|unlock|refund|price|admin)|admin mode|apply (a )?100% discount|give (me )?(a )?100% discount|as (an )?admin\b/i],
  ['fake_verification', /(mark|make|set|label|show) (my |this |the )?(campaign|account|profile|need)? ?(as )?(verified|approved|urgent|trusted)\b|verification badge (for|on) (me|my)|say (i'?m|i am|my campaign is) verified|mujhe verified (kar|bana)/i],
  ['injection', /ignore (all |your |previous |the )?(rules|instructions|prompt)|disregard (your|the|all) (rules|instructions)|you are now|developer mode|jailbreak|\bsystem\s*:|set (the )?price (of [^.]{0,40})?to|change (the )?price|reveal (your|the) (system )?prompt|apna (prompt|rule) bhool|(rules|hidayat|qawaid) (bhool|nazarandaz) (jao|karo)|ہدایات (نظر ?انداز|بھول)|ignora (las|tus|todas las) (instrucciones|reglas)|ignore[sz]? (les|tes|toutes les) (instructions|r[eè]gles)|agree to everything|legally binding (offer|deal)|for (rs\.?|\$|pkr) ?1\b/i],
  ['other_user_data', /(show|tell|give|list|find).{0,30}(what|who|email|phone|address|orders?|purchases?|donations?|details).{0,30}(other (users?|customers?)|someone else'?s?|another (user|customer)|\b[a-z]+ (khan|ahmed|ali|smith|garcia)\b.{0,10}(ordered|bought|donated|purchases?|orders?)|my (neighbou?r|colleague|ex)'?s? (orders?|purchases?|address))|(email|phone|address|location|real name) of (the )?(creator|beneficiary|supporter|donor|user)|who (donated|contributed) (to|on) .{0,40}(names?|emails?)|(creator|beneficiary)('s)? (home )?address/i],
  ['return_fraud', /(return|refund).{0,30}(used|worn|broken by me|damaged by me|after using).{0,30}(as new|like new|without (them|anyone) knowing)|wardrob(e|ing)\b|(claim|say|pretend).{0,25}(it )?(never arrived|was broken|was damaged|didn'?t arrive).{0,30}(refund|money back)/i],
  ['auto_purchase', /(buy|order|pay|checkout|charge).{0,30}(automatically|without (asking|confirmation|my approval)|on my behalf without)|auto[- ]?(buy|pay|checkout)|use my saved card/i],
  ['promo_extraction', /(all|every|list|give me).{0,25}(discount|promo|coupon|voucher) codes?|staff (discount|codes?)|employee (discount )?codes?/i],
  ['off_topic', /(write|do|solve|complete).{0,25}(my )?(assignment|homework|essay|thesis|exam|quiz|code for me)|forget (about )?shopping|pretend (you'?re|you are) (an )?unfiltered/i],
  ['deceptive_campaign', /(say|pretend|claim|write|likh).{0,30}(i have|mujhe|i'm|i am).{0,20}(cancer|dying|terminal|disease|bimari|orphan).{0,40}(so|taake|to make|donate|more money|zyada paise)|(fake|invent|exaggerate|make up).{0,20}(story|hardship|illness).{0,30}(campaign|donat|fund)/i],
];

const NOTICES: Array<[SafetyNotice, RegExp]> = [
  ['medical', /\b(cure|cures|treat(s|ment)?|heal|diabetes|blood pressure|acne|anxiety|depression|eczema|arthritis|back pain|supplements?|weight loss|sensitive skin)\b|علاج|dawai|ilaj/i],
  ['allergen', /\b(allerg(y|ic)|peanuts?|nut[- ]free|gluten[- ]free|lactose|celiac|coeliac|dairy[- ]free)\b|الرجی|alergia|allergie/i],
  ['spending_pressure', /(already spent|spent (all )?my (salary|savings|rent)|can'?t afford (it )?but|on credit|loan (for|to buy)|borrow(ed)? (money )?to buy|qarz|udhaar|tankhwah khatam)/i],
  ['sensitive_purchase', /\b(pregnancy test|condoms?|contracepti\w*|morning[- ]after|std test|hiv test|adult toy|lubricant)\b/i],
  ['child_spend', /\b(robux|v-?bucks|game (credits|coins))\b|my (mom|mother|dad|father|parents)'?s? (card|account)/i],
  ['safety_critical_fit', /\b(brake pads?|brake discs?|tyres?|tires|car battery|car seat|child seat|helmet)\b/i],
];

const SUPPORT_ROUTES: Array<[SupportRoute, RegExp]> = [
  ['zakat', /\bzakat\b|زکوٰۃ|زکات|sadqa|sadaqah|خیرات/i],
  ['cross_border', /(give|donate|contribute|send).{0,30}from (dubai|uae|abroad|another country|the us|usa|uk|saudi|canada).{0,40}(to|for|in) (someone|a person|pakistan|india)|cross[- ]border (donation|contribution)|bahar (se|say) (donate|chanda)/i],
  ['donation_refund', /refund (my|a) (donation|contribution)|(donation|contribution) (back|refund)|chanda wapis/i],
  ['donor', /(want to help|help a student|donate to|support someone|where did my money go|donate kiya|meri donation|chanda|contribute to a campaign|ayudar a|aider un|faire un don)/i],
  ['returns', /(how (do|can) i return|return (policy|karna|this)|wapis (kaise|karna)|devolver|retourner|does (it|this) come with (a )?warranty)/i],
  ['payment_info', /(pay in installments|\binstallments?\b|\bbnpl\b|buy now pay later|cash on delivery|\bcod\b|\bqist\b|aqsaat)/i],
  ['orders', /(where is my order|track (my )?order|order status|mera order|order kahan|refund my (order|purchase)|is this original or copy|seller pe bharosa|dónde está mi pedido|où est ma commande)/i],
  ['medical_symptom', /\b(dry cough|chest pain|fever|rash|toothache|migraine|infection|bleeding|khansi|bukhar)\b.{0,40}\b(at night|for days|won'?t stop|what (should|can) i (take|buy)|medicine|kya lun|dawai)\b|^\s*(dry cough|khansi)( at night)?\s*$|what medicine (should|can) i (take|buy)/i],
];

// Card numbers (13–19 digits, optional spaces/dashes, Luhn-checked).
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;
const CNIC_RE = /\b\d{5}-\d{7}-\d\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?\(?\d{3,4}\)?[\s-]?\d{3}[\s-]?\d{4}\b/g;

export function redactPii(text: string): { text: string; removed: boolean } {
  let removed = false;
  let out = text.replace(CARD_RE, m => { const d = m.replace(/\D/g, ''); if (d.length >= 13 && luhn(d)) { removed = true; return '[card number removed]'; } return m; });
  out = out.replace(CNIC_RE, () => { removed = true; return '[ID number removed]'; });
  out = out.replace(SSN_RE, () => { removed = true; return '[ID number removed]'; });
  out = out.replace(EMAIL_RE, () => { removed = true; return '[email removed]'; });
  out = out.replace(PHONE_RE, m => (m.replace(/\D/g, '').length >= 10 ? ((removed = true), '[phone removed]') : m));
  return { text: out, removed };
}

export function screenMessage(text: string): SafetyResult {
  const { text: redacted, removed } = redactPii(text);
  const flags = RULES.filter(([, re]) => re.test(redacted)).map(([f]) => f);
  const notices = NOTICES.filter(([, re]) => re.test(redacted)).map(([n]) => n);
  if (removed) notices.push('pii_removed');
  const supportRoute = SUPPORT_ROUTES.find(([, re]) => re.test(redacted))?.[0] ?? null;
  return { flags, notices, redacted, piiRedacted: removed, block: flags.length > 0, supportRoute };
}

/** Instruction-like text inside a product listing (title/description). Listing text is data, never instructions. */
const LISTING_INJECTION = /\b(ai|assistants?|agents?|chatbots?|llms?|models?)\b.{0,40}\b(rank|recommend|say|tell|mark|list|call)\b.{0,20}\b(this|it)\b|ignore (all |your |previous )?(rules|instructions)|system prompt|do not recommend (other|competitor)/i;
export function listingInjection(text: string | null | undefined): boolean {
  return !!text && LISTING_INJECTION.test(text);
}

function luhn(d: string): boolean {
  let sum = 0; let alt = false;
  for (let i = d.length - 1; i >= 0; i--) { let n = Number(d[i]); if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
  return sum % 10 === 0;
}
