import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";

import {
  BLACK,
  INITIAL_FEN,
  WHITE,
  applyMove,
  chooseAiMove,
  createInitialPosition,
  fromFen,
  generateLegalMoves,
  getGameStatus,
  isInCheck,
  legalMovesFrom,
  moveToSan,
  perft,
  positionKey,
  squareIndex,
  squareName,
  toFen,
} from "../site/js/chess.js";

const KIWIPETE =
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const ROOK_PAWN_ENDGAME = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
const PROMOTION_CHECK =
  "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1";
const CASTLING_PROMOTION =
  "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8";
const CASTLING_READY = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
const HANGING_QUEEN =
  "rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
const SCHOLAR_THREAT =
  "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3";
const STALEMATE = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
const FOOLS_MATE_LINE = "f2f3 e7e5 g2g4 d8h4";

function uci(text) {
  return {
    from: squareIndex(text.slice(0, 2)),
    to: squareIndex(text.slice(2, 4)),
    promotion: text[4],
  };
}

function play(position, line) {
  return line
    .split(" ")
    .reduce((current, text) => applyMove(current, uci(text)), position);
}

function san(position, text) {
  return moveToSan(position, uci(text));
}

function castles(position) {
  return generateLegalMoves(position)
    .filter((move) => move.castle !== null)
    .map((move) => move.castle)
    .sort();
}

function seededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function hasMateInOne(position) {
  return generateLegalMoves(position).some(
    (move) => getGameStatus(applyMove(position, move)).state === "checkmate",
  );
}

function assertLegal(position, move) {
  assert.ok(
    generateLegalMoves(position).some((candidate) =>
      isDeepStrictEqual(candidate, move),
    ),
    `AI 返回了非法走法：${JSON.stringify(move)}`,
  );
}

function timed(callback) {
  const startedAt = performance.now();
  const result = callback();
  return { result, elapsedMs: performance.now() - startedAt };
}

test("初始局面白方共有 20 种走法", () => {
  const position = createInitialPosition();

  assert.equal(generateLegalMoves(position).length, 20);
  assert.equal(toFen(position), INITIAL_FEN);
  assert.equal(position.turn, WHITE);
  assert.equal(position.castling, "KQkq");
  assert.equal(position.enPassant, null);
  assert.equal(position.board[squareIndex("e1")], "K");
  assert.equal(position.board[squareIndex("d8")], "q");
  assert.equal(position.board[squareIndex("e4")], null);
});

test("初始局面 perft 前四层为 20、400、8902、197281", () => {
  const position = createInitialPosition();

  assert.equal(perft(position, 0), 1);
  assert.deepEqual(
    [1, 2, 3, 4].map((depth) => perft(position, depth)),
    [20, 400, 8902, 197281],
  );
});

test("Kiwipete 复杂中局 perft 为 48、2039、97862", () => {
  const position = fromFen(KIWIPETE);

  assert.deepEqual(
    [1, 2, 3].map((depth) => perft(position, depth)),
    [48, 2039, 97862],
  );
});

test("车兵残局 perft 覆盖横向牵制下的吃过路兵", () => {
  const position = fromFen(ROOK_PAWN_ENDGAME);

  assert.deepEqual(
    [1, 2, 3, 4].map((depth) => perft(position, depth)),
    [14, 191, 2812, 43238],
  );
});

test("被将军且可升变的局面 perft 为 6、264、9467", () => {
  const position = fromFen(PROMOTION_CHECK);

  assert.deepEqual(
    [1, 2, 3].map((depth) => perft(position, depth)),
    [6, 264, 9467],
  );
});

test("易位与升变交织的局面 perft 为 44、1486、62379", () => {
  const position = fromFen(CASTLING_PROMOTION);

  assert.deepEqual(
    [1, 2, 3].map((depth) => perft(position, depth)),
    [44, 1486, 62379],
  );
});

