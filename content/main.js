// Controller: wires the observer to the per-question lifecycle — acquisition,
// spoiler suppression, UI mounting, resolution, and R2 orphan recovery.
"use strict";

(function (SQB) {
  const S = SQB.SELECTORS;
  const M = SQB.MARKERS;
  const TAG = "[SQB]";

  // Monotonic token guards async init against rapid Back/Next: a fetch that
  // resolves after the user has moved on is dropped, never mounted.
  let initToken = 0;
  // Current question context: { questionId, row, question, ui, resolved, inert }
  let active = null;
  // True while we toggle the native checkbox ourselves, so the FR-9 override
  // listener only reacts to the user's own clicks.
  let checkboxGuard = false;

  function modalEl() {
    return document.querySelector(S.QUESTION_MODAL);
  }

  function setSuppressed(on) {
    const modal = modalEl();
    if (modal) modal.classList.toggle(SQB.CLASSES.SUPPRESS, on);
  }

  // Drives the native reveal checkbox through a real click so the page's
  // React handlers stay in sync (FR-7 init-time uncheck, RESOLVED reveal).
  function setNativeCheckbox(checked) {
    const box = document.querySelector(S.RATIONALE_TOGGLE);
    if (box && box.checked !== checked) {
      checkboxGuard = true;
      try {
        box.click();
      } finally {
        checkboxGuard = false;
      }
    }
  }

  // FR-9: if the user deliberately checks the native box mid-question,
  // resolve immediately and unsuppress — don't fight the user.
  function attachOverrideListener() {
    const box = document.querySelector(S.RATIONALE_TOGGLE);
    if (!box) return;
    if (box.checked) {
      resolveByOverride();
      return;
    }
    box.addEventListener("change", () => {
      if (!checkboxGuard && box.checked) resolveByOverride();
    });
  }

  function resolveByOverride() {
    if (!active || active.resolved) return;
    active.resolved = true;
    if (active.ui) active.ui.lock();
    setSuppressed(false);
    // No record: the question was revealed, not answered (R6: unresolved-by-
    // attempt is not wrong).
  }

  // UI callback on a graded resolution (FR-13 paths, later SPR self-assess).
  function onResolved(outcome) {
    if (!active || active.resolved) return;
    active.resolved = true;
    setSuppressed(false); // FR-20: rationale at the pedagogically correct moment
    setNativeCheckbox(true); // native region renders only while box is checked
    void outcome; // recording layer lands in Phase 4
  }

  function mountUI(restore) {
    if (!active || active.inert) return;
    const { question } = active;
    let ui = null;
    if (question.type === "mcq") {
      ui = SQB.uiMC.mount(question, { onResolved }, restore);
    } else if (question.type === "spr") {
      // SPR flow lands in Phase 3; until then the native page is untouched.
      active.inert = true;
      setSuppressed(false);
      return;
    } else {
      active.inert = true;
      setSuppressed(false);
      console.warn(TAG, `unknown question type "${question.type}"; staying inert`);
      return;
    }
    if (!ui) return; // DOM not settled yet — retried on the next mutation
    active.ui = ui;
    const modal = modalEl();
    if (modal) modal.setAttribute(M.MOUNTED, active.questionId);
    attachOverrideListener();
    if (active.resolved) setSuppressed(false);
  }

  async function onQuestionChange(questionId) {
    teardown();
    const token = ++initToken;
    const modal = modalEl();
    if (!modal) return;
    // FR-3: idempotency — abort if this question's UI is already mounted.
    if (modal.getAttribute(M.MOUNTED) === questionId) return;

    // FR-7 + R5: suppress and clear a carried-over reveal checkbox before
    // anything can flash. MutationObserver callbacks run before paint, so
    // a pre-checked box from the previous question is never visible.
    setSuppressed(true);
    setNativeCheckbox(false);

    let row, question;
    try {
      row = await SQB.api.resolveRow(questionId);
      if (token !== initToken) return;
      if (!row) throw new Error("question ID not found in any known context");
      question = await SQB.api.getQuestion(row.external_id);
      if (token !== initToken) return;
    } catch (err) {
      // FR-9b: replication failed — inert, native behavior restored, one warning.
      if (token === initToken) {
        setSuppressed(false);
        console.warn(TAG, `staying inert for ${questionId}:`, err.message || err);
      }
      return;
    }

    active = {
      questionId,
      row,
      question,
      ui: null,
      resolved: false,
      inert: false,
    };
    mountUI(null);
  }

  function onSameQuestionMutation(questionId) {
    if (!active || active.questionId !== questionId || active.inert) return;
    if (!active.ui) {
      // Fetch finished before the choice DOM settled — try again.
      mountUI(null);
    } else if (!active.ui.isMounted()) {
      // R2: a React re-render wiped the injected UI — re-inject with state.
      mountUI(active.ui.getState());
    }
  }

  function teardown() {
    initToken++;
    const modal = modalEl();
    if (modal) modal.removeAttribute(M.MOUNTED);
    active = null;
  }

  function onQuestionGone() {
    teardown();
    setSuppressed(false); // R8: inert outside question views
  }

  SQB.observer.start({ onQuestionChange, onQuestionGone, onSameQuestionMutation });
})(window.SQB);
