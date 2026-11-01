# Demo script (as recorded)

- **Video:** https://youtu.be/K_xpS12dzB8 (public, 2:34 / 153.5 s, 1366×768, H.264 + AAC)
- **Footage:** a scripted Playwright walkthrough of the **production** app (https://fundcart-ai.vercel.app) on 2026-11-01. Every page is real: live Channel3 results, live Gemini output, real PayPal Sandbox popups and captures. Nothing is mocked or staged.
- **Narration:** Microsoft Edge neural TTS (`en-US-AndrewNeural`, +4 %) via `edge-tts`. The video description discloses the synthetic voice.
- **Editing:** FFmpeg only. Clips longer than their narration are sped up (max 2×); PayPal popup clips are cropped next to a caption card. No music.
- **Pipeline:** adapted from the LockSmith pipeline (`F:\Hackathon\ibm-bob-2-hackathon\docs\VIDEO_GENERATION_PIPELINE.md`). Sources: `record.mjs` (recorder), `narration.json`, `build.py`, kept in `F:\ClaudeWorkspace\output\fundcart-ai\`.

## Storyboard

| Starts | Seg | On screen | Narration |
|---|---|---|---|
| 0:00.0 | a | Landing page | You know you need a laptop for university, but not which one fits your budget. And when the right one costs more than you have, asking friends for help is awkward and opaque. FundCart AI fixes both. |
| 0:12.3 | b | Assistant: request typed, agent timeline starts | Describe the need in plain words, with the money you already have. A team of AI agents gets to work. Gemini extracts the intent and budget, and the research agent searches Channel3's live product catalog. |
| 0:25.3 | c | Real Channel3 results, AI explanations, funding gaps | Every result is a real product, with a live price and retailer. Gemini explains the picks using only the retrieved data, and the budget agent computes each funding gap in exact cents. With two hundred dollars saved, the top pick leaves a three hundred and fifty dollar gap. |
| 0:42.3 | d | Side-by-side comparison, "Fund this" | Compare options side by side. Then, instead of giving up, choose Fund this. |
| 0:47.8 | e | Campaign builder: server-computed goal, Gemini draft, publish | FundCart turns the gap into a campaign. The goal is computed on the server from the live price, never by the AI. Gemini drafts an honest story, with no fake urgency or charity claims, and the creator reviews it before publishing. One click, and the campaign is live, with a link to share. |
| 1:06.2 | f | Supporter opens the public campaign, enters amount | A friend opens the link and picks an amount. The server validates it, and rejects overfunding. |
| 1:12.7 | g | PayPal Sandbox popup (real), supporter approves | They pay with PayPal, in the Sandbox, using a test buyer account. FundCart created this order on its own server, with the amount set server-side and an idempotency key, and the supporter approves it inside PayPal. |
| 1:26.1 | h | "Contribution verified", goal reached | Progress only moves after our server captures the payment and verifies it with PayPal: status completed, amount and currency matched. Goal reached. |
| 1:36.0 | i | Creator dashboard, AG Grid payment ledger | The creator's dashboard shows every PayPal order in an AG Grid ledger, with order and capture IDs. The purchase is now unlocked, but nothing is bought automatically. |
| 1:47.1 | j | Separate purchase checkout in PayPal popup | The creator ticks an explicit approval, then pays the store in a separate PayPal checkout, signing in as the creator's own sandbox buyer. The AI prepares. Only a human approves money. |
| 1:59.2 | k | Purchase completed, audit history with webhooks | Purchase completed, and verified. Every step lands in an append-only audit log, including signature-verified PayPal webhooks, deduplicated so nothing is counted twice. And the platform itself cannot pull money back from a recipient. |
| 2:14.5 | l | How it works page | Under the hood: cooperating AI agents, PayPal Orders version two and webhooks, Supabase, and Next.js on Vercel. Playwright end-to-end tests make real Sandbox payments against the live app, and it's all open source. |
| 2:29.5 | m | Outro on landing page | FundCart AI. Find what you need. Fund what you dream. |

## What the recording run did (real Sandbox activity)

- One Channel3 search ("I need a laptop for university under $700", $200 already saved).
- A new campaign on production for a Dell Chromebook 14 ($550.00 − $200.00 = $350.00 goal).
- One $350.00 Sandbox contribution by the supporter test buyer, then one $550.00 Sandbox purchase by the creator's test buyer to the demo store.
- Recorder run details: `F:\ClaudeWorkspace\temp\fundcart-video\rec\run.json` and `marks.json`.

## Re-recording

```bash
PLAYWRIGHT_BROWSERS_PATH=F:/ClaudeWorkspace/tools/ms-playwright node record.mjs https://fundcart-ai.vercel.app <outDir>
F:/ClaudeWorkspace/tools/edge-tts-7.3.1-venv/Scripts/python.exe build.py      # add --no-tts to reuse the MP3s
```

Update the segment `start`/`end` values from the new `marks.json` before building. edge-tts 7.2.8 now returns HTTP 403, so use the 7.3.1 venv.
