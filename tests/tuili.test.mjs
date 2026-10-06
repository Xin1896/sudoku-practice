import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  COLOR_NAMES,
  LEVELS,
  LEVEL_SIZES,
  SHAPE_NAMES,
  cellName,
  clueInvolvement,
  countSolutions,
  createRandom,
  describeClue,
  evaluateClue,
  explainReasons,
  generatePuzzle,
  gradePuzzle,
  isSolved,
  isValidPuzzle,
  lineName,
  nextDeduction,
  tileColor,
  tileName,
  tileShape,
} from "../site/js/tuili.js";
import { PUZZLES, choosePuzzle, dailyPuzzle, findPuzzle } from "../site/js/tuili-puzzles.js";

const projectRoot = new URL("../", import.meta.url);
const TECHNIQUES = Object.freeze([
  "direct",
  "only-tile-here",
  "only-place-for-tile",
  "adjacent",
  "line",
  "same-line",
  "contradiction",
]);
const ALL_TYPES = Object.freeze(["at", "notIn", "corners", "adjacent", "distinct", "sameLine"]);
const LEVEL_RULES = Object.freeze({
  1: { tiers: [1], clues: [4, 7], types: ["at", "notIn", "corners"] },
  2: { tiers: [2], clues: [4, 6], types: ["at", "notIn", "corners", "adjacent"] },
  3: { tiers: [3], clues: [4, 7], types: ALL_TYPES },
  4: { tiers: [3, 4], clues: [7, 12], types: ALL_TYPES },
});
const REASON_PUZZLE = deepFreeze({
  id: "test-reasons",
  level: 1,
  size: 3,
  solution: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  clues: [
    { type: "at", cell: 0, color: 0, shape: 0 },
    { type: "at", cell: 1, color: 0, shape: 1 },
    { type: "notIn", line: row(1), color: 0, shape: null },
    { type: "notIn", line: row(2), color: 0, shape: null },
    { type: "adjacent", a: 1, b: 2, dir: "right" },
    { type: "at", cell: 8, color: 2, shape: 2 },
  ],
});

function row(index) {
  return { axis: "row", index };
}

function col(index) {
  return { axis: "col", index };
}

