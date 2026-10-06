import assert from "node:assert/strict";
import test from "node:test";

import {
  BLACK,
  EMPTY,
  SUPPORTED_SIZES,
  WHITE,
  chooseAiMove,
  createGame,
  estimateDeadStones,
  getGroup,
  isLegalMove,
  isValidGame,
  neighbors,
  passTurn,
  playMove,
  scoreGame,
  starPoints,
} from "../site/js/go.js";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function boardFrom(rows) {
  return rows.flatMap((row) =>
    [...row.replaceAll(" ", "")].map((cell) => {
      if (cell === "X") {
        return BLACK;
      }
      return cell === "O" ? WHITE : EMPTY;
    }),
  );
}

function gameFrom(rows, overrides = {}) {
  return { ...createGame(rows.length), board: boardFrom(rows), ...overrides };
}

function at(size, row, column) {
  return row * size + column;
}

function play(game, ...points) {
  return points.reduce((current, point) => {
    const result = playMove(current, point);
    assert.equal(result.ok, true, `落子 ${point} 应当合法：${result.reason}`);
    return result.game;
  }, game);
}

function aiMove(game, level, seed, timeLimitMs = 300) {
  return chooseAiMove(game, { level, timeLimitMs, random: seededRandom(seed) });
}

function deadStonesOf(game, seed) {
  return estimateDeadStones(game, { random: seededRandom(seed) });
}

function elapsed(action) {
  const start = performance.now();
  const value = action();
  return { value, milliseconds: performance.now() - start };
}

const SETTLED = Object.freeze([
  ". . X O . O X . .",
  ". . X O . O X . .",
  ". . X O . O X . .",
  ". . X O . O X . .",
  ". . X O . O X . .",
  ". . X O . O X . .",
  ". . X O . O X . .",
  ". . X O . O X . .",
  ". . X O . O X . .",
]);

test("createGame 生成空棋盘并拒绝不支持的尺寸", () => {
  for (const size of SUPPORTED_SIZES) {
    const game = createGame(size);
    assert.equal(game.size, size);
    assert.equal(game.board.length, size * size);
    assert.ok(game.board.every((value) => value === EMPTY));
    assert.equal(game.turn, BLACK);
    assert.equal(game.komi, 7.5);
    assert.deepEqual(game.prisoners, { black: 0, white: 0 });
    assert.equal(game.koPoint, -1);
    assert.equal(game.lastMove, null);
    assert.equal(game.over, false);
    assert.deepEqual(JSON.parse(JSON.stringify(game)), game);
  }

  assert.equal(createGame(13, { komi: 6.5 }).komi, 6.5);
  assert.throws(() => createGame(10), RangeError);
  assert.throws(() => createGame(9, { komi: Number.NaN }), RangeError);
});

test("星位和相邻交叉点按棋盘大小计算", () => {
  assert.deepEqual(starPoints(9), [20, 24, 40, 56, 60]);
  assert.deepEqual(starPoints(13), [42, 48, 84, 120, 126]);
  assert.deepEqual(
    starPoints(19),
    [3, 9, 15].flatMap((row) => [3, 9, 15].map((column) => at(19, row, column))),
  );

  assert.deepEqual(neighbors(9, 0), [1, 9]);
  assert.deepEqual(neighbors(9, 40), [31, 39, 41, 49]);
  assert.deepEqual(neighbors(19, 360), [341, 359]);
  assert.throws(() => neighbors(9, 81), RangeError);
});

