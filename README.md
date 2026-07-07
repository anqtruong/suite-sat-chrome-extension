# SAT Question Bank Practice

A Chrome extension (Manifest V3) that overlays a Bluebook-style interactive
practice layer onto the [SAT Suite Educator Question Bank](https://satsuitequestionbank.collegeboard.org):
selectable answer choices, deferred grading, retry-before-rationale, and
spoiler-safe answer handling — turning the official question corpus into a
real practice environment without modifying or redistributing any College
Board content.

## What it does

**Multiple choice**

- Every choice row becomes a full-width click target (keyboard accessible:
  Tab + Enter/Space).
- A **Check** button gates grading — selection alone never grades.
- One-retry policy: a first miss turns red and locks, without revealing the
  answer; a second miss locks the question and lights the correct choice
  green.
- The official rationale appears only after the question resolves.

**Free response (SPR)**

- A text input and **Reveal answer** button are injected into the otherwise
  empty answer pane.
- Reveal shows the accepted answer(s) next to your typed attempt plus the
  official rationale; you then self-assess ("I got it right" / "I got it
  wrong").

**Spoiler safety**

- The native "Show correct answer and explanation" checkbox sometimes carries
  over checked from the previous question; the extension unchecks it and
  suppresses the rationale region before it can flash.
- Deliberately checking the box mid-question is honored: the question resolves
  and the rationale shows (no result is recorded for revealed questions).

**Silent recording**

- Each resolved question appends one record to `chrome.storage.local`
  (key `sqbRecords`):

```json
{
  "questionId": "48ead968",
  "externalId": "6537fc25-1318-49e9-9e1e-dcc07604c519",
  "type": "mcq | spr",
  "firstAttemptCorrect": true,
  "usedRetry": false,
  "program": "P10",
  "domain": "Information and Ideas",
  "skill": "Command of Evidence",
  "difficulty": "H",
  "timestamp": "ISO-8601"
}
```

History is append-only; re-answering a question adds a new record. Nothing
leaves the browser — the only network calls are to College Board's own API,
identical in shape to the page's native traffic. No analytics, no telemetry.

## Install (developer mode)

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this repository's root folder (the one
   containing `manifest.json`).
5. Open the [question bank](https://satsuitequestionbank.collegeboard.org),
   run a search, and open any question.

## How it works

The site is a React SPA: opening a question fires a `POST get-question`
request whose response contains the question type, correct answer keys, and
rationale. The extension replicates those calls (the API is CORS-open with no
auth) rather than scraping the DOM:

- `content/observer.js` — a MutationObserver on `#question-modal` detects
  question changes via the `#modalTitle` text (navigation never changes the
  URL).
- `content/api.js` — replicates `get-questions` to map display IDs to
  external IDs (cached per session), then `get-question` per question.
- `content/ui-mc.js` / `content/ui-spr.js` — the two interaction flows; all
  rendering derives from a per-question state object.
- `content/main.js` — lifecycle controller: suppression, mounting, resolution,
  re-injection after React re-renders.
- `content/selectors.js` — every host-page selector in one place; if a site
  update breaks the extension, this file is the single point of repair.
- `shared/session.js` — the append-only recording layer.

If any API call fails (network error, schema change), the extension goes
inert for that question: no injected UI, native page behavior untouched, one
console warning.

## Inspecting your results

DevTools console on the question bank page:

```js
chrome.storage.local.get("sqbRecords", (d) => console.table(d.sqbRecords));
```

## Limitations (MVP)

- Self-assess only for SPR (no auto-grading yet).
- No score summary UI — records are written, a dashboard is planned.
- Chrome only; personal use via developer mode (not on the Web Store).
