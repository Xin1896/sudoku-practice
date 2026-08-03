import assert from "node:assert/strict";
import test from "node:test";

import {
  DIFFICULTIES,
  PUZZLES,
  choosePuzzle,
  getPuzzlesByDifficulty,
} from "../site/js/puzzles.js";
import {
  countSolutions,
  getCandidates,
  isSolved,
  parseGrid,
} from "../site/js/sudoku.js";

const UNITS = [
  ...Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 9 }, (_, column) => row * 9 + column),
  ),
  ...Array.from({ length: 9 }, (_, column) =>
    Array.from({ length: 9 }, (_, row) => row * 9 + column),
  ),
  ...Array.from({ length: 9 }, (_, box) => {
    const boxRow = Math.floor(box / 3) * 3;
    const boxColumn = (box % 3) * 3;
    return Array.from({ length: 9 }, (_, offset) => {
      const row = boxRow + Math.floor(offset / 3);
      const column = boxColumn + (offset % 3);
      return row * 9 + column;
    });
  }),
];

function findNakedSingle(board) {
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] !== 0) {
      continue;
    }

    const candidates = getCandidates(board, index);
    if (candidates.length === 1) {
      return { index, value: candidates[0] };
    }
  }

  return null;
}

function findHiddenSingle(board) {
  for (const unit of UNITS) {
    for (let value = 1; value <= 9; value += 1) {
      const positions = unit.filter(
        (index) =>
          board[index] === 0 && getCandidates(board, index).includes(value),
      );
      if (positions.length === 1) {
        return { index: positions[0], value };
      }
    }
  }

  return null;
}

function solvesWithSingles(grid, includeHiddenSingles) {
  const board = parseGrid(grid);

  while (board.includes(0)) {
    const next =
      findNakedSingle(board) ??
      (includeHiddenSingles ? findHiddenSingle(board) : null);
    if (next === null) {
      return false;
    }
    board[next.index] = next.value;
  }

  return isSolved(board);
}

test("题库包含三档且每档至少六道稳定题目", () => {
  assert.deepEqual(DIFFICULTIES, ["easy", "medium", "hard"]);
  assert.ok(PUZZLES.length >= 18);

  const ids = new Set();
  for (const puzzle of PUZZLES) {
    assert.match(puzzle.id, /^[a-z0-9-]+$/);
    assert.equal(ids.has(puzzle.id), false, `重复题目 ID：${puzzle.id}`);
    ids.add(puzzle.id);
    assert.ok(DIFFICULTIES.includes(puzzle.difficulty));
  }

  for (const difficulty of DIFFICULTIES) {
    assert.ok(
      getPuzzlesByDifficulty(difficulty).length >= 6,
      `${difficulty} 题目不足六道`,
    );
  }
});

test("每道题和解答都是 81 格且给定数字与解答一致", () => {
  for (const entry of PUZZLES) {
    assert.equal(entry.puzzle.length, 81, `${entry.id} 题盘长度错误`);
    assert.equal(entry.solution.length, 81, `${entry.id} 解答长度错误`);
    assert.match(entry.puzzle, /^[0-9.]{81}$/, `${entry.id} 题盘字符错误`);
    assert.match(entry.solution, /^[1-9]{81}$/, `${entry.id} 解答字符错误`);

    const puzzle = parseGrid(entry.puzzle);
    const solution = parseGrid(entry.solution);
    for (let index = 0; index < 81; index += 1) {
      assert.ok(
        puzzle[index] === 0 || puzzle[index] === solution[index],
        `${entry.id} 第 ${index} 格给定与解答不一致`,
      );
    }
  }
});

test("每道题的解答有效并且题盘恰好只有一个解", () => {
  for (const entry of PUZZLES) {
    assert.equal(isSolved(parseGrid(entry.solution)), true, `${entry.id} 解答无效`);
    assert.equal(
      countSolutions(parseGrid(entry.puzzle)),
      1,
      `${entry.id} 不是唯一解`,
    );
  }
});

test("简单题只用显性单数即可完成", () => {
  for (const entry of getPuzzlesByDifficulty("easy")) {
    assert.equal(
      solvesWithSingles(entry.puzzle, false),
      true,
      `${entry.id} 超出简单题技巧门槛`,
    );
  }
});

test("中等题需要隐性单数且不需要更高阶技巧", () => {
  for (const entry of getPuzzlesByDifficulty("medium")) {
    assert.equal(
      solvesWithSingles(entry.puzzle, false),
      false,
      `${entry.id} 只用显性单数即可完成`,
    );
    assert.equal(
      solvesWithSingles(entry.puzzle, true),
      true,
      `${entry.id} 需要高于隐性单数的技巧`,
    );
  }
});

test("困难题无法只用显性和隐性单数完成", () => {
  for (const entry of getPuzzlesByDifficulty("hard")) {
    assert.equal(
      solvesWithSingles(entry.puzzle, true),
      false,
      `${entry.id} 只用单数技巧即可完成`,
    );
  }
});

test("按难度查询只返回对应题目且未知难度返回空数组", () => {
  const medium = getPuzzlesByDifficulty("medium");

  assert.ok(medium.length >= 6);
  assert.ok(medium.every((entry) => entry.difficulty === "medium"));
  assert.deepEqual(getPuzzlesByDifficulty("unknown"), []);
});

test("choosePuzzle 优先选择未完成题目", () => {
  const easy = getPuzzlesByDifficulty("easy");
  const completedIds = new Set(easy.slice(0, 2).map((entry) => entry.id));

  const selected = choosePuzzle("easy", completedIds, () => 0);

  assert.equal(selected.id, easy[2].id);
  assert.equal(completedIds.has(selected.id), false);
});

test("choosePuzzle 在该难度全部完成后仍可继续选题", () => {
  const hard = getPuzzlesByDifficulty("hard");
  const completedIds = hard.map((entry) => entry.id);

  assert.equal(choosePuzzle("hard", completedIds, () => 0).id, hard[0].id);
  assert.equal(choosePuzzle("unknown", completedIds, () => 0), null);
});
