// Session recording (FR-22..FR-24): a write-only, append-only layer over
// chrome.storage.local. Records are built entirely from API data; nothing
// leaves the browser. Re-answering a question appends — history preserved.
"use strict";

(function (SQB) {
  const KEY = "sqbRecords";

  // Serialize writes through a promise chain so two rapid resolutions can't
  // interleave their get/set pairs and drop a record.
  let queue = Promise.resolve();

  function record(rec) {
    queue = queue
      .then(async () => {
        const data = await chrome.storage.local.get(KEY);
        const records = Array.isArray(data[KEY]) ? data[KEY] : [];
        records.push(rec);
        await chrome.storage.local.set({ [KEY]: records });
      })
      .catch((err) => {
        console.warn("[SQB] failed to record result:", err);
      });
    return queue;
  }

  SQB.session = { record };
})(window.SQB);
