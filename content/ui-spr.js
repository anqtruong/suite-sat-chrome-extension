// Free-response (SPR) interaction (FR-16..FR-19b).
// The native page renders SPR questions with an empty .answer-content pane;
// the extension injects an input + Reveal flow there. Typing is encouraged
// but not required. Grading is self-assessed (no auto-grading in MVP).
"use strict";

(function (SQB) {
  const S = SQB.SELECTORS;
  const M = SQB.MARKERS;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Mounts into the SPR answer pane. Same contract as uiMC.mount: `restore`
  // re-applies captured state after a re-render (R2); returns null when the
  // pane is missing so the controller stays inert (FR-9b).
  function mount(question, callbacks, restore) {
    const pane = document.querySelector(S.ANSWER_CONTENT);
    if (!pane) return null;

    // FR-18: accepted answers come from correct_answer (display form).
    const accepted = Array.isArray(question.correct_answer)
      ? question.correct_answer
      : [];

    // IDLE -> REVEALED -> RESOLVED; all rendering derives from this object.
    const state = restore || {
      phase: "IDLE",
      typed: "",
      outcome: null, // { firstAttemptCorrect, usedRetry: false } once assessed
    };

    const root = el("div", "sqb-spr");
    root.setAttribute(M.UI_ROOT, "spr");

    const inputLabel = el("label", "sqb-spr-label", "Your answer");
    const input = el("input", "sqb-input");
    input.type = "text";
    input.placeholder = "Type your answer (optional)";
    input.autocomplete = "off";
    input.value = state.typed;
    input.addEventListener("input", () => {
      state.typed = input.value;
    });
    inputLabel.appendChild(input);

    const revealBtn = el("button", "sqb-btn", "Reveal answer");
    revealBtn.type = "button";
    revealBtn.addEventListener("click", reveal);

    // Post-reveal block: accepted answer(s) beside the student's own input,
    // then the self-assess pair.
    const result = el("div", "sqb-spr-result");
    const acceptedHeading = el(
      "div",
      "sqb-spr-heading",
      accepted.length > 1 ? "Accepted answers" : "Accepted answer"
    );
    const acceptedList = el("ul", "sqb-spr-answers");
    for (const answer of accepted) {
      acceptedList.appendChild(el("li", null, String(answer)));
    }
    const assessRow = el("div", "sqb-assess");
    const assessPrompt = el("div", "sqb-spr-heading", "How did you do?");
    const rightBtn = el("button", "sqb-btn sqb-btn-right", "I got it right");
    rightBtn.type = "button";
    rightBtn.addEventListener("click", () => assess(true));
    const wrongBtn = el("button", "sqb-btn sqb-btn-wrong", "I got it wrong");
    wrongBtn.type = "button";
    wrongBtn.addEventListener("click", () => assess(false));
    assessRow.append(assessPrompt, rightBtn, wrongBtn);
    result.append(acceptedHeading, acceptedList, assessRow);

    root.append(inputLabel, revealBtn, result);
    pane.appendChild(root);

    function reveal() {
      if (state.phase !== "IDLE") return;
      state.phase = "REVEALED";
      paint();
      callbacks.onReveal(); // FR-20: SPR rationale shows at Reveal
    }

    function assess(gotItRight) {
      if (state.phase !== "REVEALED") return;
      state.phase = "RESOLVED";
      state.outcome = { firstAttemptCorrect: gotItRight, usedRetry: false };
      paint();
      callbacks.onResolved(state.outcome); // FR-19: record and lock
    }

    // External RESOLVED (user-override) — lock without an outcome.
    function lock() {
      if (state.phase === "RESOLVED") return;
      state.phase = "RESOLVED";
      paint();
    }

    function paint() {
      const revealed = state.phase !== "IDLE";
      const resolved = state.phase === "RESOLVED";
      input.disabled = revealed; // typed answer persists, read-only (FR-18)
      revealBtn.hidden = revealed;
      result.hidden = !revealed;
      rightBtn.disabled = resolved;
      wrongBtn.disabled = resolved;
      if (state.outcome) {
        const picked = state.outcome.firstAttemptCorrect ? rightBtn : wrongBtn;
        picked.classList.add("sqb-assess-picked");
      }
    }

    paint();

    return {
      type: "spr",
      isMounted: () => document.contains(root),
      getState: () => state,
      lock,
    };
  }

  SQB.uiSPR = { mount };
})(window.SQB);
