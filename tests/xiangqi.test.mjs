import assert from "node:assert/strict";
import test from "node:test";

import {
  BLACK,
  INITIAL_FEN,
  RED,
  applyMove,
  chooseAiMove,
  createInitialPosition,
  fromFen,
  generateLegalMoves,
  getGameStatus,
  isInCheck,
  legalMovesFrom,
  moveToNotation,
  perft,
  positionKey,
  toFen,
} from "../site/js/xiangqi.js";

const MIDDLEGAME_FEN =
  "r1b1kabr1/4a3c/1cn3n2/p1p1p1R1p/6p2/2P6/P3P1P1P/1CN1C1N2/9/R1BAKAB2 w - - 14 8";
const DOUBLE_CANNON_FEN = "3aka3/9/9/9/9/4C4/9/1C7/9/3K5 w - - 0 1";
const DOUBLE_CHARIOT_FEN = "4k4/8R/9/9/9/R8/9/9/9/3K5 w - - 0 1";
const STALEMATE_FEN = "3k5/8R/9/9/9/9/9/9/9/4K4 b - - 0 1";
const HANGING_CHARIOT_FEN =
  "1nbakabnr/9/1c5c1/p1p1p1p1p/9/r8/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";
const MATE_THREAT_FEN = "3aka1n1/9/r8/p1p3p1p/9/4C4/P1P3P1P/1C7/9/3K5 b - - 0 1";

function square(row, column) {
  return row * 9 + column;
}

function move(position, [fromRow, fromColumn], [toRow, toColumn]) {
  return applyMove(position, { from: square(fromRow, fromColumn), to: square(toRow, toColumn) });
}

function targetsFrom(position, row, column) {
  return legalMovesFrom(position, square(row, column))
    .map((candidate) => candidate.to)
    .sort((left, right) => left - right);
}

function squares(...points) {
  return points.map(([row, column]) => square(row, column)).sort((left, right) => left - right);
}

