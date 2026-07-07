// API replication layer (FR-5/FR-6). Replays the page's own request shapes
// against qbank-api.collegeboard.org; the endpoint is CORS-open with no auth.
"use strict";

(function (SQB) {
  const API_BASE =
    "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital";

  // Known get-questions parameter contexts, ordered by expected usage.
  // asmtEventId 100 = PSAT/NMSQT & PSAT 10 (confirmed in recon); test 1 =
  // Reading & Writing with its confirmed domain string. The remaining rows
  // are candidates so lazy resolution can find questions from other program
  // or section contexts; a wrong candidate costs one failed/empty fetch and
  // is skipped thereafter.
  const CONTEXTS = [
    { asmtEventId: 100, test: 1, domain: "INI,CAS,EOI,SEC" },
    { asmtEventId: 100, test: 2, domain: "H,P,Q,S" },
    { asmtEventId: 99, test: 1, domain: "INI,CAS,EOI,SEC" },
    { asmtEventId: 99, test: 2, domain: "H,P,Q,S" },
    { asmtEventId: 102, test: 1, domain: "INI,CAS,EOI,SEC" },
    { asmtEventId: 102, test: 2, domain: "H,P,Q,S" },
  ];

  // contextKey -> Map<questionId, row> (FR-5; lazy per-context, session cache)
  const contextMaps = new Map();
  // external_id -> get-question payload
  const questionCache = new Map();

  function contextKey(ctx) {
    return `${ctx.asmtEventId}:${ctx.test}`;
  }

  async function post(path, body) {
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${path} -> HTTP ${res.status}`);
    }
    return res.json();
  }

  async function loadContext(ctx) {
    const key = contextKey(ctx);
    if (contextMaps.has(key)) return contextMaps.get(key);
    let rows;
    try {
      rows = await post("/get-questions", ctx);
    } catch (err) {
      rows = null; // cache the miss; a bad candidate context shouldn't retry forever
    }
    const map = new Map();
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row && row.questionId) map.set(row.questionId, row);
      }
    }
    contextMaps.set(key, map);
    return map;
  }

  // Resolves a display ID (from #modalTitle) to its get-questions row,
  // lazily scanning known contexts until found. Returns null if unmapped.
  async function resolveRow(questionId) {
    for (const map of contextMaps.values()) {
      if (map.has(questionId)) return map.get(questionId);
    }
    for (const ctx of CONTEXTS) {
      if (contextMaps.has(contextKey(ctx))) continue;
      const map = await loadContext(ctx);
      if (map.has(questionId)) return map.get(questionId);
    }
    return null;
  }

  // FR-6: full question payload (type, stem, answerOptions, keys, rationale).
  async function getQuestion(externalId) {
    if (questionCache.has(externalId)) return questionCache.get(externalId);
    const payload = await post("/get-question", { external_id: externalId });
    questionCache.set(externalId, payload);
    return payload;
  }

  SQB.api = { resolveRow, getQuestion };
})(window.SQB);