test("getGroup 返回整块棋的棋子和气", () => {
  const board = boardFrom([
    "X X . . . . . . .",
    "O X . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ]);

  assert.deepEqual(getGroup(board, 9, 1), {
    color: BLACK,
    stones: [0, 1, 10],
    liberties: [2, 11, 19],
  });
  assert.deepEqual(getGroup(board, 9, 9), { color: WHITE, stones: [9], liberties: [18] });
  assert.deepEqual(getGroup(board, 9, 40), { color: EMPTY, stones: [], liberties: [] });
});

test("提走没有气的单子并记录提子数", () => {
  const game = gameFrom([
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . X . . . .",
    ". . . X O X . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ]);
  const before = structuredClone(game);
  const result = playMove(game, at(9, 5, 4));

  assert.equal(result.ok, true);
  assert.deepEqual(result.captured, [at(9, 4, 4)]);
  assert.equal(result.game.board[at(9, 4, 4)], EMPTY);
  assert.equal(result.game.board[at(9, 5, 4)], BLACK);
  assert.deepEqual(result.game.prisoners, { black: 1, white: 0 });
  assert.equal(result.game.turn, WHITE);
  assert.equal(result.game.moveNumber, 1);
  assert.equal(result.game.lastMove, at(9, 5, 4));
  assert.deepEqual(game, before);
});

test("提走多子棋块", () => {
  const game = gameFrom([
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . X X . . . .",
    ". . X O O . . . .",
    ". . . X X . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ]);
  const result = playMove(game, at(9, 4, 5));

  assert.equal(result.ok, true);
  assert.deepEqual(result.captured, [at(9, 4, 3), at(9, 4, 4)]);
  assert.deepEqual(result.game.prisoners, { black: 2, white: 0 });
});

test("在边上和角上提子，白棋提子单独计数", () => {
  const edge = gameFrom([
    ". . . X O X . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ]);
  const edgeResult = playMove(edge, at(9, 1, 4));
  assert.deepEqual(edgeResult.captured, [4]);

  const corner = gameFrom(
    [
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . O X",
    ],
    { turn: WHITE },
  );
  const cornerResult = playMove(corner, at(9, 7, 8));
  assert.equal(cornerResult.ok, true);
  assert.deepEqual(cornerResult.captured, [80]);
  assert.deepEqual(cornerResult.game.prisoners, { black: 0, white: 1 });
});

test("禁止自杀，但能提子的无气点可以落子", () => {
  const game = gameFrom([
    ". O X . . . . . .",
    "O X . . . . . . .",
    "X . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ]);
  const suicide = gameFrom(
    [
      "X . O . . . . . .",
      "O O . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ],
  );

  assert.deepEqual(playMove(suicide, 1), { ok: false, reason: "suicide" });
  assert.equal(isLegalMove(suicide, 1), false);

  const singleSuicide = gameFrom(
    [
      ". O . . . . . . .",
      "O . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ],
  );
  assert.deepEqual(playMove(singleSuicide, 0), { ok: false, reason: "suicide" });

  const capture = playMove(game, 0);
  assert.equal(capture.ok, true);
  assert.deepEqual(capture.captured, [1, 9]);
  assert.equal(capture.game.board[0], BLACK);
});

test("劫不能立即提回，在别处走一手后可以提回", () => {
  const game = gameFrom([
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . X O . . . .",
    ". . X O . O . . .",
    ". . . X O . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ]);
  const taken = playMove(game, at(9, 4, 4));
  assert.equal(taken.ok, true);
  assert.deepEqual(taken.captured, [at(9, 4, 3)]);
  assert.equal(taken.game.koPoint, at(9, 4, 3));

  assert.deepEqual(playMove(taken.game, at(9, 4, 3)), { ok: false, reason: "ko" });
  assert.equal(isLegalMove(taken.game, at(9, 4, 3)), false);

  const threats = play(taken.game, 0, 80);
  assert.equal(threats.koPoint, -1);
  const retaken = playMove(threats, at(9, 4, 3));
  assert.equal(retaken.ok, true);
  assert.deepEqual(retaken.captured, [at(9, 4, 4)]);
  assert.equal(retaken.game.koPoint, at(9, 4, 4));

  assert.equal(passTurn(taken.game).koPoint, -1);
});

test("占用点、棋盘外和终局后的落子都被拒绝", () => {
  const game = play(createGame(9), 40);

  assert.deepEqual(playMove(game, 40), { ok: false, reason: "occupied" });
  for (const point of [-1, 81, 2.5, "40", null]) {
    assert.deepEqual(playMove(game, point), { ok: false, reason: "off-board" });
    assert.equal(isLegalMove(game, point), false);
  }

  const once = passTurn(game);
  assert.equal(once.passes, 1);
  assert.equal(once.over, false);
  assert.equal(once.turn, BLACK);
  assert.equal(once.lastMove, "pass");
  assert.equal(once.moveNumber, 2);

  const resumed = play(once, 0);
  assert.equal(resumed.passes, 0);

  const ended = passTurn(passTurn(resumed));
  assert.equal(ended.over, true);
  assert.equal(ended.passes, 2);
  assert.deepEqual(playMove(ended, 1), { ok: false, reason: "game-over" });
  assert.equal(isLegalMove(ended, 1), false);
  assert.equal(passTurn(ended), ended);
  assert.equal(chooseAiMove(ended), "pass");
});

test("数子法计算整局胜负，标记死子会改变结果", () => {
  const game = gameFrom([
    ". . . . X O . . .",
    ". . . . X O . . .",
    ". . . . X O . . .",
    ". . . . X O . . .",
    ". O . . X O . . .",
    ". . . . X O . . .",
    ". . . . X O . . .",
    ". . . . X O . . .",
    ". . . X . O . . .",
  ]);
  const deadStone = at(9, 4, 1);
  const dame = at(9, 8, 4);

  const unmarked = scoreGame(game);
  assert.deepEqual(unmarked.black, { stones: 9, territory: 0, total: 9 });
  assert.deepEqual(unmarked.white, { stones: 10, territory: 27, komi: 7.5, total: 44.5 });
  assert.equal(unmarked.winner, WHITE);
  assert.equal(unmarked.margin, 35.5);
  assert.deepEqual(unmarked.dead, []);

  const marked = scoreGame(game, [deadStone, deadStone, at(9, 0, 0)]);
  assert.deepEqual(marked.black, { stones: 9, territory: 35, total: 44 });
  assert.deepEqual(marked.white, { stones: 9, territory: 27, komi: 7.5, total: 43.5 });
  assert.equal(marked.winner, BLACK);
  assert.equal(marked.margin, 0.5);
  assert.deepEqual(marked.dead, [deadStone]);
  assert.equal(marked.territoryMap[deadStone], BLACK);
  assert.equal(marked.territoryMap[dame], EMPTY);
  assert.equal(marked.territoryMap[at(9, 0, 4)], EMPTY);
  assert.equal(marked.territoryMap[at(9, 8, 8)], WHITE);
  assert.equal(game.board[deadStone], WHITE);

  assert.throws(() => scoreGame(game, [81]), RangeError);
});

test("estimateDeadStones 找出大块实地中的死子且不误判活棋", () => {
  const thin = gameFrom([
    ". . X O . O X . .",
    ". . X O . O X . .",
    ". . X O . O X . .",
    ". . X O . O X . .",
    "O . X O X O X . .",
    ". . X O . O X . .",
    ". . X O . O X O .",
    ". . X O . O X . .",
    ". . X O . O X . .",
  ]);
  const wide = gameFrom([
    ". . . . X O . . .",
    ". . . . X O . . .",
    ". . . . X O . . .",
    ". . . . X O . . .",
    ". O . . X O . . .",
    ". . . . X O . . .",
    ". . . . X O . . .",
    ". . . . X O . . .",
    ". . . X . O . . .",
  ]);

  for (const seed of [1, 2, 3]) {
    assert.deepEqual(deadStonesOf(thin, seed), [at(9, 4, 0), at(9, 4, 4), at(9, 6, 7)]);
    assert.deepEqual(deadStonesOf(wide, seed), [at(9, 4, 1)]);
  }
  assert.deepEqual(deadStonesOf(gameFrom(SETTLED), 4), []);
  assert.deepEqual(estimateDeadStones(createGame(9)), []);

  const { milliseconds } = elapsed(() => estimateDeadStones(wide));
  assert.ok(milliseconds < 400, `9 路死子估计耗时 ${milliseconds.toFixed(0)}ms`);
});

test("isValidGame 接受合法对局并拒绝格式错误的数据", () => {
  for (const size of SUPPORTED_SIZES) {
    assert.equal(isValidGame(createGame(size)), true);
  }
  const played = play(createGame(9), 40, 41);
  assert.equal(isValidGame(played), true);
  assert.equal(isValidGame(JSON.parse(JSON.stringify(passTurn(played)))), true);

  const base = createGame(9);
  const occupiedKo = { ...base, board: [BLACK, ...base.board.slice(1)], koPoint: 0 };
  const surrounded = {
    ...base,
    board: boardFrom([
      "X O . . . . . . .",
      "O . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ]),
  };
  const missingField = { ...base };
  delete missingField.over;
  const malformed = [
    null,
    [],
    "game",
    missingField,
    { ...base, size: 10 },
    { ...base, board: base.board.slice(1) },
    { ...base, board: [3, ...base.board.slice(1)] },
    { ...base, board: Array(81) },
    { ...base, turn: 0 },
    { ...base, komi: Number.POSITIVE_INFINITY },
    { ...base, komi: "7.5" },
    { ...base, prisoners: { black: -1, white: 0 } },
    { ...base, prisoners: { black: 0 } },
    { ...base, koPoint: 81 },
    occupiedKo,
    { ...base, passes: 1.5 },
    { ...base, moveNumber: -1 },
    { ...base, lastMove: 81 },
    { ...base, lastMove: "resign" },
    { ...base, over: 0 },
    surrounded,
  ];
  for (const value of malformed) {
    assert.equal(isValidGame(value), false);
  }
});

test("AI 提掉被打吃的棋块并优先提大块", () => {
  const game = gameFrom(
    [
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . X X X . . .",
      ". . X O O O . . .",
      ". . . X X X . . .",
      ". . . . . . . . .",
      ". . . . . . . X .",
      ". . . . . . X O .",
      ". . . . . . . X .",
    ],
    { moveNumber: 20, lastMove: at(9, 3, 5) },
  );

  for (const level of [1, 2, 3]) {
    for (const seed of [1, 2, 3]) {
      assert.equal(aiMove(game, level, seed), at(9, 3, 6), `等级 ${level} 应提掉三子`);
    }
  }
});

test("AI 救出自己被打吃的棋块", () => {
  const game = gameFrom(
    [
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . O O . . . .",
      ". . O X X . . . .",
      ". . . O O . . . .",
      ". . . . . . . . .",
      ". . . . . . O . .",
      ". . X . . . . . .",
      ". . . . . . . . .",
    ],
    { moveNumber: 12, lastMove: at(9, 3, 2) },
  );

  for (const level of [1, 2, 3]) {
    for (const seed of [1, 2, 3]) {
      assert.equal(aiMove(game, level, seed), at(9, 3, 5), `等级 ${level} 应长出逃跑`);
    }
  }
});

test("AI 不填自己的真眼", () => {
  const game = gameFrom(
    [
      ". X . X O . . . .",
      "X X X X O . . . .",
      "O O O O O . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ],
    { moveNumber: 15, lastMove: at(9, 2, 0) },
  );
  const eyes = new Set([0, 2]);

  for (const level of [1, 2, 3]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const move = aiMove(game, level, seed, 200);
      assert.notEqual(move, "pass");
      assert.equal(eyes.has(move), false, `等级 ${level} 填了自己的眼`);
      assert.equal(isLegalMove(game, move), true);
    }
  }

  const onlyEyesLeft = gameFrom(
    [
      ". X . X O . O . O",
      "X X X X O O O O O",
      "O O O O O . O . O",
      "O . O . O O O O O",
      "O O O O O . O . O",
      "O . O . O O O O O",
      "O O O O O . O . O",
      "O . O . O O O O O",
      "O O O O O . O . O",
    ],
    { moveNumber: 70 },
  );
  for (const level of [1, 2, 3]) {
    assert.equal(chooseAiMove(onlyEyesLeft, { level, timeLimitMs: 200 }), "pass");
  }
});

test("AI 在完全定型的棋盘上停一手", () => {
  for (const turn of [BLACK, WHITE]) {
    for (const lastMove of ["pass", at(9, 4, 3)]) {
      const game = gameFrom(SETTLED, {
        turn,
        lastMove,
        passes: lastMove === "pass" ? 1 : 0,
        moveNumber: 60,
      });
      for (const level of [1, 2, 3]) {
        const side = turn === BLACK ? "黑" : "白";
        assert.equal(aiMove(game, level, level, 200), "pass", `等级 ${level} 执${side}应停一手`);
      }
    }
  }
});

for (const level of [1, 2]) {
  test(`等级 ${level} 的 AI 自我对弈全程合法并以双方停一手结束`, () => {
    for (const seed of [11, 12]) {
      const random = seededRandom(seed * 10 + level);
      let game = createGame(9);

      while (!game.over && game.moveNumber < 250) {
        const move = chooseAiMove(game, { level, random });
        if (move === "pass") {
          game = passTurn(game);
        } else {
          assert.equal(isLegalMove(game, move), true, `第 ${game.moveNumber + 1} 手不合法`);
          game = playMove(game, move).game;
        }
        assert.equal(isValidGame(game), true);
      }

      assert.equal(game.over, true, `种子 ${seed} 在 250 手内没有结束`);
      assert.equal(game.lastMove, "pass");
      assert.ok(game.moveNumber <= 250);
    }
  });
}

test("AI 在 13 路和 19 路也只下合法着法", () => {
  for (const size of [13, 19]) {
    const random = seededRandom(size);
    let game = createGame(size);
    for (let turn = 0; turn < 30 && !game.over; turn += 1) {
      const move = chooseAiMove(game, { level: 1 + (turn % 2), random });
      game = move === "pass" ? passTurn(game) : playMove(game, move).game;
      assert.ok(move === "pass" || game.lastMove === move);
    }
    assert.equal(isValidGame(game), true);
  }
});

test("等级 3 的 AI 遵守思考时间上限", () => {
  const random = seededRandom(5);
  let middle = createGame(19);
  for (let turn = 0; turn < 40; turn += 1) {
    const move = chooseAiMove(middle, { level: 2, random });
    middle = move === "pass" ? passTurn(middle) : playMove(middle, move).game;
  }

  for (const game of [createGame(9), middle]) {
    const { value, milliseconds } = elapsed(() =>
      chooseAiMove(game, { level: 3, timeLimitMs: 300, random }),
    );
    assert.ok(milliseconds <= 700, `${game.size} 路耗时 ${milliseconds.toFixed(0)}ms`);
    assert.equal(isLegalMove(game, value), true);
  }

  const empty = createGame(9);
  const { value, milliseconds } = elapsed(() => chooseAiMove(empty, { level: 3 }));
  assert.ok(milliseconds <= 1900, `默认时限耗时 ${milliseconds.toFixed(0)}ms`);
  assert.equal(isLegalMove(empty, value), true);
});
