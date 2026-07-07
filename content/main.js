// Bootstrap: wires the observer to the per-question lifecycle.
// Phase 1 scope: detection + acquisition only — log what we know, render nothing.
"use strict";

(function (SQB) {
  const TAG = "[SQB]";

  // Monotonic token guards async init against rapid Back/Next: a fetch that
  // resolves after the user has moved on is dropped, never mounted.
  let initToken = 0;

  async function onQuestionChange(questionId) {
    const token = ++initToken;
    try {
      const row = await SQB.api.resolveRow(questionId);
      if (token !== initToken) return;
      if (!row) {
        // FR-9b: unmapped ID — stay inert, native page untouched.
        console.warn(TAG, `no mapping for question ${questionId}; staying inert`);
        return;
      }
      const question = await SQB.api.getQuestion(row.external_id);
      if (token !== initToken) return;
      console.log(TAG, {
        questionId,
        type: question.type,
        correctAnswer: question.correct_answer,
        keys: question.keys,
      });
    } catch (err) {
      // FR-9b: replication failed — one warning, no broken half-mounted state.
      if (token === initToken) {
        console.warn(TAG, "get-question replication failed; staying inert:", err);
      }
    }
  }

  function onQuestionGone() {
    initToken++;
  }

  function onSameQuestionMutation() {
    // R2 orphan recovery lands with the UI phases; nothing to re-inject yet.
  }

  SQB.observer.start({ onQuestionChange, onQuestionGone, onSameQuestionMutation });
})(window.SQB);