test("FEN 可以无损往返", () => {
  for (const fen of [
    INITIAL_FEN,
    KIWIPETE,
    ROOK_PAWN_ENDGAME,
    PROMOTION_CHECK,
    CASTLING_PROMOTION,
    "rnbqkbnr/pp1ppppp/8/2pP4/8/8/PPP1PPPP/RNBQKBNR w KQkq c6 0 3",
    "8/8/8/8/8/8/8/K6k b - - 99 120",
  ]) {
    assert.equal(toFen(fromFen(fen)), fen);
  }

  const position = fromFen(INITIAL_FEN);
  assert.deepEqual(JSON.parse(JSON.stringify(position)), position);
});

test("格式错误的 FEN 会抛出错误", () => {
  for (const fen of [
    "",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1",
    "rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNRR w KQkq - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX w KQkq - 0 1",
    "rnbq1bnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBKKBNR w kq - 0 1",
    "rnbqkbnP/pppppppp/8/8/8/8/PPPPPPP1/RNBQKBNR w KQq - 0 1",
    "4k3/8/8/8/8/8/8/p3K3 w - - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkqK - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w QK - 0 1",
    "4k3/8/8/8/8/8/8/4K3 w K - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e9 0 1",
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e4 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - -1 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 0",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0",
    "4k3/8/8/8/8/8/8/4R1K1 w - - 0 1",
  ]) {
    assert.throws(() => fromFen(fen), Error, fen);
  }
  assert.throws(() => fromFen(null), TypeError);
});

test("格子名称与索引可以互相转换", () => {
  assert.equal(squareName(0), "a8");
  assert.equal(squareName(7), "h8");
  assert.equal(squareName(56), "a1");
  assert.equal(squareName(63), "h1");
  assert.equal(squareIndex("e4"), 36);
  for (let index = 0; index < 64; index += 1) {
    assert.equal(squareIndex(squareName(index)), index);
  }
  assert.throws(() => squareName(64), RangeError);
  assert.throws(() => squareIndex("i1"), RangeError);
  assert.throws(() => squareIndex("a9"), RangeError);
});

test("legalMovesFrom 只返回指定格子的走法", () => {
  const position = createInitialPosition();
  const pawnTargets = legalMovesFrom(position, squareIndex("e2"))
    .map((move) => squareName(move.to))
    .sort();

  assert.deepEqual(pawnTargets, ["e3", "e4"]);
  assert.equal(legalMovesFrom(position, squareIndex("g1")).length, 2);
  assert.deepEqual(legalMovesFrom(position, squareIndex("e1")), []);
  assert.deepEqual(legalMovesFrom(position, squareIndex("e4")), []);
  assert.deepEqual(legalMovesFrom(position, squareIndex("d7")), []);
  assert.deepEqual(legalMovesFrom(position, squareIndex("e2"))[0], {
    from: squareIndex("e2"),
    to: squareIndex("e3"),
    piece: "P",
    captured: null,
    promotion: null,
    castle: null,
    enPassant: false,
  });
});

test("易位不能在被将军、经过受攻击格或进入受攻击格时进行", () => {
  assert.deepEqual(castles(fromFen(CASTLING_READY)), ["K", "Q"]);
  assert.deepEqual(castles(fromFen("4k3/4r3/8/8/8/8/8/R3K2R w KQ - 0 1")), []);
  assert.deepEqual(castles(fromFen("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1")), [
    "Q",
  ]);
  assert.deepEqual(castles(fromFen("4k3/8/8/8/8/8/6r1/R3K2R w KQ - 0 1")), [
    "Q",
  ]);
  assert.deepEqual(castles(fromFen("4k3/8/8/8/8/8/1r6/R3K2R w KQ - 0 1")), [
    "K",
    "Q",
  ]);
  assert.deepEqual(castles(fromFen("4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1")), [
    "K",
  ]);
});

