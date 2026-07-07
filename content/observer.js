// Question lifecycle detection (FR-1). Watches #question-modal (subtree) and
// derives transitions from #modalTitle text: recon confirmed navigation does
// not change the URL and modal content is replaced wholesale, so the stable
// outer mount is the only reliable observation point.
"use strict";

(function (SQB) {
  const S = SQB.SELECTORS;

  let observer = null;
  let currentQuestionId = null;
  let handlers = null;

  function readQuestionId() {
    const title = document.querySelector(S.MODAL_TITLE);
    return title ? SQB.parseQuestionId(title.textContent) : null;
  }

  function evaluate() {
    const qid = readQuestionId();
    if (qid !== currentQuestionId) {
      currentQuestionId = qid;
      if (qid) {
        handlers.onQuestionChange(qid); // FR-4: hard reset on ID change
      } else {
        handlers.onQuestionGone(); // modal emptied/closed (R8: stay inert)
      }
    } else if (qid) {
      // Same question, DOM churned — lets the controller detect orphaned
      // extension UI after a React re-render (R2).
      handlers.onSameQuestionMutation(qid);
    }
  }

  function attach() {
    const mount = document.querySelector(S.QUESTION_MODAL);
    if (!mount) return false;
    observer = new MutationObserver(evaluate);
    observer.observe(mount, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    evaluate();
    return true;
  }

  function start(h) {
    handlers = h;
    if (attach()) return;
    // #question-modal not in the DOM yet (list view / first load): wait for it.
    const bodyObserver = new MutationObserver(() => {
      if (attach()) bodyObserver.disconnect();
    });
    bodyObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
    });
  }

  SQB.observer = { start };
})(window.SQB);
