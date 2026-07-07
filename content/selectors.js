// Selector config — the single point of repair for all host-page DOM coupling.
// Source: PRD Appendix A (recon, July 7, 2026).
"use strict";

var SQB = window.SQB || (window.SQB = {});

SQB.SELECTORS = Object.freeze({
  // Observer mount; stable outer node that survives content replacement.
  QUESTION_MODAL: "#question-modal",
  // <h4> with text "Question ID: xxxxxxxx"; observer trigger + ID source.
  MODAL_TITLE: "#modalTitle",
  // Row containing both panes.
  QUESTION_CARD: "#question-card",
  // Left pane (stem/stimulus).
  QUESTION_CONTENT: ".question-content",
  // Right pane; SPR injection target (empty div for SPR).
  ANSWER_CONTENT: ".answer-content",
  // MC only.
  CHOICE_LIST: ".answer-choices ul",
  // Bare <li>; A-D letters are CSS ::marker, so the li itself gets button-ized.
  CHOICE_ITEMS: ".answer-choices ul > li",
  // NEVER address this input by id (apricot_check_:r3m: is a React useId,
  // unstable by design).
  RATIONALE_TOGGLE: '.outer-rationale-toggle input[type="checkbox"]',
  // Contains toggle, Add to PDF, nav buttons.
  MODAL_FOOTER: ".footer",
});

// Extension-owned marker attributes (FR-3 idempotency, R2 orphan detection).
SQB.MARKERS = Object.freeze({
  // Set on #question-modal; value is the question ID the mounted UI belongs to.
  MOUNTED: "data-sqb-mounted",
  // Set on each button-ized <li>; value is the answerOption UUID.
  CHOICE: "data-sqb-choice",
  // Set on injected extension containers (Check bar, SPR panel).
  UI_ROOT: "data-sqb-ui",
});

SQB.CLASSES = Object.freeze({
  SUPPRESS: "sqb-suppress-rationale",
  CHOICE: "sqb-choice",
  SELECTED: "sqb-selected",
  CORRECT: "sqb-correct",
  INCORRECT: "sqb-incorrect",
  LOCKED: "sqb-locked",
});

// Parses "Question ID: 48ead968" -> "48ead968" (null if not a question view).
SQB.parseQuestionId = function (titleText) {
  const m = /Question ID:\s*([a-z0-9]+)/i.exec(titleText || "");
  return m ? m[1] : null;
};
