# Phase 3 commerce report

- Search cache reuse is limited to 15 minutes. Invalid search response shapes fail visibly instead of becoming an empty cached result. USD comparisons require USD prices. The product detail fallback rejects a provider result for a different ID.
- Sandbox direct purchase refreshes the current product. Campaign purchase refreshes its recorded product. Both require the current in-stock USD price and merchant to match the approved terms. A changed price or seller blocks checkout before PayPal order creation.
- Cached detail and historical prices remain useful for discovery. Purchase rechecks use a separate uncached request. Substitution and re-quote approval UI, per-variant identity, availability lifecycle, and authorized provider acceptance remain open.

[Channel3 API guidance](https://github.com/channel3-ai/skills/blob/main/skills/channel3-api/SKILL.md)
