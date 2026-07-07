// Multiple-choice interaction (FR-10..FR-15).
// The A-D letters are CSS ::markers on bare <li> elements, so each <li> is
// made interactive itself (wrapper buttons would exclude the letter from the
// click target). Child content — including MathML — is never touched.
"use strict";

(function (SQB) {
  const S = SQB.SELECTORS;
  const M = SQB.MARKERS;
  const C = SQB.CLASSES;

  // Mounts onto the current question's choice list. `restore` re-applies a
  // previously captured state after a React re-render wiped the DOM (R2).
  // Returns null when the DOM doesn't match the payload (controller stays
  // inert per FR-9b).
  function mount(question, callbacks, restore) {
    const list = document.querySelector(S.CHOICE_LIST);
    const items = Array.from(document.querySelectorAll(S.CHOICE_ITEMS));
    const options = Array.isArray(question.answerOptions)
      ? question.answerOptions
      : [];
    if (!list || items.length === 0 || items.length !== options.length) {
      return null;
    }

    // FR-8: keys carries the UUID(s) of the correct answerOptions entry.
    const keys = Array.isArray(question.keys) ? question.keys : [];

    // State machine (PRD §7): IDLE -> SELECTED -> RESOLVED | CHECKED_WRONG,
    // CHECKED_WRONG -> SELECTED (attempt 2) -> RESOLVED. All rendering
    // derives from this object via paint(); no UI mutation outside it.
    const state = restore || {
      phase: "IDLE",
      selectedId: null,
      eliminated: [], // option ids graded wrong: stay red, stay disabled
      finalId: null, // the choice that ended the question (null on override)
      checksUsed: 0,
      outcome: null, // { firstAttemptCorrect, usedRetry } once resolved
    };

    const byId = new Map();
    items.forEach((li, i) => {
      const opt = options[i];
      li.setAttribute(M.CHOICE, opt.id);
      li.classList.add(C.CHOICE);
      li.setAttribute("role", "button");
      li.addEventListener("click", () => select(opt.id));
      li.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select(opt.id);
        }
      });
      byId.set(opt.id, li);
    });

    // FR-12: Check button below the choice list, disabled until a selection.
    const bar = document.createElement("div");
    bar.className = "sqb-controls";
    bar.setAttribute(M.UI_ROOT, "mc");
    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "sqb-btn";
    checkBtn.textContent = "Check";
    checkBtn.addEventListener("click", check);
    bar.appendChild(checkBtn);
    list.insertAdjacentElement("afterend", bar);

    function select(id) {
      if (state.phase === "RESOLVED") return;
      if (state.eliminated.includes(id)) return; // FR-13: misses stay disabled
      state.selectedId = id;
      state.phase = "SELECTED";
      paint();
    }

    function check() {
      if (state.phase !== "SELECTED" || !state.selectedId) return;
      state.checksUsed += 1;
      const correct = keys.includes(state.selectedId);
      if (correct) {
        state.finalId = state.selectedId;
        state.outcome = {
          firstAttemptCorrect: state.checksUsed === 1,
          usedRetry: state.checksUsed > 1,
        };
        resolve();
      } else if (state.checksUsed === 1) {
        // First miss: red + disabled, answer NOT revealed, rest selectable.
        state.eliminated.push(state.selectedId);
        state.selectedId = null;
        state.phase = "CHECKED_WRONG";
        paint();
      } else {
        // Second miss: red on selection, correct choice force-lit by paint().
        state.finalId = state.selectedId;
        state.outcome = { firstAttemptCorrect: false, usedRetry: true };
        resolve();
      }
    }

    function resolve() {
      state.phase = "RESOLVED";
      paint();
      callbacks.onResolved(state.outcome);
    }

    // FR-9 (user checked the native reveal box): lock without grading.
    function lock() {
      if (state.phase === "RESOLVED") return;
      state.phase = "RESOLVED";
      paint();
    }

    function paint() {
      const resolved = state.phase === "RESOLVED";
      // FR-13: when resolved by a wrong final answer, force-light the key.
      const forceKey =
        resolved && state.finalId !== null && !keys.includes(state.finalId);
      for (const [id, li] of byId) {
        const isKey = keys.includes(id);
        const isFinal = resolved && id === state.finalId;
        const eliminated = state.eliminated.includes(id);
        const locked = resolved || eliminated; // FR-14
        li.classList.toggle(C.SELECTED, !resolved && id === state.selectedId);
        li.classList.toggle(C.INCORRECT, eliminated || (isFinal && !isKey));
        li.classList.toggle(C.CORRECT, (isFinal && isKey) || (forceKey && isKey));
        li.classList.toggle(C.LOCKED, locked);
        li.setAttribute("aria-disabled", locked ? "true" : "false");
        li.setAttribute("tabindex", locked ? "-1" : "0");
      }
      checkBtn.disabled = state.phase !== "SELECTED";
      bar.hidden = resolved;
    }

    paint();

    return {
      type: "mcq",
      isMounted: () => document.contains(bar),
      getState: () => state,
      lock,
    };
  }

  SQB.uiMC = { mount };
})(window.SQB);
