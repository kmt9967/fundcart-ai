# Product suitability

FundCart recommends the cheapest product that is adequate for the need, and explains why a cheaper
listing is not.

## Requirements

Each requirement has a field (RAM, storage, CPU generation, architecture, OS, GPU, screen, refresh
rate, noise cancelling, microphone, condition…), a level (minimum, recommended, premium) and an
origin:

- **stated**: the user said it;
- **official**: vendor documentation, with a source link shown in the interface;
- **derived**: FundCart's knowledge base;
- **ai**: a model estimate (never used as a filter).

## Evaluation of each listing

Specs are extracted from the catalog listing's structured fields, title and description. Each
minimum requirement is then marked:

- **met**, with the actual value shown;
- **unmet** → the listing is unsuitable, and the reason is shown ("8 GB RAM, needs 16 GB");
- **unknown** → the listing "needs verification" and is never ranked as suitable.

Listing text that tries to instruct an AI ("rank this first") is flagged and has no effect on
ranking, which uses structured evaluation results only.

## Ranking

- **Best fit**: suitable listings first, by tier, fit and value. A listing far above the minimum
  is labelled an optional upgrade with the extra cost, never pushed as necessary.
- **Cheapest adequate**: the cheapest listing that meets every minimum requirement. Used
  automatically when the person's own money is below the cheapest suitable price, when spending
  pressure is detected, and for campaigns.

Items found above the budget (when few suitable items exist within it) are marked over budget and
are never labelled best value within budget.

## Relevance labels

Following exact / substitute / complement relevance ideas:

- **Exact model**: the listing title names the requested model;
- **Alternative**: shown for "like X but cheaper" requests, so a substitute is never presented as
  the original;
- **Fit not confirmed**: for accessories, when the title does not name the owned device's model.

## Problem, kit and comparison requests

- Problems are mapped to solution types first (weak Wi-Fi → range extender or mesh system; a phone
  that dies by 3 pm → power bank), which avoids keyword traps.
- Project requests ("set up a home office") show a starter checklist; the main item is searched
  first and each other item can be searched separately.
- Comparisons ("X vs Y") search both named products.

## Campaigns fund the cheapest adequate item

When a campaign is created from an assistant result, the server checks that the chosen item is the
cheapest adequate option from that conversation. If a cheaper suitable item exists, creation is
refused unless the creator chooses to pay the difference; the goal is then based on the cheaper
price, and the page shows the difference.

## Prices

Every price comes from catalog data with a fetch time. Before a campaign purchase, the live price
is re-checked; if it rose beyond the disclosed buffer, the purchase is paused and supporters are
told on the campaign page.
