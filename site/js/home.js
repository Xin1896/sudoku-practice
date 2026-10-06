import { registerServiceWorker } from "./pwa.js";

const SAVE_KEYS = Object.freeze({
  sudoku: "sudoku-practice:v1",
  xiangqi: "yike-xiangqi:v1",
  chess: "yike-chess:v1",
  go: "yike-go:v1",
});

function readSaved(key) {
  try {
    const serialized = globalThis.localStorage?.getItem(key) ?? null;
    return serialized === null ? null : JSON.parse(serialized);
  } catch {
    return null;
  }
}

function hasUnfinishedGame(game) {
  const saved = readSaved(SAVE_KEYS[game]);
  if (saved === null || typeof saved !== "object") {
    return false;
  }

  if (game === "sudoku") {
    return saved.progress !== null && typeof saved.progress === "object";
  }

  return saved.version === 1 && saved.finished === false;
}

for (const leaf of document.querySelectorAll("[data-game]")) {
  const badge = leaf.querySelector("[data-resume]");
  if (badge !== null && hasUnfinishedGame(leaf.dataset.game)) {
    badge.hidden = false;
  }
}

registerServiceWorker();