function deepFreeze(value) {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function board(size, entries = {}) {
  const placements = Array(size * size).fill(null);
  for (const [cell, tile] of Object.entries(entries)) {
    placements[Number(cell)] = tile;
  }
  return Object.freeze(placements);
}

function isFullAt(clue) {
  return clue.type === "at" && clue.color !== null && clue.shape !== null;
}

function citedIndexes(text) {
  return [...text]
    .map((char) => char.codePointAt(0))
    .filter((code) => (code >= 0x2460 && code <= 0x2473) || (code >= 0x3251 && code <= 0x325f))
    .map((code) => (code >= 0x3251 ? code - 0x3251 + 20 : code - 0x2460));
}

function holds(size, clue, placements) {
  const color = (tile) => Math.floor(tile / size);
  const shape = (tile) => tile % size;
  const row = (cell) => Math.floor(cell / size);
  const col = (cell) => cell % size;
  const has = (tile) =>
    (clue.color === null || color(tile) === clue.color) &&
    (clue.shape === null || shape(tile) === clue.shape);
  const lineCells = (line) =>
    Array.from({ length: size }, (_, offset) =>
      line.axis === "row" ? line.index * size + offset : offset * size + line.index,
    );
  const corners = [0, size - 1, size * size - size, size * size - 1];
  const from = placements.indexOf(clue.a);
  const to = placements.indexOf(clue.b);

  switch (clue.type) {
    case "at":
      return has(placements[clue.cell]);
    case "notIn":
      return lineCells(clue.line).every((cell) => !has(placements[cell]));
    case "corners":
      return corners.every((cell) => !has(placements[cell]));
    case "adjacent":
      return clue.dir === "right"
        ? row(from) === row(to) && col(to) === col(from) + 1
        : col(from) === col(to) && row(to) === row(from) + 1;
    case "distinct": {
      const read = clue.attr === "color" ? color : shape;
      return new Set(lineCells(clue.line).map((cell) => read(placements[cell]))).size === size;
    }
    default:
      return clue.axis === "row" ? row(from) === row(to) : col(from) === col(to);
  }
}

function randomClue(size, random) {
  const pick = (count) => Math.floor(random() * count);
  const count = size * size;
  const attribute = () =>
    random() < 0.5 ? { color: pick(size), shape: null } : { color: null, shape: pick(size) };
  const line = () => ({ axis: random() < 0.5 ? "row" : "col", index: pick(size) });
  const pair = () => {
    const a = pick(count);
    const b = (a + 1 + pick(count - 1)) % count;
    return { a, b };
  };

  switch (pick(6)) {
    case 0:
      return {
        type: "at",
        cell: pick(count),
        ...(random() < 0.3 ? { color: pick(size), shape: pick(size) } : attribute()),
      };
    case 1:
      return { type: "notIn", line: line(), ...attribute() };
    case 2:
      return { type: "corners", ...attribute() };
    case 3:
      return { type: "adjacent", ...pair(), dir: random() < 0.5 ? "right" : "down" };
    case 4:
      return { type: "distinct", line: line(), attr: random() < 0.5 ? "color" : "shape" };
    default:
      return { type: "sameLine", ...pair(), axis: random() < 0.5 ? "row" : "col" };
  }
}

function shuffledTiles(count, random) {
  const tiles = Array.from({ length: count }, (_, tile) => tile);
  for (let index = count - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [tiles[index], tiles[other]] = [tiles[other], tiles[index]];
  }
  return tiles;
}

function forEachPermutation(count, visit) {
  const items = Array.from({ length: count }, (_, index) => index);
  const stack = Array(count).fill(0);
  visit(items);
  let index = 1;
  while (index < count) {
    if (stack[index] < index) {
      const other = index % 2 === 0 ? 0 : stack[index];
      [items[other], items[index]] = [items[index], items[other]];
      visit(items);
      stack[index] += 1;
      index = 1;
    } else {
      stack[index] = 0;
      index += 1;
    }
  }
}

function walkHints(puzzle) {
  let placements = Array(puzzle.size * puzzle.size).fill(null);
  const steps = [];
  for (;;) {
    const step = nextDeduction(puzzle, Object.freeze([...placements]));
    if (step.kind === "done") {
      return steps;
    }
    assert.equal(step.kind, "place", `${puzzle.id} 出现了意外的提示类型`);
    steps.push(step);
    placements = placements.map((tile, cell) => (cell === step.cell ? step.tile : tile));
    assert.ok(steps.length <= puzzle.size * puzzle.size, `${puzzle.id} 提示没有收敛`);
  }
}

test("关卡与名称常量冻结且对应正确的棋盘大小", () => {
  assert.deepEqual(LEVELS, [1, 2, 3, 4]);
  assert.deepEqual(LEVEL_SIZES, { 1: 3, 2: 3, 3: 3, 4: 4 });
  assert.deepEqual(COLOR_NAMES, ["朱", "墨", "青", "金"]);
  assert.deepEqual(SHAPE_NAMES, ["圆", "方", "角", "菱"]);
  for (const table of [LEVELS, LEVEL_SIZES, COLOR_NAMES, SHAPE_NAMES]) {
    assert.ok(Object.isFrozen(table));
  }
});

test("棋子、格子与行列的中文名称", () => {
  assert.deepEqual(
    Array.from({ length: 9 }, (_, tile) => tileName(3, tile)),
    ["朱圆", "朱方", "朱角", "墨圆", "墨方", "墨角", "青圆", "青方", "青角"],
  );
  assert.equal(tileName(4, 3), "朱菱");
  assert.equal(tileName(4, 14), "金角");
  assert.equal(tileName(4, 15), "金菱");
  assert.equal(tileColor(4, 14), 3);
  assert.equal(tileShape(4, 14), 2);
  assert.equal(tileColor(3, 7), 2);
  assert.equal(tileShape(3, 7), 1);

  assert.deepEqual(
    Array.from({ length: 9 }, (_, cell) => cellName(3, cell)),
    ["左上", "正上", "右上", "左中", "正中", "右中", "左下", "正下", "右下"],
  );
  assert.equal(cellName(4, 0), "第一行第一格");
  assert.equal(cellName(4, 1), "第一行第二格");
  assert.equal(cellName(4, 6), "第二行第三格");
  assert.equal(cellName(4, 15), "第四行第四格");

  assert.equal(lineName(3, { axis: "row", index: 0 }), "第一行");
  assert.equal(lineName(3, { axis: "row", index: 2 }), "第三行");
  assert.equal(lineName(3, { axis: "col", index: 0 }), "左边一列");
  assert.equal(lineName(3, { axis: "col", index: 1 }), "中间一列");
  assert.equal(lineName(3, { axis: "col", index: 2 }), "右边一列");
  assert.equal(lineName(4, { axis: "row", index: 3 }), "第四行");
  assert.equal(lineName(4, { axis: "col", index: 0 }), "第一列");
  assert.equal(lineName(4, { axis: "col", index: 3 }), "第四列");

  assert.throws(() => tileName(3, 9), RangeError);
  assert.throws(() => cellName(5, 0), RangeError);
  assert.throws(() => lineName(3, { axis: "row", index: 3 }), TypeError);
});

test("describeClue 生成孩子能读懂的线索句子", () => {
  const cases = [
    [3, { type: "at", cell: 0, color: 0, shape: 0 }, "左上是朱圆"],
    [3, { type: "at", cell: 4, color: 0, shape: null }, "正中是朱色"],
    [3, { type: "at", cell: 8, color: null, shape: 0 }, "右下是圆形"],
    [3, { type: "notIn", line: row(2), color: 1, shape: null }, "第三行没有墨色"],
    [3, { type: "notIn", line: col(1), color: null, shape: 0 }, "中间一列没有圆形"],
    [3, { type: "corners", color: null, shape: 1 }, "四个角上都没有方块"],
    [3, { type: "adjacent", a: 0, b: 4, dir: "right" }, "朱圆右边紧挨着墨方"],
    [3, { type: "adjacent", a: 7, b: 2, dir: "down" }, "青方正下方是朱角"],
    [3, { type: "distinct", line: row(1), attr: "shape" }, "第二行三种形状各一个"],
    [3, { type: "distinct", line: col(2), attr: "color" }, "右边一列三种颜色各一个"],
    [3, { type: "sameLine", a: 0, b: 4, axis: "row" }, "朱圆和墨方在同一行"],
    [3, { type: "sameLine", a: 0, b: 4, axis: "col" }, "朱圆和墨方在同一列"],
    [4, { type: "distinct", line: row(1), attr: "color" }, "第二行四种颜色各一个"],
    [4, { type: "at", cell: 6, color: 3, shape: null }, "第二行第三格是金色"],
    [4, { type: "at", cell: 5, color: 1, shape: 2 }, "第二行第二格是墨角"],
    [4, { type: "notIn", line: col(3), color: null, shape: 3 }, "第四列没有菱形"],
    [4, { type: "corners", color: 2, shape: null }, "四个角上都没有青色"],
    [4, { type: "adjacent", a: 15, b: 8, dir: "down" }, "金菱正下方是青圆"],
  ];
  for (const [size, clue, text] of cases) {
    assert.equal(describeClue(size, deepFreeze(clue)), text);
  }
  const blank = { type: "at", cell: 0, color: null, shape: null };
  assert.throws(() => describeClue(3, blank), TypeError);
  assert.throws(() => describeClue(3, { type: "adjacent", a: 1, b: 1, dir: "right" }), TypeError);
});

test("clueInvolvement 标出线索涉及的格子和棋子", () => {
  assert.deepEqual(clueInvolvement(3, { type: "notIn", line: row(1), color: 0, shape: null }), {
    cells: [3, 4, 5],
    tiles: [],
  });
  assert.deepEqual(clueInvolvement(3, { type: "distinct", line: col(2), attr: "shape" }), {
    cells: [2, 5, 8],
    tiles: [],
  });
  assert.deepEqual(clueInvolvement(3, { type: "corners", color: 1, shape: null }), {
    cells: [0, 2, 6, 8],
    tiles: [],
  });
  assert.deepEqual(clueInvolvement(4, { type: "corners", color: null, shape: 3 }), {
    cells: [0, 3, 12, 15],
    tiles: [],
  });
  assert.deepEqual(clueInvolvement(3, { type: "at", cell: 4, color: 1, shape: 1 }), {
    cells: [4],
    tiles: [4],
  });
  assert.deepEqual(clueInvolvement(3, { type: "at", cell: 7, color: null, shape: 2 }), {
    cells: [7],
    tiles: [],
  });
  assert.deepEqual(clueInvolvement(3, { type: "adjacent", a: 1, b: 5, dir: "down" }), {
    cells: [],
    tiles: [1, 5],
  });
  assert.deepEqual(clueInvolvement(4, { type: "sameLine", a: 9, b: 2, axis: "col" }), {
    cells: [],
    tiles: [9, 2],
  });
});

test("evaluateClue 判断定位与整行、四角排除线索", () => {
  const colorAt = { type: "at", cell: 4, color: 1, shape: null };
  assert.equal(evaluateClue(3, colorAt, board(3)), "open");
  assert.equal(evaluateClue(3, colorAt, board(3, { 4: 4 })), "satisfied");
  assert.equal(evaluateClue(3, colorAt, board(3, { 4: 1 })), "violated");
  const fullAt = { type: "at", cell: 0, color: 0, shape: 0 };
  assert.equal(evaluateClue(3, fullAt, board(3, { 0: 0 })), "satisfied");
  assert.equal(evaluateClue(3, fullAt, board(3, { 0: 1 })), "violated");

  const notIn = { type: "notIn", line: row(0), color: 0, shape: null };
  assert.equal(evaluateClue(3, notIn, board(3)), "open");
  assert.equal(evaluateClue(3, notIn, board(3, { 3: 0 })), "open");
  assert.equal(evaluateClue(3, notIn, board(3, { 0: 3, 1: 4 })), "open");
  assert.equal(evaluateClue(3, notIn, board(3, { 1: 2 })), "violated");
  assert.equal(evaluateClue(3, notIn, board(3, { 0: 3, 1: 4, 2: 5 })), "satisfied");
  const notInShape = { type: "notIn", line: col(2), color: null, shape: 2 };
  assert.equal(evaluateClue(3, notInShape, board(3, { 2: 0, 5: 1, 8: 3 })), "satisfied");
  assert.equal(evaluateClue(3, notInShape, board(3, { 8: 5 })), "violated");

  const corners = { type: "corners", color: null, shape: 1 };
  assert.equal(evaluateClue(3, corners, board(3, { 4: 1 })), "open");
  assert.equal(evaluateClue(3, corners, board(3, { 6: 7 })), "violated");
  assert.equal(evaluateClue(3, corners, board(3, { 0: 0, 2: 2, 6: 3, 8: 5 })), "satisfied");
  assert.equal(
    evaluateClue(4, { type: "corners", color: 3, shape: null }, board(4, { 15: 12 })),
    "violated",
  );
});

test("evaluateClue 判断相邻线索，包括出界和被别的棋子占住", () => {
  const right = { type: "adjacent", a: 0, b: 4, dir: "right" };
  assert.equal(evaluateClue(3, right, board(3)), "open");
  assert.equal(evaluateClue(3, right, board(3, { 0: 0, 1: 4 })), "satisfied");
  assert.equal(evaluateClue(3, right, board(3, { 0: 0, 4: 4 })), "violated");
  assert.equal(evaluateClue(3, right, board(3, { 0: 0 })), "open");
  assert.equal(evaluateClue(3, right, board(3, { 2: 0 })), "violated");
  assert.equal(evaluateClue(3, right, board(3, { 0: 0, 1: 7 })), "violated");
  assert.equal(evaluateClue(3, right, board(3, { 4: 4 })), "open");
  assert.equal(evaluateClue(3, right, board(3, { 3: 4 })), "violated");
  assert.equal(evaluateClue(3, right, board(3, { 4: 4, 3: 8 })), "violated");

  const down = { type: "adjacent", a: 7, b: 2, dir: "down" };
  assert.equal(evaluateClue(3, down, board(3, { 1: 7, 4: 2 })), "satisfied");
  assert.equal(evaluateClue(3, down, board(3, { 1: 7, 5: 2 })), "violated");
  assert.equal(evaluateClue(3, down, board(3, { 6: 7 })), "violated");
  assert.equal(evaluateClue(3, down, board(3, { 1: 2 })), "violated");
  assert.equal(evaluateClue(3, down, board(3, { 4: 7, 7: 1 })), "violated");
  assert.equal(evaluateClue(3, down, board(3, { 4: 7 })), "open");
  assert.equal(evaluateClue(3, down, board(3, { 7: 2 })), "open");

  const wide = { type: "adjacent", a: 0, b: 1, dir: "right" };
  assert.equal(evaluateClue(4, wide, board(4, { 3: 0 })), "violated");
  assert.equal(evaluateClue(4, wide, board(4, { 4: 1 })), "violated");
  assert.equal(evaluateClue(4, wide, board(4, { 5: 1 })), "open");
});

test("evaluateClue 判断各一个与同行同列线索", () => {
  const distinct = { type: "distinct", line: row(1), attr: "color" };
  assert.equal(evaluateClue(3, distinct, board(3)), "open");
  assert.equal(evaluateClue(3, distinct, board(3, { 3: 0, 4: 1 })), "violated");
  assert.equal(evaluateClue(3, distinct, board(3, { 3: 0, 4: 3 })), "open");
  assert.equal(evaluateClue(3, distinct, board(3, { 3: 0, 4: 3, 5: 6 })), "satisfied");
  assert.equal(evaluateClue(3, distinct, board(3, { 3: 0, 4: 3, 5: 1 })), "violated");
  const shapes = { type: "distinct", line: col(0), attr: "shape" };
  assert.equal(evaluateClue(3, shapes, board(3, { 0: 0, 3: 4, 6: 8 })), "satisfied");

  const sameRow = { type: "sameLine", a: 0, b: 8, axis: "row" };
  assert.equal(evaluateClue(3, sameRow, board(3, { 0: 0 })), "open");
  assert.equal(evaluateClue(3, sameRow, board(3, { 0: 0, 2: 8 })), "satisfied");
  assert.equal(evaluateClue(3, sameRow, board(3, { 0: 0, 3: 8 })), "violated");
  const sameCol = { type: "sameLine", a: 0, b: 8, axis: "col" };
  assert.equal(evaluateClue(3, sameCol, board(3, { 0: 0, 6: 8 })), "satisfied");
  assert.equal(evaluateClue(3, sameCol, board(3, { 0: 0, 1: 8 })), "violated");

  assert.throws(() => evaluateClue(3, sameRow, Array(8).fill(null)), TypeError);
  assert.throws(() => evaluateClue(3, sameRow, [...board(3)].fill(9)), TypeError);
  assert.throws(() => evaluateClue(3, { type: "sameLine", a: 0, b: 8 }, board(3)), TypeError);
});

test("countSolutions 正确处理唯一解、两个解和无解", () => {
  const givens = (count) =>
    deepFreeze(
      Array.from({ length: count }, (_, cell) => ({
        type: "at",
        cell,
        color: Math.floor(cell / 3),
        shape: cell % 3,
      })),
    );
  assert.equal(countSolutions(3, givens(8)), 1);
  assert.equal(countSolutions(3, givens(7)), 2);
  assert.equal(countSolutions(3, givens(7), { limit: 1 }), 1);
  assert.equal(countSolutions(3, givens(7), { limit: 10 }), 2);
  assert.equal(countSolutions(3, givens(7), { placements: board(3, { 7: 8 }) }), 1);
  assert.equal(countSolutions(3, givens(7), { placements: board(3, { 0: 1 }) }), 0);
  assert.equal(countSolutions(3, [], { placements: board(3, { 7: 8, 8: 8 }) }), 0);

  const contradictions = [
    [
      { type: "at", cell: 0, color: 0, shape: 0 },
      { type: "notIn", line: row(0), color: 0, shape: null },
    ],
    [
      { type: "adjacent", a: 0, b: 1, dir: "right" },
      { type: "adjacent", a: 1, b: 0, dir: "right" },
    ],
    [
      { type: "distinct", line: row(0), attr: "color" },
      { type: "at", cell: 0, color: 0, shape: null },
      { type: "at", cell: 1, color: 0, shape: null },
    ],
    [
      { type: "sameLine", a: 0, b: 1, axis: "row" },
      { type: "sameLine", a: 0, b: 1, axis: "col" },
    ],
  ];
  for (const clues of contradictions) {
    assert.equal(countSolutions(3, deepFreeze(clues)), 0);
  }

  assert.equal(countSolutions(3, [], { limit: 1000 }), 1000);
  assert.equal(countSolutions(4, [], { limit: 3 }), 3);
  assert.throws(() => countSolutions(5, []), RangeError);
  assert.throws(() => countSolutions(3, [{ type: "bogus" }]), TypeError);
  assert.throws(() => countSolutions(3, [], { limit: 0 }), RangeError);
});

test("countSolutions 与 3×3 穷举计数一致", () => {
  const random = createRandom(20261006);
  const sets = [];
  for (let index = 0; index < 8; index += 1) {
    const solution = shuffledTiles(9, random);
    const clues = [];
    while (clues.length < 4 + (index % 3)) {
      const clue = randomClue(3, random);
      if (index % 2 === 1 || holds(3, clue, solution)) {
        clues.push(clue);
      }
    }
    sets.push(deepFreeze(clues));
  }

  const counts = sets.map(() => 0);
  forEachPermutation(9, (items) => {
    sets.forEach((clues, index) => {
      if (clues.every((clue) => holds(3, clue, items))) {
        counts[index] += 1;
      }
    });
  });

  assert.ok(counts.some((count) => count === 0) || counts.some((count) => count > 1));
  sets.forEach((clues, index) => {
    const counted = countSolutions(3, clues, { limit: 400000 });
    assert.equal(counted, counts[index], JSON.stringify(clues));
  });
});

test("题库每档 40 题，编号唯一且没有重复题目", () => {
  assert.equal(PUZZLES.length, 160);
  const ids = new Set();
  const contents = new Set();
  for (const level of LEVELS) {
    const puzzles = PUZZLES.filter((puzzle) => puzzle.level === level);
    assert.equal(puzzles.length, 40, `第 ${level} 档题目数量不对`);
    puzzles.forEach((puzzle, index) => {
      assert.equal(puzzle.id, `tuili-${level}-${String(index + 1).padStart(3, "0")}`);
    });
  }
  for (const puzzle of PUZZLES) {
    assert.equal(ids.has(puzzle.id), false, `重复编号 ${puzzle.id}`);
    ids.add(puzzle.id);
    const content = JSON.stringify([puzzle.solution, puzzle.clues]);
    assert.equal(contents.has(content), false, `${puzzle.id} 与其他题目重复`);
    contents.add(content);
  }
});

test("题库每道题结构有效、线索成立且只有一个解", () => {
  for (const puzzle of PUZZLES) {
    assert.equal(isValidPuzzle(puzzle), true, `${puzzle.id} 结构无效`);
    for (const clue of puzzle.clues) {
      assert.equal(evaluateClue(puzzle.size, clue, puzzle.solution), "satisfied", puzzle.id);
    }
    assert.equal(countSolutions(puzzle.size, puzzle.clues), 1, `${puzzle.id} 不是唯一解`);
    assert.equal(isSolved(puzzle, puzzle.solution), true);
  }
});

test("题库难度、线索数量和线索类型符合各档规则", () => {
  for (const puzzle of PUZZLES) {
    const rule = LEVEL_RULES[puzzle.level];
    const grade = gradePuzzle(puzzle);
    const fullAt = puzzle.clues.filter(isFullAt).length;
    const partialAt = puzzle.clues.filter((clue) => clue.type === "at" && !isFullAt(clue)).length;
    const types = new Set(puzzle.clues.map((clue) => clue.type));

    assert.equal(puzzle.size, LEVEL_SIZES[puzzle.level]);
    assert.ok(rule.tiers.includes(grade.tier), `${puzzle.id} 难度为 ${grade.tier}`);
    const [fewest, most] = rule.clues;
    assert.ok(puzzle.clues.length >= fewest && puzzle.clues.length <= most, puzzle.id);
    assert.ok([...types].every((type) => rule.types.includes(type)), `${puzzle.id} 类型超出本档`);
    assert.equal(grade.steps.length, puzzle.size * puzzle.size);
    assert.ok(grade.steps.every((step) => puzzle.solution[step.cell] === step.tile), puzzle.id);
    assert.ok(grade.techniques.every((technique) => TECHNIQUES.includes(technique)));

    if (puzzle.level === 1) {
      assert.ok(fullAt >= 2, `${puzzle.id} 完整定位少于两条`);
    } else if (puzzle.level === 2) {
      assert.ok(fullAt <= 1 && types.has("adjacent"), puzzle.id);
    } else if (puzzle.level === 3) {
      assert.ok(fullAt === 0 && partialAt <= 1 && types.size >= 3, puzzle.id);
    } else {
      assert.equal(fullAt, 0, puzzle.id);
    }
  }

  const levelFour = PUZZLES.filter((puzzle) => puzzle.level === 4).map(gradePuzzle);
  assert.ok(levelFour.some((grade) => grade.tier === 3));
  assert.ok(levelFour.some((grade) => grade.tier === 4));
});

test("从空盘按提示一步步走，每道题都能解完且从不给错", () => {
  for (const puzzle of PUZZLES) {
    const steps = walkHints(puzzle);
    assert.equal(steps.length, puzzle.size * puzzle.size, puzzle.id);
    for (const step of steps) {
      assert.equal(step.tile, puzzle.solution[step.cell], `${puzzle.id} 提示给错了棋子`);
      assert.ok(TECHNIQUES.includes(step.technique), step.technique);
      const known = (index) => Number.isInteger(index) && index < puzzle.clues.length;
      assert.ok(step.clues.every(known), puzzle.id);
      assert.deepEqual(step.clues, [...new Set(step.clues)].sort((left, right) => left - right));
      assert.equal(typeof step.explanation, "string");
      assert.match(step.explanation, /。$/);
      const cited = [...new Set(citedIndexes(step.explanation))].sort((a, b) => a - b);
      assert.deepEqual(cited, step.clues, step.explanation);
    }

    const used = new Set(steps.map((step) => step.technique));
    if (puzzle.level === 1) {
      assert.ok([...used].every((name) => TECHNIQUES.slice(0, 3).includes(name)), puzzle.id);
    } else if (puzzle.level === 2) {
      assert.ok([...used].every((name) => TECHNIQUES.slice(0, 4).includes(name)), puzzle.id);
    } else if (puzzle.level === 3) {
      assert.equal(used.has("contradiction"), false, puzzle.id);
    }
  }
});

test("孩子按任意顺序放对一部分后，提示仍然正确", () => {
  const random = createRandom(7);
  for (const puzzle of PUZZLES) {
    for (let trial = 0; trial < 3; trial += 1) {
      const placements = Object.freeze(
        puzzle.solution.map((tile) => (random() < 0.2 + trial * 0.2 ? tile : null)),
      );
      const step = nextDeduction(puzzle, placements);
      if (placements.every((tile) => tile !== null)) {
        assert.equal(step.kind, "done");
        continue;
      }
      assert.equal(step.kind, "place", puzzle.id);
      assert.equal(placements[step.cell], null);
      assert.equal(step.tile, puzzle.solution[step.cell], puzzle.id);
    }
  }
});

test("nextDeduction 指出放错的格子，全部放好时返回 done", () => {
  const puzzle = PUZZLES[0];
  const [first, second] = [puzzle.solution[0], puzzle.solution[1]];
  const wrong = nextDeduction(puzzle, board(3, { 0: second }));
  assert.equal(wrong.kind, "conflict");
  assert.deepEqual(wrong.wrongCells, [0]);
  assert.match(wrong.explanation, new RegExp(`${cellName(3, 0)}的${tileName(3, second)}`));
  assert.match(wrong.explanation, /拿掉/);

  const swapped = nextDeduction(puzzle, board(3, { 0: second, 1: first, 2: puzzle.solution[2] }));
  assert.equal(swapped.kind, "conflict");
  assert.deepEqual(swapped.wrongCells, [0, 1]);

  assert.deepEqual(nextDeduction(puzzle, Object.freeze([...puzzle.solution])), { kind: "done" });
  assert.equal(isSolved(puzzle, board(3, { 0: first })), false);
  assert.throws(() => nextDeduction(puzzle, Array(8).fill(null)), TypeError);
  assert.throws(() => nextDeduction({ ...puzzle, level: 9 }, board(3)), TypeError);
});

test("说理由：线索够用时给出最少几条", () => {
  assert.equal(isValidPuzzle(REASON_PUZZLE), true);
  assert.deepEqual(explainReasons(REASON_PUZZLE, board(3), 2, 2, Object.freeze([1, 4])), {
    sufficient: true,
    counterexampleCell: null,
    minimal: [1, 4],
    suggestion: null,
  });
  assert.deepEqual(explainReasons(REASON_PUZZLE, board(3), 2, 2, [4, 5, 1]).minimal, [1, 4]);
  const allFour = explainReasons(REASON_PUZZLE, board(3), 2, 2, [0, 1, 2, 3]);
  assert.deepEqual(allFour.minimal, [0, 1, 2, 3]);
  assert.deepEqual(explainReasons(REASON_PUZZLE, board(3, { 1: 1 }), 2, 2, [4]).minimal, [4]);

  const nearlyDone = board(3, { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 });
  const lastCell = explainReasons(REASON_PUZZLE, nearlyDone, 8, 8, [5]);
  assert.equal(lastCell.sufficient, true);
  assert.deepEqual(lastCell.minimal, []);
});

test("说理由：线索不够时指出反例位置并建议补哪几条", () => {
  const missing = explainReasons(REASON_PUZZLE, board(3), 2, 2, Object.freeze([0, 2]));
  assert.equal(missing.sufficient, false);
  assert.equal(missing.minimal, null);
  assert.ok([1, 6, 7, 8].includes(missing.counterexampleCell));
  const chosen = [REASON_PUZZLE.clues[0], REASON_PUZZLE.clues[2]];
  const elsewhere = board(3, { [missing.counterexampleCell]: 2 });
  assert.ok(countSolutions(3, chosen, { placements: elsewhere, limit: 1 }) > 0);
  assert.deepEqual(missing.suggestion, [1, 4]);

  assert.deepEqual(explainReasons(REASON_PUZZLE, board(3), 2, 2, [1]).suggestion, [1, 4]);
  assert.deepEqual(explainReasons(REASON_PUZZLE, board(3, { 1: 1 }), 2, 2, []).suggestion, [4]);

  const wrongMove = explainReasons(REASON_PUZZLE, board(3), 5, 2, [0, 1, 2, 3, 4, 5]);
  assert.equal(wrongMove.sufficient, false);
  assert.equal(wrongMove.counterexampleCell, 2);
  assert.equal(wrongMove.suggestion, null);

  assert.throws(() => explainReasons(REASON_PUZZLE, board(3), 2, 2, [6]), RangeError);
  assert.throws(() => explainReasons(REASON_PUZZLE, board(3), 9, 2, [0]), RangeError);
});

test("说理由：题库中每一步用提示给出的线索都足够", () => {
  for (const puzzle of PUZZLES.filter((_, index) => index % 8 === 0)) {
    let placements = Array(puzzle.size * puzzle.size).fill(null);
    for (const step of walkHints(puzzle)) {
      const before = Object.freeze([...placements]);
      const verdict = explainReasons(puzzle, before, step.cell, step.tile, step.clues);
      assert.equal(verdict.sufficient, true, `${puzzle.id} 第 ${step.cell} 格的理由不够`);
      assert.ok(verdict.minimal.every((index) => step.clues.includes(index)));
      placements = placements.map((tile, cell) => (cell === step.cell ? step.tile : tile));
    }
  }
});

test("generatePuzzle 用同一种子得到同一道合格题目", () => {
  for (const level of LEVELS) {
    const first = generatePuzzle(Object.freeze({ level, random: createRandom(300 + level) }));
    const second = generatePuzzle({ level, random: createRandom(300 + level) });
    const rule = LEVEL_RULES[level];

    assert.deepEqual(first, second);
    assert.equal(Object.hasOwn(first, "id"), false);
    assert.equal(first.level, level);
    assert.equal(first.size, LEVEL_SIZES[level]);
    assert.equal(isValidPuzzle(first), true);
    assert.equal(countSolutions(first.size, first.clues), 1);
    assert.ok(rule.tiers.includes(gradePuzzle(first).tier));
    assert.ok(first.clues.length >= rule.clues[0] && first.clues.length <= rule.clues[1]);
  }

  assert.throws(() => generatePuzzle({ level: 5 }), RangeError);
  assert.throws(() => generatePuzzle({ level: 1, random: 0.5 }), TypeError);
});

test("题库与生成脚本的固定种子保持同步", async () => {
  const script = await readFile(new URL("scripts/generate-tuili.mjs", projectRoot), "utf8");
  const table = script.match(/const SEEDS = Object\.freeze\(\{([^}]*)\}\)/)?.[1] ?? "";
  const seeds = Object.fromEntries(
    [...table.matchAll(/(\d+):\s*(\d+)/g)].map(([, level, seed]) => [level, Number(seed)]),
  );
  for (const level of LEVELS) {
    const expected = generatePuzzle({ level, random: createRandom(seeds[level]) });
    const { id, ...stored } = PUZZLES.find((puzzle) => puzzle.level === level);
    assert.equal(id, `tuili-${level}-001`);
    assert.deepEqual(stored, expected, `第 ${level} 档题库需要重新生成`);
  }
});

