export const STORAGE_VERSION = 1;
export const STORAGE_KEY = `sudoku-practice:v${STORAGE_VERSION}`;

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const CELL_COUNT = 81;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIntegerInRange(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isBoard(value) {
  return (
    Array.isArray(value) &&
    value.length === CELL_COUNT &&
    value.every((cell) => isIntegerInRange(cell, 0, 9))
  );
}

function isNotes(value) {
  return (
    Array.isArray(value) &&
    value.length === CELL_COUNT &&
    value.every(
      (cellNotes) =>
        Array.isArray(cellNotes) &&
        cellNotes.every((note) => isIntegerInRange(note, 1, 9)) &&
        new Set(cellNotes).size === cellNotes.length,
    )
  );
}

function isSnapshot(value) {
  return isRecord(value) && isBoard(value.board) && isNotes(value.notes);
}

function isCounter(value) {
  return Number.isInteger(value) && value >= 0;
}

function isStartedAt(value) {
  return (
    (typeof value === "number" && Number.isFinite(value) && value >= 0) ||
    (typeof value === "string" && value.length > 0)
  );
}

function isProgress(value) {
  return (
    isRecord(value) &&
    typeof value.puzzleId === "string" &&
    value.puzzleId.length > 0 &&
    DIFFICULTIES.has(value.difficulty) &&
    isBoard(value.board) &&
    isNotes(value.notes) &&
    Array.isArray(value.history) &&
    value.history.every(isSnapshot) &&
    (value.selected === null || isIntegerInRange(value.selected, 0, 80)) &&
    typeof value.noteMode === "boolean" &&
    isCounter(value.elapsedSeconds) &&
    isCounter(value.mistakes) &&
    isCounter(value.hints) &&
    isStartedAt(value.startedAt)
  );
}

function isCompletedPuzzleIds(value) {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === "string" && id.length > 0)
  );
}

function isStorageDocument(value) {
  return (
    isRecord(value) &&
    value.version === STORAGE_VERSION &&
    (value.progress === null || isProgress(value.progress)) &&
    isCompletedPuzzleIds(value.completedPuzzleIds)
  );
}

function emptyDocument() {
  return {
    version: STORAGE_VERSION,
    progress: null,
    completedPuzzleIds: [],
  };
}

function resolveStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }

  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readDocument(storage) {
  const adapter = resolveStorage(storage);
  if (adapter === null || typeof adapter?.getItem !== "function") {
    return null;
  }

  try {
    const serialized = adapter.getItem(STORAGE_KEY);
    if (serialized === null) {
      return emptyDocument();
    }

    const document = JSON.parse(serialized);
    return isStorageDocument(document) ? document : null;
  } catch {
    return null;
  }
}

function writeDocument(document, storage) {
  const adapter = resolveStorage(storage);
  if (adapter === null || typeof adapter?.setItem !== "function") {
    return false;
  }

  try {
    adapter.setItem(STORAGE_KEY, JSON.stringify(document));
    return true;
  } catch {
    return false;
  }
}

export function saveProgress(progress, storage) {
  if (!isProgress(progress)) {
    return false;
  }

  const document = readDocument(storage) ?? emptyDocument();
  document.progress = progress;
  return writeDocument(document, storage);
}

export function loadProgress(storage) {
  return readDocument(storage)?.progress ?? null;
}

export function clearProgress(storage) {
  const document = readDocument(storage) ?? emptyDocument();
  document.progress = null;
  return writeDocument(document, storage);
}

export function saveCompletedPuzzleIds(completedPuzzleIds, storage) {
  let ids;
  try {
    if (typeof completedPuzzleIds === "string") {
      return false;
    }
    ids = [...new Set(completedPuzzleIds)];
  } catch {
    return false;
  }

  if (!isCompletedPuzzleIds(ids)) {
    return false;
  }

  const document = readDocument(storage) ?? emptyDocument();
  document.completedPuzzleIds = ids;
  return writeDocument(document, storage);
}

export function loadCompletedPuzzleIds(storage) {
  return readDocument(storage)?.completedPuzzleIds ?? [];
}
