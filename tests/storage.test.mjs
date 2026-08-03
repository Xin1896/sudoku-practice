import assert from "node:assert/strict";
import test from "node:test";

import {
  STORAGE_KEY,
  STORAGE_VERSION,
  clearProgress,
  loadCompletedPuzzleIds,
  loadProgress,
  saveCompletedPuzzleIds,
  saveProgress,
} from "../site/js/storage.js";

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function emptyNotes() {
  return Array.from({ length: 81 }, () => []);
}

function makeProgress() {
  const board = Array(81).fill(0);
  board[0] = 5;
  const notes = emptyNotes();
  notes[1] = [2, 7];

  return {
    puzzleId: "easy-001",
    difficulty: "easy",
    board,
    notes,
    history: [
      {
        board: Array(81).fill(0),
        notes: emptyNotes(),
      },
    ],
    selected: 1,
    noteMode: true,
    elapsedSeconds: 97,
    mistakes: 2,
    hints: 1,
    startedAt: 1_786_000_000_000,
  };
}

test("存储键和文档都带有显式版本", () => {
  const storage = createMemoryStorage();

  assert.match(STORAGE_KEY, /v\d+$/);
  assert.equal(saveProgress(makeProgress(), storage), true);

  const document = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(document.version, STORAGE_VERSION);
});

test("保存并完整恢复当前题目进度", () => {
  const storage = createMemoryStorage();
  const progress = makeProgress();

  assert.equal(saveProgress(progress, storage), true);
  assert.deepEqual(loadProgress(storage), progress);
});

test("保存时创建深拷贝，后续修改不会污染已保存进度", () => {
  const storage = createMemoryStorage();
  const progress = makeProgress();

  saveProgress(progress, storage);
  progress.board[0] = 9;
  progress.notes[1].push(8);
  progress.history[0].board[0] = 4;

  const restored = loadProgress(storage);
  assert.equal(restored.board[0], 5);
  assert.deepEqual(restored.notes[1], [2, 7]);
  assert.equal(restored.history[0].board[0], 0);
});

test("完成题目 ID 可去重保存并独立读取", () => {
  const storage = createMemoryStorage();
  const progress = makeProgress();

  saveProgress(progress, storage);
  assert.equal(
    saveCompletedPuzzleIds(["easy-001", "medium-002", "easy-001"], storage),
    true,
  );

  assert.deepEqual(loadCompletedPuzzleIds(storage), ["easy-001", "medium-002"]);
  assert.deepEqual(loadProgress(storage), progress);
});

test("清除当前进度时保留已完成题目 ID", () => {
  const storage = createMemoryStorage();

  saveProgress(makeProgress(), storage);
  saveCompletedPuzzleIds(["hard-006"], storage);
  assert.equal(clearProgress(storage), true);

  assert.equal(loadProgress(storage), null);
  assert.deepEqual(loadCompletedPuzzleIds(storage), ["hard-006"]);
});

test("损坏 JSON、版本不符或形状不合法时安全回退", () => {
  const storage = createMemoryStorage();
  const invalidDocuments = [
    "{broken-json",
    JSON.stringify({
      version: STORAGE_VERSION + 1,
      progress: makeProgress(),
      completedPuzzleIds: ["easy-001"],
    }),
    JSON.stringify({
      version: STORAGE_VERSION,
      progress: { ...makeProgress(), board: [1, 2, 3] },
      completedPuzzleIds: ["easy-001"],
    }),
    JSON.stringify({
      version: STORAGE_VERSION,
      progress: makeProgress(),
      completedPuzzleIds: [42],
    }),
  ];

  for (const invalidDocument of invalidDocuments) {
    storage.setItem(STORAGE_KEY, invalidDocument);
    assert.doesNotThrow(() => loadProgress(storage));
    assert.equal(loadProgress(storage), null);
    assert.deepEqual(loadCompletedPuzzleIds(storage), []);
  }
});

test("不可用的存储适配器不会让读写操作抛出", () => {
  const unavailableStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(loadProgress(unavailableStorage), null);
  assert.deepEqual(loadCompletedPuzzleIds(unavailableStorage), []);
  assert.equal(saveProgress(makeProgress(), unavailableStorage), false);
  assert.equal(saveCompletedPuzzleIds(["easy-001"], unavailableStorage), false);
  assert.equal(clearProgress(unavailableStorage), false);
});