test("createRandom 可复现且落在 0 到 1 之间", () => {
  const first = createRandom(42);
  const second = createRandom(42);
  const values = Array.from({ length: 200 }, () => first());
  assert.deepEqual(values, Array.from({ length: 200 }, () => second()));
  assert.ok(values.every((value) => value >= 0 && value < 1));
  assert.notDeepEqual(values.slice(0, 5), Array.from({ length: 5 }, createRandom(43)));
  assert.throws(() => createRandom("seed"), TypeError);
});

test("isValidPuzzle 严格拒绝格式不对的题目", () => {
  const base = structuredClone(PUZZLES.find((puzzle) => puzzle.level === 3));
  const variants = [
    null,
    [],
    { ...base, extra: true },
    { ...base, id: "Bad Id" },
    { ...base, level: 5 },
    { ...base, size: 4 },
    { ...base, solution: base.solution.slice(1) },
    { ...base, solution: [0, ...base.solution.slice(1).map(() => 0)] },
    { ...base, clues: [] },
    { ...base, clues: Array(31).fill(base.clues[0]) },
    { ...base, clues: [...base.clues, base.clues[0]] },
    { ...base, clues: [{ ...base.clues[0], note: "x" }] },
    { ...base, clues: [{ type: "notIn", line: row(0), color: 0, shape: 0 }] },
    { ...base, clues: [{ type: "at", cell: 0, color: null, shape: null }] },
    { ...base, clues: [{ type: "adjacent", a: 2, b: 2, dir: "right" }] },
    { ...base, clues: [{ type: "distinct", line: { axis: "diag", index: 0 }, attr: "color" }] },
  ];
  for (const variant of variants) {
    assert.equal(isValidPuzzle(variant), false, JSON.stringify(variant)?.slice(0, 80));
  }

  const { id, ...withoutId } = base;
  assert.equal(typeof id, "string");
  assert.equal(isValidPuzzle(withoutId), true);
  const tile = base.solution[0];
  const unsatisfied = { type: "at", cell: 0, color: (Math.floor(tile / 3) + 1) % 3, shape: null };
  assert.equal(isValidPuzzle({ ...base, clues: [unsatisfied] }), false);
  const pair = { type: "sameLine", a: base.solution[0], b: base.solution[1], axis: "row" };
  assert.equal(isValidPuzzle({ ...base, clues: [pair] }), true);
  assert.equal(isValidPuzzle({ ...base, clues: [pair, { ...pair, a: pair.b, b: pair.a }] }), false);
});

