# Multilingual support

FundCart's interface is available in **English, Urdu (right-to-left), Spanish and French**. The
assistant also understands **Roman Urdu** (Urdu written in Latin letters) and mixed English–Urdu
messages.

## One engine for every language

There is a single shopping, evaluation, payment and policy engine. Language affects only how a
request is read and how results are worded:

- the intent step normalises categories, use cases and colours to English internally;
- money parsing handles "$800", "800 $", "1.2 lac", "80k", "dhai hazar" and Urdu digits in code;
- requirements, ranking, gaps, payment totals, permissions and country-policy decisions are computed
  without a locale parameter, so switching language cannot change them.

## Currency honesty

FundCart prices are in US dollars (catalog data). A budget in another currency, or an ambiguous
amount such as "budget 5k", is not silently treated as dollars: the assistant uses a currency
established earlier in the conversation, or asks.

## Safety in every language

Injection, self-harm, restricted-item and surveillance patterns include English, Urdu (Arabic script),
Roman Urdu, Spanish and French phrasings. Blocking and notice messages are translated.

## Right-to-left layout

Urdu pages set `dir="rtl"`. Prices, model numbers and technical values are wrapped so they keep
left-to-right order inside right-to-left text, and user-generated text uses `dir="auto"`.

## Translation quality

Urdu, Spanish and French strings are machine-assisted and checked automatically for missing keys,
broken placeholders, leftover English and the presence of Urdu script. They have **not** yet been
reviewed by native speakers; that review is listed in the known limitations.