test("易位同时移动王和车，并在王或车移动后失去易位权", () => {
  const start = fromFen(CASTLING_READY);
  const kingside = applyMove(start, uci("e1g1"));
  const queenside = applyMove(start, uci("e1c1"));

  assert.equal(kingside.board[squareIndex("g1")], "K");
  assert.equal(kingside.board[squareIndex("f1")], "R");
  assert.equal(kingside.board[squareIndex("h1")], null);
  assert.equal(kingside.castling, "kq");
  assert.equal(queenside.board[squareIndex("c1")], "K");
  assert.equal(queenside.board[squareIndex("d1")], "R");
  assert.equal(queenside.board[squareIndex("a1")], null);
  assert.equal(queenside.castling, "kq");

  assert.equal(applyMove(start, uci("e1e2")).castling, "kq");
  assert.equal(applyMove(start, uci("h1h2")).castling, "Qkq");
  assert.equal(applyMove(start, uci("a1a2")).castling, "Kkq");
  assert.equal(play(start, "h1h2 e8d8").castling, "Q");
  assert.equal(play(start, "a1b1 h8g8").castling, "Kq");
  assert.deepEqual(castles(play(start, "e1e2 e8e7 e2e1 e7e8")), []);
});

test("车在原位被吃后失去对应易位权", () => {
  const start = fromFen(CASTLING_READY);

  assert.equal(applyMove(start, uci("a1a8")).castling, "Kk");
  assert.equal(applyMove(start, uci("h1h8")).castling, "Qq");
  assert.equal(
    applyMove(fromFen("r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1"), uci("g2h1"))
      .castling,
    "Qkq",
  );
});

test("吃过路兵会移走被吃的兵，局面键只在可吃时记录目标格", () => {
  const afterDoublePush = applyMove(createInitialPosition(), uci("e2e4"));

  assert.equal(afterDoublePush.enPassant, squareIndex("e3"));
  assert.match(toFen(afterDoublePush), / b KQkq e3 0 1$/);
  assert.match(positionKey(afterDoublePush), / b KQkq -$/);

  const ready = play(createInitialPosition(), "e2e4 a7a6 e4e5 d7d5");
  const capture = legalMovesFrom(ready, squareIndex("e5")).find(
    (move) => move.enPassant,
  );

  assert.match(positionKey(ready), / w KQkq d6$/);
  assert.deepEqual(capture, {
    from: squareIndex("e5"),
    to: squareIndex("d6"),
    piece: "P",
    captured: "p",
    promotion: null,
    castle: null,
    enPassant: true,
  });
  assert.equal(san(ready, "e5d6"), "exd6");

  const after = applyMove(ready, capture);
  assert.equal(after.board[squareIndex("d6")], "P");
  assert.equal(after.board[squareIndex("d5")], null);
  assert.equal(after.board[squareIndex("e5")], null);
  assert.equal(after.enPassant, null);
  assert.equal(after.halfmoveClock, 0);

  const missed = play(ready, "b1c3 a6a5");
  assert.equal(
    legalMovesFrom(missed, squareIndex("e5")).some((move) => move.enPassant),
    false,
  );
});

test("横向牵制时不能吃过路兵", () => {
  const pinned = fromFen("8/8/8/K2pP2r/8/8/8/7k w - d6 0 1");

  assert.equal(
    generateLegalMoves(pinned).some((move) => move.enPassant),
    false,
  );
  assert.equal(toFen(pinned), "8/8/8/K2pP2r/8/8/8/7k w - d6 0 1");
  assert.match(positionKey(pinned), / w - -$/);
  assert.throws(() => applyMove(pinned, uci("e5d6")), Error);
});