test("每日一题按本地日期固定并轮换，选题优先未完成的题目", () => {
  const day = new Date(2026, 9, 6, 9, 30);
  for (const level of LEVELS) {
    const puzzle = dailyPuzzle(level, day);
    assert.equal(puzzle.level, level);
    assert.equal(dailyPuzzle(level, new Date(2026, 9, 6, 23, 59)), puzzle);
    assert.notEqual(dailyPuzzle(level, new Date(2026, 9, 7, 0, 1)), puzzle);
    assert.equal(dailyPuzzle(level, new Date(2026, 10, 15, 12)), puzzle);
  }
  assert.equal(dailyPuzzle(9, day), null);
  assert.equal(dailyPuzzle(1, new Date(Number.NaN)), null);

  const levelTwo = PUZZLES.filter((puzzle) => puzzle.level === 2);
  const completed = levelTwo.slice(0, 39).map((puzzle) => puzzle.id);
  assert.equal(choosePuzzle(2, completed, () => 0.99).id, levelTwo[39].id);
  assert.equal(choosePuzzle(2, new Set(completed.slice(0, 2)), () => 0).id, levelTwo[2].id);
  const all = levelTwo.map((puzzle) => puzzle.id);
  assert.equal(choosePuzzle(2, all, () => 0).id, levelTwo[0].id);
  assert.equal(choosePuzzle(4, undefined, () => 0).level, 4);
  assert.equal(choosePuzzle(7, [], () => 0), null);

  assert.equal(findPuzzle("tuili-3-007"), PUZZLES.find((puzzle) => puzzle.id === "tuili-3-007"));
  assert.equal(findPuzzle("tuili-9-001"), null);
});

