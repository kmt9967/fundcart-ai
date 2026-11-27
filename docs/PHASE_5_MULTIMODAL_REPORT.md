# Phase 5 multimodal report

The workspace adds optional browser dictation to starting and refining a shopping request. FundCart requests on-device processing and copies recognized text into the existing editable field. Users submit through the same validated request flow. Typing stays available when recognition fails or is missing. FundCart sends no audio to its backend. The document permissions policy allows the same origin to request microphone permission. Browser permission still applies.

English, Urdu, Spanish and French UI copy is present. The Chromium test supplies a simulated browser recognizer and verifies that dictating does not submit a request. Physical microphone and language-pack availability need real-device acceptance. Signed-in users can request Gemini search suggestions using a JPEG, PNG or WebP file. The browser resizes and re-encodes the image to JPEG. The endpoint requires an account, applies shared limits, bounds the body, checks JPEG markers, and does not store the image. Provider processing and retention remain subject to the configured Gemini account. The suggestion is editable and never submits a catalog request automatically. The browser test mocks the suggestion response and separately tests real endpoint authorization and content-type rejection.

Provider-based photo acceptance, image-specific follow-up context, saved account preference controls, and explicit personalization opt-out remain open.

[Web Speech specification](https://wicg.github.io/speech-api/)