test("升变提供四种选择并支持低升变", () => {
  const position = fromFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  const promotions = legalMovesFrom(position, squareIndex("a7"))
    .map((move) => move.promotion)
    .sort();

  assert.deepEqual(promotions, ["b", "n", "q", "r"]);
  assert.equal(
    applyMove(position, uci("a7a8n")).board[squareIndex("a8")],
    "N",
  );
  assert.equal(
    applyMove(position, uci("a7a8")).board[squareIndex("a8")],
    "Q",
  );
  assert.equal(
    applyMove(position, { ...uci("a7a8"), promotion: "R" }).board[
      squareIndex("a8")
    ],
    "R",
  );
  assert.throws(() => applyMove(position, uci("a7a8k")), Error);

  const capture = fromFen("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  assert.equal(legalMovesFrom(capture, squareIndex("a7")).length, 8);

  const black = fromFen("4k3/8/8/8/8/8/p7/4K3 b - - 0 1");
  const promoted = applyMove(black, uci("a2a1r"));
  assert.equal(promoted.board[squareIndex("a1")], "r");
  assert.equal(promoted.fullmoveNumber, 2);
});

test("SAN 按需要用列、横排或完整格子消除歧义", () => {
  const knights = fromFen("4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1");
  assert.equal(san(knights, "b1d2"), "Nbd2");
  assert.equal(san(knights, "f1d2"), "Nfd2");
  assert.equal(san(knights, "b1c3"), "Nc3");

  const rooks = fromFen("4k3/R7/8/8/8/8/R7/4K3 w - - 0 1");
  assert.equal(san(rooks, "a7a4"), "R7a4");
  assert.equal(san(rooks, "a2a4"), "R2a4");

  const queens = fromFen("2k5/8/8/8/4Q2Q/8/8/K6Q w - - 0 1");
  assert.equal(san(queens, "h4e1"), "Qh4e1");
  assert.equal(san(queens, "e4e1"), "Qee1");
  assert.equal(san(queens, "h1e1"), "Q1e1");
});

test("SAN 正确表示吃子、升变、易位、将军和将死", () => {
  const start = createInitialPosition();
  assert.equal(san(start, "g1f3"), "Nf3");
  assert.equal(san(start, "e2e4"), "e4");
  assert.equal(san(play(start, "e2e4 d7d5"), "e4d5"), "exd5");
  assert.equal(san(play(start, "e2e4 e7e5 g1f3 b8c6"), "f3e5"), "Nxe5");
  assert.equal(san(play(start, "e2e4 d7d5"), "f1b5"), "Bb5+");
  assert.equal(san(play(start, "f2f3 e7e5 g2g4"), "d8h4"), "Qh4#");

  const openFile = fromFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  assert.equal(san(openFile, "a7a8q"), "a8=Q+");
  assert.equal(san(openFile, "a7a8n"), "a8=N");

  const blocked = fromFen("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  assert.equal(san(blocked, "a7a8q"), "a8=Q");
  assert.equal(san(blocked, "a7b8q"), "axb8=Q+");
  assert.equal(san(blocked, "a7b8n"), "axb8=N");

  const castling = fromFen(CASTLING_READY);
  assert.equal(san(castling, "e1g1"), "O-O");
  assert.equal(san(castling, "e1c1"), "O-O-O");
  assert.equal(san(fromFen("5k2/8/8/8/8/8/8/4K2R w K - 0 1"), "e1g1"), "O-O+");
  assert.throws(() => san(start, "e2e5"), Error);
});

test("愚人杀判定为将死", () => {
  const position = play(createInitialPosition(), FOOLS_MATE_LINE);

  assert.deepEqual(getGameStatus(position), {
    state: "checkmate",
    winner: BLACK,
    inCheck: true,
    reason: null,
  });
  assert.equal(isInCheck(position), true);
  assert.equal(isInCheck(position, BLACK), false);
  assert.deepEqual(generateLegalMoves(position), []);
});

test("无子可动且未被将军判定为逼和", () => {
  assert.deepEqual(getGameStatus(fromFen(STALEMATE)), {
    state: "stalemate",
    winner: null,
    inCheck: false,
    reason: "stalemate",
  });
});

test("被将军但仍有走法时继续对局", () => {
  const position = play(createInitialPosition(), "e2e4 f7f5 d1h5");

  assert.equal(isInCheck(position), true);
  assert.equal(isInCheck(position, WHITE), false);
  assert.deepEqual(getGameStatus(position), {
    state: "playing",
    winner: null,
    inCheck: true,
    reason: null,
  });
});

test("同一局面出现三次判和", () => {
  let position = createInitialPosition();
  const history = [positionKey(position)];
  for (const text of "g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8".split(" ")) {
    assert.equal(getGameStatus(position, history).state, "playing");
    position = applyMove(position, uci(text));
    history.push(positionKey(position));
  }

  assert.equal(history.filter((key) => key === history[0]).length, 3);
  assert.deepEqual(getGameStatus(position, history), {
    state: "draw",
    winner: null,
    inCheck: false,
    reason: "repetition",
  });
});

test("五十回合内无吃子无动兵判和，但将死优先", () => {
  assert.equal(
    getGameStatus(fromFen("4k3/8/8/8/8/8/8/R3K3 w - - 99 80")).state,
    "playing",
  );
  const fiftyMoves = fromFen("4k3/8/8/8/8/8/8/R3K3 w - - 100 80");
  assert.deepEqual(getGameStatus(fiftyMoves), {
    state: "draw",
    winner: null,
    inCheck: false,
    reason: "fifty-move",
  });
  assert.equal(
    getGameStatus(fromFen("R5k1/5ppp/8/8/8/8/8/6K1 b - - 100 80")).state,
    "checkmate",
  );
});

test("子力不足以将死时判和", () => {
  for (const fen of [
    "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
    "4k3/8/8/8/8/8/8/2B1K3 w - - 0 1",
    "4k3/8/8/8/8/8/8/1N2K3 b - - 0 1",
    "4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1",
  ]) {
    assert.deepEqual(getGameStatus(fromFen(fen)), {
      state: "draw",
      winner: null,
      inCheck: false,
      reason: "material",
    });
  }
  for (const fen of [
    "2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1",
    "4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1",
    "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
  ]) {
    assert.equal(getGameStatus(fromFen(fen)).state, "playing", fen);
  }
});

test("applyMove 拒绝非法走法并更新回合计数", () => {
  const start = createInitialPosition();

  assert.throws(() => applyMove(start, uci("e2e5")), Error);
  assert.throws(() => applyMove(start, uci("e7e5")), Error);
  assert.throws(() => applyMove(start, uci("e1e2")), Error);
  assert.throws(() => applyMove(start, { from: 64, to: 1 }), RangeError);
  assert.throws(() => applyMove(start, null), TypeError);
  assert.throws(
    () => applyMove(fromFen("4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1"), uci("e2d3")),
    Error,
  );

  const afterWhite = applyMove(start, uci("e2e4"));
  assert.equal(afterWhite.turn, BLACK);
  assert.equal(afterWhite.halfmoveClock, 0);
  assert.equal(afterWhite.fullmoveNumber, 1);

  const afterBlack = applyMove(afterWhite, uci("e7e5"));
  assert.equal(afterBlack.fullmoveNumber, 2);
  assert.equal(afterBlack.enPassant, squareIndex("e6"));

  const afterKnight = applyMove(afterBlack, uci("g1f3"));
  assert.equal(afterKnight.halfmoveClock, 1);
  assert.equal(afterKnight.enPassant, null);
});

test("公开函数不修改传入的局面", () => {
  const position = deepFreeze(play(createInitialPosition(), "e2e4 e7e5"));
  const before = toFen(position);
  const move = deepFreeze(uci("g1f3"));

  const next = applyMove(position, move);
  generateLegalMoves(position);
  legalMovesFrom(position, squareIndex("g1"));
  positionKey(position);
  getGameStatus(position, deepFreeze([positionKey(position)]));
  moveToSan(position, move);
  isInCheck(position);
  perft(position, 2);
  chooseAiMove(position, { level: 1, random: seededRandom(1) });

  assert.equal(toFen(position), before);
  assert.equal(next.board[squareIndex("f3")], "N");
  assert.notEqual(next.board, position.board);
});

test("各难度从初始局面都返回合法走法", () => {
  const position = createInitialPosition();

  for (const options of [
    { level: 1 },
    { level: 2 },
    { level: 3, timeLimitMs: 200 },
    {},
  ]) {
    assertLegal(position, chooseAiMove(position, options));
  }
});

test("没有合法走法时 AI 返回 null", () => {
  assert.equal(
    chooseAiMove(play(createInitialPosition(), FOOLS_MATE_LINE)),
    null,
  );
  assert.equal(chooseAiMove(fromFen(STALEMATE), { level: 3 }), null);
});

test("入门与进阶难度会吃掉白送的后", () => {
  const position = fromFen(HANGING_QUEEN);

  for (const level of [2, 3]) {
    const move = chooseAiMove(position, {
      level,
      timeLimitMs: 400,
      random: seededRandom(level),
    });
    assert.equal(moveToSan(position, move), "Nxh4");
  }
});

test("入门与进阶难度能找到一步杀", () => {
  for (const fen of [
    "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    "r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1",
    "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
  ]) {
    const position = fromFen(fen);
    for (const level of [2, 3]) {
      const move = chooseAiMove(position, { level, random: seededRandom(7) });
      assert.equal(
        getGameStatus(applyMove(position, move)).state,
        "checkmate",
        `${fen} 难度 ${level}`,
      );
    }
  }
});

test("进阶难度能找到两步杀", () => {
  const position = fromFen("kbK5/pp6/1P6/8/8/8/8/R7 w - - 0 1");
  const after = applyMove(
    position,
    chooseAiMove(position, { level: 3, timeLimitMs: 500 }),
  );

  assert.ok(
    getGameStatus(after).state === "checkmate" ||
      generateLegalMoves(after).every((reply) =>
        hasMateInOne(applyMove(after, reply)),
      ),
  );
});

test("进阶难度遵守思考时间上限", () => {
  for (const fen of [INITIAL_FEN, KIWIPETE]) {
    const position = fromFen(fen);
    const { result, elapsedMs } = timed(() =>
      chooseAiMove(position, { level: 3 }),
    );

    assertLegal(position, result);
    assert.ok(
      elapsedMs <= 1500 + 400,
      `${fen} 用时 ${elapsedMs.toFixed(0)}ms`,
    );
  }

  const busy = fromFen(KIWIPETE);
  const { result, elapsedMs } = timed(() =>
    chooseAiMove(busy, { level: 3, timeLimitMs: 300 }),
  );
  assertLegal(busy, result);
  assert.ok(elapsedMs <= 300 + 400, `用时 ${elapsedMs.toFixed(0)}ms`);
});

test("相同随机种子得到相同走法", () => {
  const position = play(createInitialPosition(), "e2e4 e7e5 g1f3 b8c6");

  for (const options of [
    { level: 1 },
    { level: 2, timeLimitMs: 10000 },
    { level: 3, timeLimitMs: 10000, maxDepth: 4 },
  ]) {
    const [first, second] = [42, 42].map((seed) =>
      chooseAiMove(position, { ...options, random: seededRandom(seed) }),
    );
    assert.deepEqual(first, second, `难度 ${options.level}`);
  }

  const openings = new Set();
  for (let seed = 1; seed <= 12; seed += 1) {
    const move = chooseAiMove(createInitialPosition(), {
      level: 1,
      random: seededRandom(seed),
    });
    openings.add(`${move.from}-${move.to}`);
  }
  assert.ok(openings.size > 1, "启蒙难度应带有随机性");
});

test("启蒙难度通常吃掉白送的后并防住一步杀", () => {
  const hanging = fromFen(HANGING_QUEEN);
  const threatened = fromFen(SCHOLAR_THREAT);
  let queensTaken = 0;
  let matesAvoided = 0;

  for (let seed = 1; seed <= 30; seed += 1) {
    const capture = chooseAiMove(hanging, {
      level: 1,
      random: seededRandom(seed),
    });
    const defence = chooseAiMove(threatened, {
      level: 1,
      random: seededRandom(seed),
    });
    queensTaken += capture.captured === "q" ? 1 : 0;
    matesAvoided += hasMateInOne(applyMove(threatened, defence)) ? 0 : 1;
  }

  assert.ok(queensTaken >= 27, `只吃了 ${queensTaken}/30 次后`);
  assert.ok(matesAvoided >= 27, `只防住 ${matesAvoided}/30 次一步杀`);
});

test("传入对局历史后 AI 领先时避开三次重复", () => {
  const position = fromFen("8/8/3k4/8/8/8/8/4K2Q w - - 10 40");

  for (const options of [
    { level: 2, timeLimitMs: 10000 },
    { level: 3, timeLimitMs: 10000, maxDepth: 3 },
  ]) {
    const preferred = chooseAiMove(position, {
      ...options,
      random: seededRandom(3),
    });
    const repeated = positionKey(applyMove(position, preferred));
    const history = [repeated, positionKey(position)];
    const alternative = chooseAiMove(position, {
      ...options,
      random: seededRandom(3),
      history: [...history, ...history],
    });

    assertLegal(position, alternative);
    assert.notEqual(positionKey(applyMove(position, alternative)), repeated);
  }
});