test("题库深度冻结，公开函数不修改传入的数据", () => {
  const puzzle = PUZZLES.find((entry) => entry.level === 4);
  for (const value of [PUZZLES, puzzle, puzzle.solution, puzzle.clues, puzzle.clues[0]]) {
    assert.ok(Object.isFrozen(value));
  }

  const snapshot = JSON.stringify(puzzle);
  const placements = board(4, { 0: puzzle.solution[0] });
  const selected = Object.freeze([0, 1, 2]);
  const options = deepFreeze({ placements, limit: 3 });
  for (const clue of puzzle.clues) {
    evaluateClue(4, clue, placements);
    describeClue(4, clue);
    clueInvolvement(4, clue);
  }
  countSolutions(4, puzzle.clues, options);
  nextDeduction(puzzle, placements);
  gradePuzzle(puzzle);
  isSolved(puzzle, placements);
  const step = nextDeduction(puzzle, placements);
  explainReasons(puzzle, placements, step.cell, step.tile, selected);
  generatePuzzle(Object.freeze({ level: 2, random: createRandom(1) }));

  assert.equal(JSON.stringify(puzzle), snapshot);
  assert.deepEqual(selected, [0, 1, 2]);
});

test("推理引擎与题库不引用外部地址，也不联网", async () => {
  for (const path of ["site/js/tuili.js", "site/js/tuili-puzzles.js"]) {
    const source = await readFile(new URL(path, projectRoot), "utf8");
    assert.doesNotMatch(source, /https?:\/\//i, path);
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|\bimport\s*\(/, path);
    assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|localStorage/, path);
    assert.ok(Buffer.byteLength(source) < 120 * 1024, `${path} 体积过大`);
  }
});
