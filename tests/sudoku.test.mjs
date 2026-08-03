import assert from "node:assert/strict";
import test from "node:test";

import {
  countSolutions,
  findConflicts,
  getCandidates,
  isSolved,
  parseGrid,
  setValue,
  toggleNote,
} from "../site/js/sudoku.js";

const EMPTY_GRID = ".".repeat(81);

function makeState(grid = EMPTY_GRID) {
  const board = parseGrid(grid);

  return {
    board,
    givens: board.map((value) => value !== 0),
    notes: Array.from({ length: 81 }, () => []),
    history: [],
  };
}

test("parseGrid 将点号和零解析为空格", () => {
  const board = parseGrid(`
    53..7....
    6..195...
    .98....6.
    8...6...3
    4..8.3..1
    7...2...6
    .6....28.
    ...419..5
    ....8..79
  `);

  assert.equal(board.length, 81);
  assert.deepEqual(board.slice(0, 9), [5, 3, 0, 0, 7, 0, 0, 0, 0]);
  assert.equal(parseGrid(`0${".".repeat(80)}`)[0], 0);
  assert.throws(() => parseGrid(".".repeat(80)), /81/);
  assert.throws(() => parseGrid(`x${".".repeat(80)}`), /字符/);
});

test("同一行的重复数字会被标记为冲突", () => {
  const board = Array(81).fill(0);
  board[0] = board[4] = 7;

  assert.deepEqual([...findConflicts(board)].sort((a, b) => a - b), [0, 4]);
});

test("同一列的重复数字会被标记为冲突", () => {
  const board = Array(81).fill(0);
  board[1] = board[73] = 4;

  assert.deepEqual([...findConflicts(board)].sort((a, b) => a - b), [1, 73]);
});

test("同一宫的重复数字会被标记为冲突", () => {
  const board = Array(81).fill(0);
  board[2] = board[19] = 9;

  assert.deepEqual([...findConflicts(board)].sort((a, b) => a - b), [2, 19]);
});

test("getCandidates 排除同行、同列和同宫已有数字", () => {
  const board = Array(81).fill(0);
  board[1] = 1;
  board[2] = 2;
  board[9] = 3;
  board[10] = 5;

  assert.deepEqual(getCandidates(board, 0), [4, 6, 7, 8, 9]);
  assert.deepEqual(getCandidates(board, 1), []);
});

test("setValue 不能修改预填数字", () => {
  const state = makeState(`5${".".repeat(80)}`);
  const next = setValue(state, 0, 3);

  assert.equal(next, state);
  assert.equal(next.board[0], 5);
  assert.equal(next.history.length, 0);
});

test("setValue 以不可变方式输入数字并保存历史", () => {
  const state = makeState();
  state.notes[0] = [1, 4];

  const next = setValue(state, 0, 4);

  assert.equal(state.board[0], 0);
  assert.deepEqual(state.notes[0], [1, 4]);
  assert.equal(next.board[0], 4);
  assert.deepEqual(next.notes[0], []);
  assert.equal(next.history.length, 1);
  assert.equal(next.history[0].board[0], 0);
  assert.deepEqual(next.history[0].notes[0], [1, 4]);
});

test("setValue 用零清除空格候选并保留可撤销历史", () => {
  const state = makeState();
  state.notes[7] = [2, 9];

  const next = setValue(state, 7, 0);

  assert.notEqual(next, state);
  assert.equal(next.board[7], 0);
  assert.deepEqual(next.notes[7], []);
  assert.equal(next.history.length, 1);
  assert.deepEqual(next.history[0].notes[7], [2, 9]);

  const alreadyEmpty = makeState();
  assert.equal(setValue(alreadyEmpty, 7, 0), alreadyEmpty);
});

test("toggleNote 会添加和移除候选数且不修改原状态", () => {
  const state = makeState();
  const withNote = toggleNote(state, 8, 6);
  const withoutNote = toggleNote(withNote, 8, 6);

  assert.deepEqual(state.notes[8], []);
  assert.deepEqual(withNote.notes[8], [6]);
  assert.deepEqual(withoutNote.notes[8], []);
  assert.equal(withNote.history.length, 1);
  assert.equal(withoutNote.history.length, 2);
});

test("toggleNote 不修改预填或已经填入数字的格子", () => {
  const given = makeState(`8${".".repeat(80)}`);
  const filled = setValue(makeState(), 1, 2);

  assert.equal(toggleNote(given, 0, 3), given);
  assert.equal(toggleNote(filled, 1, 3), filled);
});

test("历史快照被深度冻结且后续操作不会改写它", () => {
  const first = toggleNote(makeState(), 12, 3);
  const second = setValue(first, 14, 7);
  const firstSnapshot = second.history[0];

  assert.ok(Object.isFrozen(firstSnapshot));
  assert.ok(Object.isFrozen(firstSnapshot.board));
  assert.ok(Object.isFrozen(firstSnapshot.notes));
  assert.ok(Object.isFrozen(firstSnapshot.notes[12]));
  assert.deepEqual(firstSnapshot.notes[12], []);
  assert.throws(() => firstSnapshot.notes[12].push(9), TypeError);
  assert.deepEqual(second.history[1].notes[12], [3]);
});

test("isSolved 只接受填满且没有冲突的盘面", () => {
  const solved = parseGrid(
    "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
  );
  const incomplete = [...solved];
  const conflicted = [...solved];
  incomplete[80] = 0;
  conflicted[80] = conflicted[79];

  assert.equal(isSolved(solved), true);
  assert.equal(isSolved(incomplete), false);
  assert.equal(isSolved(conflicted), false);
});

test("countSolutions 计算唯一解且不修改题盘", () => {
  const puzzle = parseGrid(
    "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79",
  );
  const before = [...puzzle];

  assert.equal(countSolutions(puzzle), 1);
  assert.deepEqual(puzzle, before);
});

test("countSolutions 对无解盘面返回零并可限制搜索数量", () => {
  const invalid = parseGrid(`11${".".repeat(79)}`);

  assert.equal(countSolutions(invalid), 0);
  assert.equal(countSolutions(parseGrid(EMPTY_GRID), 2), 2);
});