function notation(position, [fromRow, fromColumn], [toRow, toColumn]) {
  return moveToNotation(position, {
    from: square(fromRow, fromColumn),
    to: square(toRow, toColumn),
  });
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

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

function isLegalMove(position, candidate) {
  return generateLegalMoves(position).some(
    (legal) => legal.from === candidate.from && legal.to === candidate.to,
  );
}

function allowsMateInOne(position) {
  return generateLegalMoves(position).some(
    (reply) => getGameStatus(applyMove(position, reply)).winner === position.turn,
  );
}

function countSeeds(position, options, predicate, seeds = 40) {
  let hits = 0;
  for (let seed = 1; seed <= seeds; seed += 1) {
    const choice = chooseAiMove(position, { ...options, random: seededRandom(seed) });
    if (predicate(choice)) {
      hits += 1;
    }
  }
  return hits;
}

test("初始局面红方共有 44 种走法", () => {
  const position = createInitialPosition();
  const moves = generateLegalMoves(position);

  assert.equal(position.turn, RED);
  assert.equal(moves.length, 44);
  assert.deepEqual(
    moves.filter((candidate) => candidate.captured !== null),
    [
      { from: square(7, 1), to: square(0, 1), piece: "C", captured: "n" },
      { from: square(7, 7), to: square(0, 7), piece: "C", captured: "n" },
    ],
  );
  assert.deepEqual(Object.keys(moves[0]), ["from", "to", "piece", "captured"]);
});

test("perft 结果与标准值一致", () => {
  const position = createInitialPosition();

  assert.equal(perft(position, 0), 1);
  assert.equal(perft(position, 1), 44);
  assert.equal(perft(position, 2), 1920);
  assert.equal(perft(position, 3), 79666);
  assert.throws(() => perft(position, -1), RangeError);
});

test("FEN 可以无损往返并生成可序列化的局面", () => {
  const initial = fromFen(INITIAL_FEN);

  assert.equal(toFen(initial), INITIAL_FEN);
  assert.deepEqual(createInitialPosition(), initial);
  assert.deepEqual(JSON.parse(JSON.stringify(initial)), initial);
  assert.equal(initial.board.length, 90);
  assert.equal(initial.board[square(0, 4)], "k");
  assert.equal(initial.board[square(9, 4)], "K");
  assert.equal(initial.board[square(7, 1)], "C");

  for (const fen of [
    MIDDLEGAME_FEN,
    "r1bakabr1/9/1cn4c1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C1N2/9/RNBAKAB1R b - - 3 5",
    DOUBLE_CHARIOT_FEN,
    STALEMATE_FEN,
  ]) {
    assert.equal(toFen(fromFen(fen)), fen);
  }
});

test("fromFen 接受 r 表示红方并补全缺省的回合计数", () => {
  const placement = INITIAL_FEN.split(" ")[0];

  assert.equal(toFen(fromFen(`${placement} r - - 0 1`)), INITIAL_FEN);
  assert.deepEqual(fromFen(`${placement} w`), fromFen(INITIAL_FEN));
  assert.deepEqual(fromFen(`  ${placement}  b  `), {
    ...fromFen(INITIAL_FEN),
    turn: BLACK,
  });
});

test("格式错误或不合法的 FEN 会抛出错误", () => {
  const malformed = [
    "",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9 w - - 0 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABN w - - 0 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNRR w - - 0 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABHR w - - 0 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR x - - 0 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - x 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 0",
    "rnba1abnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/4K4/RNBAKABNR w - - 0 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNKA1ABNR w - - 0 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/2B6/9/P1P1P1P1P/1C5C1/9/RN1AKABNR w - - 0 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/A8/RNB1KABNR w - - 0 1",
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/PC5C1/9/RNBAKABNR w - - 0 1",
    "4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1",
    "4k4/4R4/9/9/9/9/9/9/9/3K5 w - - 0 1",
  ];

  for (const fen of malformed) {
    assert.throws(() => fromFen(fen), Error, fen);
  }
  assert.throws(() => fromFen(42), TypeError);
});

test("马被蹩腿时不能朝该方向跳", () => {
  const open = fromFen("3k5/9/9/9/9/4N4/9/9/9/5K3 w - - 0 1");
  const blocked = fromFen("3k5/9/9/9/4P4/4Np3/9/9/9/5K3 w - - 0 1");

  assert.deepEqual(
    targetsFrom(open, 5, 4),
    squares([3, 3], [3, 5], [4, 2], [4, 6], [6, 2], [6, 6], [7, 3], [7, 5]),
  );
  assert.deepEqual(targetsFrom(blocked, 5, 4), squares([4, 2], [6, 2], [7, 3], [7, 5]));
  assert.deepEqual(targetsFrom(createInitialPosition(), 9, 1), squares([7, 0], [7, 2]));
});

test("相（象）被塞眼时不能走，也不能过河", () => {
  const blockedEye = fromFen("3k5/9/9/9/9/9/3N5/4B4/9/5K3 w - - 0 1");
  const riverBank = fromFen("3k5/9/9/9/9/2B6/9/9/9/5K3 w - - 0 1");
  const blackBank = fromFen("3k5/9/9/9/2b6/9/9/9/9/5K3 b - - 0 1");

  assert.deepEqual(targetsFrom(blockedEye, 7, 4), squares([5, 6], [9, 2], [9, 6]));
  assert.deepEqual(targetsFrom(riverBank, 5, 2), squares([7, 0], [7, 4]));
  assert.deepEqual(targetsFrom(blackBank, 4, 2), squares([2, 0], [2, 4]));
});

test("仕（士）与帅（将）不能离开九宫", () => {
  const centralAdvisor = fromFen("3k5/9/9/9/9/9/9/9/4A4/4K4 w - - 0 1");
  const cornerAdvisor = fromFen("3k5/9/9/9/9/9/9/9/9/3AK4 w - - 0 1");
  const redGeneral = fromFen("5k3/9/9/9/9/9/9/3K5/9/9 w - - 0 1");
  const blackGeneral = fromFen("9/9/5k3/9/9/9/9/9/9/3K5 b - - 0 1");

  assert.deepEqual(
    targetsFrom(centralAdvisor, 8, 4),
    squares([7, 3], [7, 5], [9, 3], [9, 5]),
  );
  assert.deepEqual(targetsFrom(cornerAdvisor, 9, 3), squares([8, 4]));
  assert.deepEqual(targetsFrom(redGeneral, 7, 3), squares([7, 4], [8, 3]));
  assert.deepEqual(targetsFrom(blackGeneral, 2, 5), squares([1, 5], [2, 4]));
});

test("炮必须隔一个子吃子，不吃子时不能翻山", () => {
  const position = fromFen("4k4/4a4/4b4/4P4/9/r1P1Cp2n/9/9/9/3K5 w - - 0 1");
  const targets = targetsFrom(position, 5, 4);

  assert.deepEqual(
    targets,
    squares([2, 4], [4, 4], [5, 0], [5, 3], [5, 8], [6, 4], [7, 4], [8, 4], [9, 4]),
  );
  assert.ok(!targets.includes(square(5, 1)), "不吃子时不能越过炮架");
  assert.ok(!targets.includes(square(5, 5)), "没有炮架时不能吃相邻的子");
  assert.ok(!targets.includes(square(1, 4)), "隔两个子时不能吃");
  assert.deepEqual(
    legalMovesFrom(position, square(5, 4)).find((candidate) => candidate.to === square(5, 0)),
    { from: square(5, 4), to: square(5, 0), piece: "C", captured: "r" },
  );
});

test("兵（卒）过河前只能前进，过河后可以横走但不能后退", () => {
  const red = fromFen("P2k5/9/9/9/4P4/9/2P6/9/9/5K3 w - - 0 1");
  const black = fromFen("3k5/9/9/4p4/9/2p6/9/9/9/5K3 b - - 0 1");

  assert.deepEqual(targetsFrom(red, 6, 2), squares([5, 2]));
  assert.deepEqual(targetsFrom(red, 4, 4), squares([3, 4], [4, 3], [4, 5]));
  assert.deepEqual(targetsFrom(red, 0, 0), squares([0, 1]));
  assert.deepEqual(targetsFrom(black, 3, 4), squares([4, 4]));
  assert.deepEqual(targetsFrom(black, 5, 2), squares([5, 1], [5, 3], [6, 2]));
});

test("飞将：将帅之间唯一的挡子不能离开这条直线", () => {
  const horseScreen = fromFen("4k4/9/9/9/9/4N4/9/9/9/4K4 w - - 0 1");
  const cannonScreen = fromFen("4k4/9/9/9/9/4C4/9/9/9/4K4 w - - 0 1");

  assert.deepEqual(legalMovesFrom(horseScreen, square(5, 4)), []);
  assert.ok(
    legalMovesFrom(cannonScreen, square(5, 4)).every((candidate) => candidate.to % 9 === 4),
  );
  assert.equal(legalMovesFrom(cannonScreen, square(5, 4)).length, 7);
  assert.throws(() => move(cannonScreen, [5, 4], [5, 3]), /不合法/);
});

test("飞将：帅不能走到与将照面的直线上", () => {
  const position = fromFen("4k4/9/9/9/9/9/9/9/9/3K5 w - - 0 1");

  assert.deepEqual(targetsFrom(position, 9, 3), squares([8, 3]));
  assert.throws(() => fromFen("4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1"), /照面/);
});

test("重炮杀和双车错杀被判为将死", () => {
  const doubleCannon = move(fromFen(DOUBLE_CANNON_FEN), [7, 1], [7, 4]);
  const doubleChariot = fromFen("R3k4/8R/9/9/9/9/9/9/9/3K5 b - - 1 1");

  for (const position of [doubleCannon, doubleChariot]) {
    assert.deepEqual(getGameStatus(position), {
      state: "checkmate",
      winner: RED,
      inCheck: true,
      reason: null,
    });
    assert.equal(isInCheck(position), true);
    assert.deepEqual(generateLegalMoves(position), []);
  }
});

test("困毙：无子可走即使没有被将军也判负", () => {
  const position = fromFen(STALEMATE_FEN);

  assert.equal(isInCheck(position), false);
  assert.deepEqual(getGameStatus(position), {
    state: "stalemate",
    winner: RED,
    inCheck: false,
    reason: null,
  });
});

test("同一局面出现三次判和", () => {
  let position = createInitialPosition();
  const history = [positionKey(position)];
  const cycle = [
    [[9, 7], [7, 6]],
    [[0, 7], [2, 6]],
    [[7, 6], [9, 7]],
    [[2, 6], [0, 7]],
  ];

  for (let round = 0; round < 2; round += 1) {
    assert.equal(getGameStatus(position, history).state, "playing");
    for (const [from, to] of cycle) {
      position = move(position, from, to);
      history.push(positionKey(position));
    }
  }

  assert.equal(positionKey(position), positionKey(createInitialPosition()));
  assert.deepEqual(getGameStatus(position, history), {
    state: "draw",
    winner: null,
    inCheck: false,
    reason: "repetition",
  });
});

test("连续 120 步没有吃子判和", () => {
  const placement = INITIAL_FEN.split(" ")[0];

  assert.equal(getGameStatus(fromFen(`${placement} w - - 119 70`)).state, "playing");
  assert.deepEqual(getGameStatus(fromFen(`${placement} w - - 120 70`)), {
    state: "draw",
    winner: null,
    inCheck: false,
    reason: "move-limit",
  });
});

test("双方都没有车马炮兵时判和", () => {
  const position = fromFen("4k4/4a4/9/9/9/9/9/9/4A4/3K5 w - - 0 1");

  assert.deepEqual(getGameStatus(position), {
    state: "draw",
    winner: null,
    inCheck: false,
    reason: "material",
  });
  assert.equal(getGameStatus(fromFen("4k4/4a4/9/9/9/9/9/9/4A4/3K1R3 w - - 0 1")).state, "playing");
});

test("isInCheck 可以检查任意一方", () => {
  const initial = createInitialPosition();
  const checked = fromFen("4k4/9/9/9/9/9/9/9/9/3KR4 b - - 0 1");

  assert.equal(isInCheck(initial), false);
  assert.equal(isInCheck(initial, BLACK), false);
  assert.equal(isInCheck(checked), true);
  assert.equal(isInCheck(checked, BLACK), true);
  assert.equal(isInCheck(checked, RED), false);
  assert.equal(getGameStatus(checked).inCheck, true);
});

test("applyMove 拒绝不合法走法且不修改原局面", () => {
  const position = deepFreeze(createInitialPosition());
  const snapshot = JSON.parse(JSON.stringify(position));

  assert.throws(() => move(position, [9, 0], [8, 1]), /不合法/);
  assert.throws(() => move(position, [0, 0], [1, 0]), /不合法/);
  assert.throws(() => move(position, [5, 4], [4, 4]), /不合法/);
  assert.throws(() => applyMove(position, { from: square(9, 0), to: 200 }), /不合法/);
  assert.throws(() => applyMove(position, null), TypeError);

  const next = move(position, [7, 7], [7, 4]);
  assert.deepEqual(position, snapshot);
  assert.equal(next.board[square(7, 4)], "C");
  assert.equal(next.board[square(7, 7)], null);
  assert.equal(positionKey(position), positionKey(createInitialPosition()));
});

test("applyMove 更新走棋方和回合计数", () => {
  const first = move(createInitialPosition(), [7, 7], [7, 4]);
  assert.deepEqual(
    { turn: first.turn, halfmoveClock: first.halfmoveClock, fullmoveNumber: first.fullmoveNumber },
    { turn: BLACK, halfmoveClock: 1, fullmoveNumber: 1 },
  );

  const second = move(first, [0, 7], [2, 6]);
  assert.deepEqual(
    {
      turn: second.turn,
      halfmoveClock: second.halfmoveClock,
      fullmoveNumber: second.fullmoveNumber,
    },
    { turn: RED, halfmoveClock: 2, fullmoveNumber: 2 },
  );

  const capture = move(second, [7, 4], [3, 4]);
  assert.equal(capture.halfmoveClock, 0);
  assert.equal(capture.board[square(3, 4)], "C");
  assert.equal(
    toFen(capture),
    "rnbakab1r/9/1c4nc1/p1p1C1p1p/9/9/P1P1P1P1P/1C7/9/RNBAKABNR b - - 0 2",
  );
});

test("moveToNotation 生成开局常见着法的中文记谱", () => {
  const initial = createInitialPosition();

  assert.equal(notation(initial, [7, 7], [7, 4]), "炮二平五");
  assert.equal(notation(initial, [9, 7], [7, 6]), "马二进三");
  assert.equal(notation(initial, [9, 8], [8, 8]), "车一进一");
  assert.equal(notation(initial, [6, 2], [5, 2]), "兵七进一");
  assert.equal(notation(initial, [9, 2], [7, 4]), "相七进五");
  assert.equal(notation(initial, [9, 5], [8, 4]), "仕四进五");
  assert.equal(notation(initial, [9, 4], [8, 4]), "帅五进一");

  const afterCannon = move(initial, [7, 7], [7, 4]);
  assert.equal(notation(afterCannon, [0, 7], [2, 6]), "马8进7");
  assert.equal(notation(afterCannon, [3, 2], [4, 2]), "卒3进1");
  assert.equal(notation(afterCannon, [2, 7], [2, 4]), "炮8平5");
  assert.throws(() => notation(afterCannon, [7, 4], [6, 4]), /不合法/);
});

test("同一纵线上有两个同类棋子时使用前、后", () => {
  const red = fromFen("rnbakabnr/9/1c5c1/p1p1p1p1p/1C7/9/P1P1P1P1P/1C7/9/RNBAKABNR w - - 0 1");
  const black = fromFen("rnbakabnr/9/7c1/p1p1p1p1p/9/7c1/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1");

  assert.equal(notation(red, [4, 1], [4, 4]), "前炮平五");
  assert.equal(notation(red, [7, 1], [7, 4]), "后炮平五");
  assert.equal(notation(red, [4, 1], [0, 1]), "前炮进四");
  assert.equal(notation(black, [5, 7], [5, 4]), "前炮平5");
  assert.equal(notation(black, [2, 7], [2, 4]), "后炮平5");
  assert.equal(notation(black, [5, 7], [3, 7]), "前炮退2");
});

test("同一纵线上有三个兵时使用前、中、后", () => {
  const position = fromFen("3k5/9/4P4/4P4/4P4/9/9/9/9/4K4 w - - 0 1");

  assert.equal(notation(position, [2, 4], [1, 4]), "前兵进一");
  assert.equal(notation(position, [3, 4], [3, 3]), "中兵平六");
  assert.equal(notation(position, [4, 4], [4, 5]), "后兵平四");
});

test("每个难度在开局都能给出合法走法", () => {
  const position = createInitialPosition();

  for (const options of [{ level: 1 }, { level: 2 }, { level: 3, timeLimitMs: 300 }, {}]) {
    const choice = chooseAiMove(position, { ...options, random: seededRandom(7) });
    assert.ok(isLegalMove(position, choice), JSON.stringify(options));
    assert.deepEqual(
      choice,
      generateLegalMoves(position).find(
        (candidate) => candidate.from === choice.from && candidate.to === choice.to,
      ),
    );
  }
});

test("入门和进阶都会吃掉无保护的车", () => {
  const position = fromFen(HANGING_CHARIOT_FEN);

  for (const options of [{ level: 2 }, { level: 3, timeLimitMs: 300 }]) {
    const choice = chooseAiMove(position, { ...options, random: seededRandom(3) });
    assert.equal(choice.captured, "r", JSON.stringify(options));
  }
});

test("入门和进阶都能找到一步杀", () => {
  for (const fen of [DOUBLE_CANNON_FEN, DOUBLE_CHARIOT_FEN]) {
    const position = fromFen(fen);
    for (const level of [2, 3]) {
      const choice = chooseAiMove(position, { level, random: seededRandom(5) });
      const status = getGameStatus(applyMove(position, choice));
      assert.equal(status.winner, RED, `${fen} 难度 ${level}`);
    }
  }

  const doubleCannon = fromFen(DOUBLE_CANNON_FEN);
  const choice = chooseAiMove(doubleCannon, { level: 3 });
  assert.equal(moveToNotation(doubleCannon, choice), "炮八平五");
});

test("入门和进阶能化解对方的一步杀威胁", () => {
  const position = fromFen(MATE_THREAT_FEN);

  for (const options of [{ level: 2 }, { level: 3, timeLimitMs: 300 }]) {
    const choice = chooseAiMove(position, { ...options, random: seededRandom(11) });
    assert.equal(allowsMateInOne(applyMove(position, choice)), false, JSON.stringify(options));
  }
});

test("启蒙难度弱而不傻：多数时候吃白送的车并避开一步杀", () => {
  const hanging = fromFen(HANGING_CHARIOT_FEN);
  const threatened = fromFen(MATE_THREAT_FEN);

  const takes = countSeeds(hanging, { level: 1 }, (choice) => choice.captured === "r");
  const escapes = countSeeds(
    threatened,
    { level: 1 },
    (choice) => !allowsMateInOne(applyMove(threatened, choice)),
  );

  assert.ok(takes >= 36, `吃车 ${takes}/40`);
  assert.ok(escapes >= 30, `避杀 ${escapes}/40`);
});

test("启蒙难度的开局走法带有随机性", () => {
  const position = createInitialPosition();
  const choices = new Set();

  for (let seed = 1; seed <= 20; seed += 1) {
    const choice = chooseAiMove(position, { level: 1, random: seededRandom(seed) });
    assert.ok(isLegalMove(position, choice));
    choices.add(`${choice.from}-${choice.to}`);
  }

  assert.ok(choices.size >= 4, `只出现了 ${choices.size} 种走法`);
});

test("相同随机种子得到相同走法", () => {
  const middlegame = fromFen(MIDDLEGAME_FEN);

  for (const options of [
    { level: 1 },
    { level: 2, timeLimitMs: 10000 },
    { level: 3, timeLimitMs: 10000, maxDepth: 4 },
  ]) {
    const first = chooseAiMove(middlegame, { ...options, random: seededRandom(2026) });
    const second = chooseAiMove(middlegame, { ...options, random: seededRandom(2026) });
    assert.deepEqual(first, second, JSON.stringify(options));
  }
});

test("进阶难度在时限内完成思考", () => {
  for (const position of [createInitialPosition(), fromFen(MIDDLEGAME_FEN)]) {
    const startedAt = performance.now();
    const choice = chooseAiMove(position, { level: 3 });
    const elapsed = performance.now() - startedAt;

    assert.ok(isLegalMove(position, choice));
    assert.ok(elapsed <= 1500 + 400, `用时 ${Math.round(elapsed)} ms`);
  }

  const startedAt = performance.now();
  chooseAiMove(fromFen(MIDDLEGAME_FEN), { level: 3, timeLimitMs: 200 });
  assert.ok(performance.now() - startedAt <= 200 + 400);
});

test("AI 收到对局历史后会在优势局面避免重复", () => {
  const position = fromFen("4k4/9/9/9/9/9/9/9/4A4/R2K5 w - - 10 30");
  const options = { level: 3, maxDepth: 3, timeLimitMs: 10000 };
  const preferred = chooseAiMove(position, { ...options, random: seededRandom(1) });
  const repeated = positionKey(applyMove(position, preferred));
  const elsewhere = positionKey(fromFen("5k3/9/9/9/9/9/9/9/4A4/R2K5 w - - 0 1"));
  const history = [elsewhere, repeated, elsewhere, repeated, positionKey(position)];

  const avoided = chooseAiMove(position, { ...options, history, random: seededRandom(1) });

  assert.ok(isLegalMove(position, avoided));
  assert.notDeepEqual(avoided, preferred);
});

test("没有合法走法时 chooseAiMove 返回 null", () => {
  const position = fromFen(STALEMATE_FEN);

  for (const level of [1, 2, 3]) {
    assert.equal(chooseAiMove(position, { level }), null);
  }
});
