export const RED = "r";
export const BLACK = "b";
export const INITIAL_FEN =
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";

const ROWS = 10;
const COLUMNS = 9;
const SQUARES = ROWS * COLUMNS;
const MAX_MOVES = 128;
const MAX_PLY = 96;
const MAX_DEPTH = 64;
const MOVE_LIMIT = 120;
const REPETITION_LIMIT = 3;

const KING = 1;
const ADVISOR = 2;
const ELEPHANT = 3;
const HORSE = 4;
const CHARIOT = 5;
const CANNON = 6;
const SOLDIER = 7;
const BLACK_BIT = 8;

const PIECE_LETTERS = Object.freeze([
  null,
  "K",
  "A",
  "B",
  "N",
  "R",
  "C",
  "P",
  null,
  "k",
  "a",
  "b",
  "n",
  "r",
  "c",
  "p",
]);

const PIECE_NAMES = Object.freeze({
  K: "帅",
  A: "仕",
  B: "相",
  N: "马",
  R: "车",
  C: "炮",
  P: "兵",
  k: "将",
  a: "士",
  b: "象",
  n: "马",
  r: "车",
  c: "炮",
  p: "卒",
});

const PIECE_LIMITS = Object.freeze({ K: 1, A: 2, B: 2, N: 2, R: 2, C: 2, P: 5 });
const SIDE_NAMES = Object.freeze(["红方", "黑方"]);
const CHINESE_NUMERALS = Object.freeze([..."一二三四五六七八九"]);
const ORDINAL_LABELS = Object.freeze({ 2: "前后", 3: "前中后" });

const ORTHOGONAL_STEPS = freezeRows([
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]);
const DIAGONAL_STEPS = freezeRows([
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]);
const ADVISOR_POINTS = freezeRows([
  [7, 3],
  [7, 5],
  [8, 4],
  [9, 3],
  [9, 5],
]);
const ELEPHANT_POINTS = freezeRows([
  [5, 2],
  [5, 6],
  [7, 0],
  [7, 4],
  [7, 8],
  [9, 2],
  [9, 6],
]);

function freezeRows(rows) {
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

function squareAt(row, column) {
  return row * COLUMNS + column;
}

function rowOf(square) {
  return Math.floor(square / COLUMNS);
}

function columnOf(square) {
  return square % COLUMNS;
}

function isOnBoard(row, column) {
  return row >= 0 && row < ROWS && column >= 0 && column < COLUMNS;
}

function isInPalace(side, row, column) {
  return column >= 3 && column <= 5 && (side === 0 ? row >= 7 : row <= 2);
}

function isOwnHalf(side, row) {
  return side === 0 ? row >= 5 : row <= 4;
}

function buildBoardTable(build) {
  return Object.freeze(
    Array.from({ length: SQUARES }, (_, square) =>
      Object.freeze(build(rowOf(square), columnOf(square))),
    ),
  );
}

function buildSideTables(build) {
  return Object.freeze(
    [0, 1].map((side) => buildBoardTable((row, column) => build(side, row, column))),
  );
}

function stepTargets(row, column, steps, accept) {
  return steps
    .map(([rowStep, columnStep]) => [row + rowStep, column + columnStep])
    .filter(([toRow, toColumn]) => isOnBoard(toRow, toColumn) && accept(toRow, toColumn))
    .map(([toRow, toColumn]) => squareAt(toRow, toColumn));
}

const RAYS = buildBoardTable((row, column) =>
  ORTHOGONAL_STEPS.map(([rowStep, columnStep]) => {
    const ray = [];
    let toRow = row + rowStep;
    let toColumn = column + columnStep;
    while (isOnBoard(toRow, toColumn)) {
      ray.push(squareAt(toRow, toColumn));
      toRow += rowStep;
      toColumn += columnStep;
    }
    return Object.freeze(ray);
  }),
);

const HORSE_MOVES = buildBoardTable((row, column) =>
  ORTHOGONAL_STEPS.flatMap(([rowStep, columnStep]) => {
    const targets =
      rowStep === 0
        ? [
            [row - 1, column + 2 * columnStep],
            [row + 1, column + 2 * columnStep],
          ]
        : [
            [row + 2 * rowStep, column - 1],
            [row + 2 * rowStep, column + 1],
          ];
    return targets
      .filter(([toRow, toColumn]) => isOnBoard(toRow, toColumn))
      .flatMap(([toRow, toColumn]) => [
        squareAt(toRow, toColumn),
        squareAt(row + rowStep, column + columnStep),
      ]);
  }),
);

const HORSE_ATTACKERS = buildBoardTable((row, column) =>
  DIAGONAL_STEPS.flatMap(([rowStep, columnStep]) => {
    const origins = [
      [row + 2 * rowStep, column + columnStep],
      [row + rowStep, column + 2 * columnStep],
    ];
    return origins
      .filter(([fromRow, fromColumn]) => isOnBoard(fromRow, fromColumn))
      .flatMap(([fromRow, fromColumn]) => [
        squareAt(fromRow, fromColumn),
        squareAt(row + rowStep, column + columnStep),
      ]);
  }),
);

const ELEPHANT_MOVES = buildSideTables((side, row, column) =>
  DIAGONAL_STEPS.flatMap(([rowStep, columnStep]) => {
    const toRow = row + 2 * rowStep;
    const toColumn = column + 2 * columnStep;
    return isOnBoard(toRow, toColumn) && isOwnHalf(side, toRow)
      ? [squareAt(toRow, toColumn), squareAt(row + rowStep, column + columnStep)]
      : [];
  }),
);

const ADVISOR_MOVES = buildSideTables((side, row, column) =>
  stepTargets(row, column, DIAGONAL_STEPS, (toRow, toColumn) =>
    isInPalace(side, toRow, toColumn),
  ),
);

const KING_MOVES = buildSideTables((side, row, column) =>
  stepTargets(row, column, ORTHOGONAL_STEPS, (toRow, toColumn) =>
    isInPalace(side, toRow, toColumn),
  ),
);

const SOLDIER_MOVES = buildSideTables((side, row, column) => {
  const forward = side === 0 ? -1 : 1;
  const steps = isOwnHalf(side, row)
    ? [[forward, 0]]
    : [
        [forward, 0],
        [0, -1],
        [0, 1],
      ];
  return stepTargets(row, column, steps, () => true);
});

const SOLDIER_ATTACKERS = Object.freeze(
  SOLDIER_MOVES.map((table) => {
    const origins = Array.from({ length: SQUARES }, () => []);
    table.forEach((targets, origin) => {
      targets.forEach((target) => origins[target].push(origin));
    });
    return Object.freeze(origins.map((list) => Object.freeze(list)));
  }),
);

function createKeyStream(seed) {
  let value = seed;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return value | 0;
  };
}

const nextKey = createKeyStream(0x2f6b3c1d);
const PIECE_KEYS = Int32Array.from({ length: 16 * SQUARES }, nextKey);
const PIECE_LOCKS = Int32Array.from({ length: 16 * SQUARES }, nextKey);
const SIDE_KEY = nextKey();
const SIDE_LOCK = nextKey();

const PIECE_VALUES = Object.freeze([0, 0, 120, 120, 270, 600, 300, 30]);
const ATTACKER_RANKS = Object.freeze([0, 6, 2, 2, 3, 5, 4, 1]);
const ZERO_ROW = Object.freeze(Array(COLUMNS).fill(0));

function boardBonus(rows) {
  const padded = [...Array(ROWS - rows.length).fill(ZERO_ROW), ...rows];
  return Object.freeze(padded.flat());
}

const POSITION_BONUS = Object.freeze([
  boardBonus([]),
  boardBonus([
    [0, 0, 0, -30, -26, -30, 0, 0, 0],
    [0, 0, 0, -20, -16, -20, 0, 0, 0],
    [0, 0, 0, -10, 0, -10, 0, 0, 0],
  ]),
  boardBonus([
    [0, 0, 0, -2, 0, -2, 0, 0, 0],
    [0, 0, 0, 0, 4, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]),
  boardBonus([
    [0, 0, -2, 0, 0, 0, -2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [-2, 0, 0, 0, 4, 0, 0, 0, -2],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]),
  boardBonus([
    [0, 4, 8, 8, 4, 8, 8, 4, 0],
    [4, 8, 16, 22, 10, 22, 16, 8, 4],
    [6, 14, 22, 20, 18, 20, 22, 14, 6],
    [6, 14, 18, 22, 22, 22, 18, 14, 6],
    [4, 10, 14, 18, 18, 18, 14, 10, 4],
    [2, 8, 12, 14, 14, 14, 12, 8, 2],
    [0, 6, 10, 10, 10, 10, 10, 6, 0],
    [0, 2, 8, 6, 8, 6, 8, 2, 0],
    [-4, 0, 2, 4, -6, 4, 2, 0, -4],
    [-6, -4, 0, -4, -8, -4, 0, -4, -6],
  ]),
  boardBonus([
    [8, 10, 8, 12, 12, 12, 8, 10, 8],
    [8, 12, 10, 16, 20, 16, 10, 12, 8],
    [8, 10, 8, 14, 14, 14, 8, 10, 8],
    [8, 12, 12, 14, 14, 14, 12, 12, 8],
    [8, 12, 12, 14, 14, 14, 12, 12, 8],
    [6, 10, 10, 12, 12, 12, 10, 10, 6],
    [4, 8, 6, 10, 10, 10, 6, 8, 4],
    [0, 6, 4, 8, 8, 8, 4, 6, 0],
    [0, 6, 4, 8, 4, 8, 4, 6, 0],
    [-6, 4, 2, 6, 0, 6, 2, 4, -6],
  ]),
  boardBonus([
    [4, 4, 0, -4, -6, -4, 0, 4, 4],
    [2, 2, 0, -4, -6, -4, 0, 2, 2],
    [2, 2, 0, -2, 0, -2, 0, 2, 2],
    [0, 2, 2, 2, 6, 2, 2, 2, 0],
    [0, 0, 0, 2, 8, 2, 0, 0, 0],
    [0, 0, 2, 2, 8, 2, 2, 0, 0],
    [0, 0, 0, 0, 6, 0, 0, 0, 0],
    [2, 2, 4, 4, 10, 4, 4, 2, 2],
    [0, 2, 2, 2, 4, 2, 2, 2, 0],
    [0, 0, 2, 2, 2, 2, 2, 0, 0],
  ]),
  boardBonus([
    [10, 12, 14, 18, 20, 18, 14, 12, 10],
    [26, 32, 40, 50, 56, 50, 40, 32, 26],
    [28, 34, 40, 48, 52, 48, 40, 34, 28],
    [28, 32, 36, 42, 44, 42, 36, 32, 28],
    [24, 26, 30, 34, 36, 34, 30, 26, 24],
    [0, 0, 4, 0, 8, 0, 4, 0, 0],
    [0, 0, 0, 0, 4, 0, 0, 0, 0],
  ]),
]);

const PIECE_SQUARE_VALUES = buildPieceSquareValues();

function buildPieceSquareValues() {
  const values = new Int16Array(16 * SQUARES);
  for (let type = KING; type <= SOLDIER; type += 1) {
    for (let square = 0; square < SQUARES; square += 1) {
      values[type * SQUARES + square] = PIECE_VALUES[type] + POSITION_BONUS[type][square];
      values[(type | BLACK_BIT) * SQUARES + square] = -(
        PIECE_VALUES[type] + POSITION_BONUS[type][SQUARES - 1 - square]
      );
    }
  }
  return values;
}

function pieceCode(letter) {
  return typeof letter === "string" ? PIECE_LETTERS.indexOf(letter) : -1;
}

function sideOfLetter(letter) {
  return letter === letter.toUpperCase() ? 0 : 1;
}

function isValidPlacement(type, side, row, column) {
  const redRow = side === 0 ? row : ROWS - 1 - row;
  const isPoint = ([pointRow, pointColumn]) => pointRow === redRow && pointColumn === column;

  switch (type) {
    case "K":
      return isInPalace(side, row, column);
    case "A":
      return ADVISOR_POINTS.some(isPoint);
    case "B":
      return ELEPHANT_POINTS.some(isPoint);
    case "P":
      return redRow <= 4 || (redRow <= 6 && column % 2 === 0);
    default:
      return true;
  }
}

function describeSquare(square) {
  return `第 ${rowOf(square) + 1} 行第 ${columnOf(square) + 1} 列`;
}

function assertPlacement(board) {
  const counts = new Map();

  board.forEach((letter, square) => {
    if (letter === null) {
      return;
    }

    const side = sideOfLetter(letter);
    const type = letter.toUpperCase();
    const count = (counts.get(letter) ?? 0) + 1;
    counts.set(letter, count);
    if (count > PIECE_LIMITS[type]) {
      throw new Error(`${SIDE_NAMES[side]}的${PIECE_NAMES[letter]}数量过多`);
    }
    if (!isValidPlacement(type, side, rowOf(square), columnOf(square))) {
      const piece = `${SIDE_NAMES[side]}的${PIECE_NAMES[letter]}`;
      throw new Error(`${piece}不能位于${describeSquare(square)}`);
    }
  });
}

function parseRank(rank, row) {
  const cells = [];

  for (const char of rank) {
    if (char >= "1" && char <= "9") {
      cells.push(...Array(Number(char)).fill(null));
    } else if (pieceCode(char) > 0) {
      cells.push(char);
    } else {
      throw new Error(`FEN 包含无法识别的字符：${char}`);
    }
  }
  if (cells.length !== COLUMNS) {
    throw new Error(`FEN 第 ${row + 1} 行必须正好 9 列`);
  }

  return cells;
}

function parsePlacement(placement) {
  const ranks = placement.split("/");
  if (ranks.length !== ROWS) {
    throw new Error("FEN 必须包含 10 行棋子");
  }

  return ranks.flatMap((rank, row) => parseRank(rank, row));
}

function parseTurn(field = "w") {
  if (field === "w" || field === RED) {
    return RED;
  }
  if (field === BLACK) {
    return BLACK;
  }

  throw new Error("FEN 的走棋方必须是 w、r 或 b");
}

function parseCounters(fields) {
  const numbers = fields.filter((field) => field !== "-");
  if (numbers.length > 2 || numbers.some((field) => !/^\d{1,9}$/.test(field))) {
    throw new Error("FEN 的回合计数无效");
  }

  const [halfmoveClock = 0, fullmoveNumber = 1] = numbers.map(Number);
  if (fullmoveNumber < 1) {
    throw new Error("FEN 的回合数必须从 1 开始");
  }

  return { halfmoveClock, fullmoveNumber };
}

function placementOf(board) {
  const ranks = [];

  for (let row = 0; row < ROWS; row += 1) {
    let rank = "";
    let empty = 0;
    for (let column = 0; column < COLUMNS; column += 1) {
      const letter = board[squareAt(row, column)];
      if (letter === null) {
        empty += 1;
        continue;
      }
      rank += empty > 0 ? `${empty}${letter}` : letter;
      empty = 0;
    }
    ranks.push(empty > 0 ? `${rank}${empty}` : rank);
  }

  return ranks.join("/");
}

function turnCode(position) {
  return position.turn === RED ? "w" : "b";
}

function assertPositionShape(position) {
  if (position === null || typeof position !== "object") {
    throw new TypeError("局面必须是对象");
  }

  const { board, turn, halfmoveClock, fullmoveNumber } = position;
  if (!Array.isArray(board) || board.length !== SQUARES) {
    throw new TypeError("棋盘必须是包含 90 个格子的数组");
  }
  if (turn !== RED && turn !== BLACK) {
    throw new TypeError("走棋方必须是 r 或 b");
  }
  if (!Number.isInteger(halfmoveClock) || halfmoveClock < 0) {
    throw new RangeError("halfmoveClock 必须是非负整数");
  }
  if (!Number.isInteger(fullmoveNumber) || fullmoveNumber < 1) {
    throw new RangeError("fullmoveNumber 必须是正整数");
  }
}

function assertSquare(square) {
  if (!Number.isInteger(square) || square < 0 || square >= SQUARES) {
    throw new RangeError("格子索引必须在 0–89 之间");
  }
}

function placePiece(state, square, piece) {
  const index = piece * SQUARES + square;
  state.board[square] = piece;
  state.counts[piece] += 1;
  state.key ^= PIECE_KEYS[index];
  state.lock ^= PIECE_LOCKS[index];
  state.score += PIECE_SQUARE_VALUES[index];
  if ((piece & 7) === KING) {
    state.kings[piece >> 3] = square;
  }
}

function loadState(position) {
  assertPositionShape(position);
  const state = {
    board: new Int8Array(SQUARES),
    side: position.turn === RED ? 0 : 1,
    kings: new Int8Array(2),
    counts: new Int8Array(16),
    key: 0,
    lock: 0,
    score: 0,
  };

  for (let square = 0; square < SQUARES; square += 1) {
    const letter = position.board[square];
    if (letter === null) {
      continue;
    }

    const piece = pieceCode(letter);
    if (piece <= 0) {
      throw new TypeError(`棋盘${describeSquare(square)}的棋子无效`);
    }
    placePiece(state, square, piece);
  }

  if (state.side === 1) {
    state.key ^= SIDE_KEY;
    state.lock ^= SIDE_LOCK;
  }
  if (state.counts[KING] !== 1 || state.counts[KING | BLACK_BIT] !== 1) {
    throw new Error("红黑双方必须各有且只有一个帅（将）");
  }
  if (isSideInCheck(state, state.side ^ 1)) {
    throw new Error("非走棋方正被将军（或将帅照面），局面不合法");
  }

  return state;
}

function isSquareAttacked(board, square, attacker) {
  const offset = attacker << 3;
  const chariot = offset | CHARIOT;
  const cannon = offset | CANNON;
  const king = offset | KING;
  const rays = RAYS[square];

  for (let direction = 0; direction < 4; direction += 1) {
    const ray = rays[direction];
    let index = 0;
    while (index < ray.length && board[ray[index]] === 0) {
      index += 1;
    }
    if (index === ray.length) {
      continue;
    }

    const blocker = board[ray[index]];
    // 将帅在同一直线上照面时视同互相攻击，以此禁止“飞将”。
    if (blocker === chariot || (blocker === king && direction < 2)) {
      return true;
    }
    for (index += 1; index < ray.length; index += 1) {
      const piece = board[ray[index]];
      if (piece !== 0) {
        if (piece === cannon) {
          return true;
        }
        break;
      }
    }
  }

  const horses = HORSE_ATTACKERS[square];
  const horse = offset | HORSE;
  for (let index = 0; index < horses.length; index += 2) {
    if (board[horses[index]] === horse && board[horses[index + 1]] === 0) {
      return true;
    }
  }

  const soldiers = SOLDIER_ATTACKERS[attacker][square];
  const soldier = offset | SOLDIER;
  for (let index = 0; index < soldiers.length; index += 1) {
    if (board[soldiers[index]] === soldier) {
      return true;
    }
  }

  return false;
}

function isSideInCheck(state, side) {
  return isSquareAttacked(state.board, state.kings[side], side ^ 1);
}

function isLegalAfterMake(state) {
  return !isSideInCheck(state, state.side ^ 1);
}

function makeMove(state, move) {
  const from = move >> 7;
  const to = move & 127;
  const { board } = state;
  const piece = board[from];
  const captured = board[to];
  const fromIndex = piece * SQUARES + from;
  const toIndex = piece * SQUARES + to;

  board[from] = 0;
  board[to] = piece;
  state.key ^= PIECE_KEYS[fromIndex] ^ PIECE_KEYS[toIndex] ^ SIDE_KEY;
  state.lock ^= PIECE_LOCKS[fromIndex] ^ PIECE_LOCKS[toIndex] ^ SIDE_LOCK;
  state.score += PIECE_SQUARE_VALUES[toIndex] - PIECE_SQUARE_VALUES[fromIndex];
  if (captured !== 0) {
    const capturedIndex = captured * SQUARES + to;
    state.key ^= PIECE_KEYS[capturedIndex];
    state.lock ^= PIECE_LOCKS[capturedIndex];
    state.score -= PIECE_SQUARE_VALUES[capturedIndex];
    state.counts[captured] -= 1;
  }
  if ((piece & 7) === KING) {
    state.kings[piece >> 3] = to;
  }
  state.side ^= 1;

  return captured;
}

function unmakeMove(state, move, captured) {
  const from = move >> 7;
  const to = move & 127;
  const { board } = state;
  const piece = board[to];
  const fromIndex = piece * SQUARES + from;
  const toIndex = piece * SQUARES + to;

  board[from] = piece;
  board[to] = captured;
  state.key ^= PIECE_KEYS[fromIndex] ^ PIECE_KEYS[toIndex] ^ SIDE_KEY;
  state.lock ^= PIECE_LOCKS[fromIndex] ^ PIECE_LOCKS[toIndex] ^ SIDE_LOCK;
  state.score -= PIECE_SQUARE_VALUES[toIndex] - PIECE_SQUARE_VALUES[fromIndex];
  if (captured !== 0) {
    const capturedIndex = captured * SQUARES + to;
    state.key ^= PIECE_KEYS[capturedIndex];
    state.lock ^= PIECE_LOCKS[capturedIndex];
    state.score += PIECE_SQUARE_VALUES[capturedIndex];
    state.counts[captured] += 1;
  }
  if ((piece & 7) === KING) {
    state.kings[piece >> 3] = from;
  }
  state.side ^= 1;
}

function addTarget(board, from, to, side, moves, count, capturesOnly) {
  const target = board[to];
  if (target === 0 ? capturesOnly : target >> 3 === side) {
    return count;
  }

  moves[count] = (from << 7) | to;
  return count + 1;
}

function addSteps(board, from, side, targets, moves, count, capturesOnly) {
  let next = count;
  for (let index = 0; index < targets.length; index += 1) {
    next = addTarget(board, from, targets[index], side, moves, next, capturesOnly);
  }
  return next;
}

function addBlockableSteps(board, from, side, pairs, moves, count, capturesOnly) {
  let next = count;
  for (let index = 0; index < pairs.length; index += 2) {
    if (board[pairs[index + 1]] === 0) {
      next = addTarget(board, from, pairs[index], side, moves, next, capturesOnly);
    }
  }
  return next;
}

function addChariotMoves(board, from, side, moves, count, capturesOnly) {
  const rays = RAYS[from];
  let next = count;

  for (let direction = 0; direction < 4; direction += 1) {
    const ray = rays[direction];
    for (let index = 0; index < ray.length; index += 1) {
      const target = board[ray[index]];
      if (target === 0) {
        if (!capturesOnly) {
          moves[next] = (from << 7) | ray[index];
          next += 1;
        }
        continue;
      }
      if (target >> 3 !== side) {
        moves[next] = (from << 7) | ray[index];
        next += 1;
      }
      break;
    }
  }

  return next;
}

function addCannonMoves(board, from, side, moves, count, capturesOnly) {
  const rays = RAYS[from];
  let next = count;

  for (let direction = 0; direction < 4; direction += 1) {
    const ray = rays[direction];
    let index = 0;
    for (; index < ray.length && board[ray[index]] === 0; index += 1) {
      if (!capturesOnly) {
        moves[next] = (from << 7) | ray[index];
        next += 1;
      }
    }
    for (index += 1; index < ray.length; index += 1) {
      const target = board[ray[index]];
      if (target !== 0) {
        if (target >> 3 !== side) {
          moves[next] = (from << 7) | ray[index];
          next += 1;
        }
        break;
      }
    }
  }

  return next;
}

function generateMovesFrom(state, from, moves, count, capturesOnly) {
  const { board } = state;
  const piece = board[from];
  const side = piece >> 3;

  switch (piece & 7) {
    case CHARIOT:
      return addChariotMoves(board, from, side, moves, count, capturesOnly);
    case CANNON:
      return addCannonMoves(board, from, side, moves, count, capturesOnly);
    case HORSE:
      return addBlockableSteps(board, from, side, HORSE_MOVES[from], moves, count, capturesOnly);
    case ELEPHANT:
      return addBlockableSteps(
        board,
        from,
        side,
        ELEPHANT_MOVES[side][from],
        moves,
        count,
        capturesOnly,
      );
    case ADVISOR:
      return addSteps(board, from, side, ADVISOR_MOVES[side][from], moves, count, capturesOnly);
    case KING:
      return addSteps(board, from, side, KING_MOVES[side][from], moves, count, capturesOnly);
    case SOLDIER:
      return addSteps(board, from, side, SOLDIER_MOVES[side][from], moves, count, capturesOnly);
    default:
      return count;
  }
}

function generateMoves(state, moves, start, capturesOnly) {
  const { board, side } = state;
  let count = start;

  for (let from = 0; from < SQUARES; from += 1) {
    const piece = board[from];
    if (piece !== 0 && piece >> 3 === side) {
      count = generateMovesFrom(state, from, moves, count, capturesOnly);
    }
  }

  return count;
}

function hasLegalMove(state, moves, start) {
  const end = generateMoves(state, moves, start, false);

  for (let index = start; index < end; index += 1) {
    const captured = makeMove(state, moves[index]);
    const legal = isLegalAfterMake(state);
    unmakeMove(state, moves[index], captured);
    if (legal) {
      return true;
    }
  }

  return false;
}

function legalMoveCodes(state, from = -1) {
  const moves = new Int32Array(MAX_MOVES);
  let end = 0;
  if (from < 0) {
    end = generateMoves(state, moves, 0, false);
  } else if (state.board[from] !== 0 && state.board[from] >> 3 === state.side) {
    end = generateMovesFrom(state, from, moves, 0, false);
  }

  const legal = [];
  for (let index = 0; index < end; index += 1) {
    const captured = makeMove(state, moves[index]);
    if (isLegalAfterMake(state)) {
      legal.push(moves[index]);
    }
    unmakeMove(state, moves[index], captured);
  }

  return legal;
}

function findLegalMove(state, move) {
  if (move === null || typeof move !== "object") {
    throw new TypeError("走法必须是包含 from 和 to 的对象");
  }

  const { from, to } = move;
  if (!Number.isInteger(from) || from < 0 || from >= SQUARES) {
    return -1;
  }

  return legalMoveCodes(state, from).find((code) => (code & 127) === to) ?? -1;
}

function describeMove(board, move) {
  const from = move >> 7;
  const to = move & 127;
  return { from, to, piece: PIECE_LETTERS[board[from]], captured: PIECE_LETTERS[board[to]] };
}

function numeral(side, value) {
  return side === 0 ? CHINESE_NUMERALS[value - 1] : String(value);
}

function fileLabel(side, column) {
  return numeral(side, side === 0 ? COLUMNS - column : column + 1);
}

function stackedSquares(board, letter, column, side) {
  const squares = [];
  for (let row = 0; row < ROWS; row += 1) {
    if (board[squareAt(row, column)] === letter) {
      squares.push(squareAt(row, column));
    }
  }
  return side === 0 ? squares : squares.reverse();
}

function hasOtherStack(board, letter, column, side) {
  for (let other = 0; other < COLUMNS; other += 1) {
    if (other !== column && stackedSquares(board, letter, other, side).length > 1) {
      return true;
    }
  }
  return false;
}

function originLabel(board, from, side) {
  const letter = board[from];
  const type = letter.toUpperCase();
  const column = columnOf(from);
  const stack = stackedSquares(board, letter, column, side);

  // 仕（士）、相（象）同线时一个只能进、一个只能退，按惯例不加前后。
  if (stack.length < 2 || type === "A" || type === "B") {
    return `${PIECE_NAMES[letter]}${fileLabel(side, column)}`;
  }

  const rank = stack.indexOf(from);
  const label = ORDINAL_LABELS[stack.length]?.[rank] ?? numeral(side, rank + 1);
  if (type === "P" && hasOtherStack(board, letter, column, side)) {
    return `${label}${fileLabel(side, column)}`;
  }

  return `${label}${PIECE_NAMES[letter]}`;
}

function countForces(counts, offset) {
  return (
    counts[offset | HORSE] +
    counts[offset | CHARIOT] +
    counts[offset | CANNON] +
    counts[offset | SOLDIER]
  );
}

function drawReason(position, state, history) {
  const key = `${placementOf(position.board)} ${turnCode(position)}`;
  const repeats = history.reduce((total, entry) => (entry === key ? total + 1 : total), 0);
  if (repeats >= REPETITION_LIMIT) {
    return "repetition";
  }
  if (position.halfmoveClock >= MOVE_LIMIT) {
    return "move-limit";
  }
  if (countForces(state.counts, 0) + countForces(state.counts, BLACK_BIT) === 0) {
    return "material";
  }

  return null;
}

export function createInitialPosition() {
  return fromFen(INITIAL_FEN);
}

export function fromFen(fen) {
  if (typeof fen !== "string") {
    throw new TypeError("FEN 必须是字符串");
  }

  const [placement = "", turn, ...counters] = fen.trim().split(/\s+/);
  const board = parsePlacement(placement);
  assertPlacement(board);
  const position = { board, turn: parseTurn(turn), ...parseCounters(counters) };
  loadState(position);

  return position;
}

export function toFen(position) {
  loadState(position);
  const counters = `${position.halfmoveClock} ${position.fullmoveNumber}`;
  return `${placementOf(position.board)} ${turnCode(position)} - - ${counters}`;
}

export function positionKey(position) {
  loadState(position);
  return `${placementOf(position.board)} ${turnCode(position)}`;
}

export function generateLegalMoves(position) {
  const state = loadState(position);
  return legalMoveCodes(state).map((move) => describeMove(state.board, move));
}

export function legalMovesFrom(position, from) {
  const state = loadState(position);
  assertSquare(from);
  return legalMoveCodes(state, from).map((move) => describeMove(state.board, move));
}

export function applyMove(position, move) {
  const state = loadState(position);
  const code = findLegalMove(state, move);
  if (code < 0) {
    throw new Error("不合法的走法");
  }

  const from = code >> 7;
  const to = code & 127;
  const board = [...position.board];
  const captured = board[to];
  board[to] = board[from];
  board[from] = null;

  return {
    board,
    turn: position.turn === RED ? BLACK : RED,
    halfmoveClock: captured === null ? position.halfmoveClock + 1 : 0,
    fullmoveNumber:
      position.turn === BLACK ? position.fullmoveNumber + 1 : position.fullmoveNumber,
  };
}

export function isInCheck(position, side = position?.turn) {
  const state = loadState(position);
  if (side !== RED && side !== BLACK) {
    throw new TypeError("side 必须是 r 或 b");
  }
  return isSideInCheck(state, side === RED ? 0 : 1);
}

export function getGameStatus(position, history = []) {
  const state = loadState(position);
  if (!Array.isArray(history)) {
    throw new TypeError("history 必须是局面键数组");
  }

  const inCheck = isSideInCheck(state, state.side);
  if (!hasLegalMove(state, new Int32Array(MAX_MOVES), 0)) {
    return {
      state: inCheck ? "checkmate" : "stalemate",
      winner: state.side === 0 ? BLACK : RED,
      inCheck,
      reason: null,
    };
  }

  const reason = drawReason(position, state, history);
  return { state: reason === null ? "playing" : "draw", winner: null, inCheck, reason };
}

export function moveToNotation(position, move) {
  const state = loadState(position);
  const code = findLegalMove(state, move);
  if (code < 0) {
    throw new Error("不合法的走法");
  }

  const from = code >> 7;
  const to = code & 127;
  const { side } = state;
  const type = position.board[from].toUpperCase();
  const advance = side === 0 ? rowOf(from) - rowOf(to) : rowOf(to) - rowOf(from);
  const action = advance > 0 ? "进" : advance < 0 ? "退" : "平";
  const amount =
    action === "平" || type === "N" || type === "B" || type === "A"
      ? fileLabel(side, columnOf(to))
      : numeral(side, Math.abs(advance));

  return `${originLabel(position.board, from, side)}${action}${amount}`;
}

export function perft(position, depth) {
  if (!Number.isInteger(depth) || depth < 0) {
    throw new RangeError("perft 深度必须是非负整数");
  }

  const state = loadState(position);
  return countLeaves(state, depth, new Int32Array((depth + 1) * MAX_MOVES), 0);
}

function countLeaves(state, depth, moves, start) {
  if (depth === 0) {
    return 1;
  }

  const end = generateMoves(state, moves, start, false);
  let total = 0;
  for (let index = start; index < end; index += 1) {
    const captured = makeMove(state, moves[index]);
    if (isLegalAfterMake(state)) {
      total += depth === 1 ? 1 : countLeaves(state, depth - 1, moves, end);
    }
    unmakeMove(state, moves[index], captured);
  }

  return total;
}

const MATE_SCORE = 30000;
const MATE_BOUND = MATE_SCORE - 2 * MAX_PLY;
const INFINITE_SCORE = 32000;
const TABLE_SIZE = 1 << 18;
const TABLE_MASK = TABLE_SIZE - 1;
const EXACT = 1;
const LOWER = 2;
const UPPER = 3;
const TABLE_MOVE_ORDER = 1 << 30;
const CAPTURE_ORDER = 1 << 24;
const HISTORY_LIMIT = 1 << 20;
const SOFT_TIME_RATIO = 0.5;
const GENTLE_NOISE = 25;
const CARELESS_CHANCE = 0.3;
const MATE_BLINDNESS_CHANCE = 0.1;

const AI_LEVELS = Object.freeze({
  1: Object.freeze({ timeLimitMs: 150, maxDepth: 1, noise: 0, pruning: false }),
  2: Object.freeze({ timeLimitMs: 600, maxDepth: 3, noise: 12, pruning: false }),
  3: Object.freeze({ timeLimitMs: 1500, maxDepth: MAX_DEPTH, noise: 3, pruning: true }),
});

let transpositionTable = null;

function currentTime() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function resetTable() {
  if (transpositionTable === null) {
    transpositionTable = {
      keys: new Int32Array(TABLE_SIZE),
      locks: new Int32Array(TABLE_SIZE),
      moves: new Int16Array(TABLE_SIZE),
      scores: new Int16Array(TABLE_SIZE),
      depths: new Int8Array(TABLE_SIZE),
      flags: new Int8Array(TABLE_SIZE),
    };
  } else {
    transpositionTable.flags.fill(0);
  }
  return transpositionTable;
}

function normalizeLevel(level) {
  const value = Math.round(Number(level));
  return Number.isFinite(value) ? Math.min(3, Math.max(1, value)) : 2;
}

function unitRandom(random) {
  return () => {
    const value = Number(random());
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999) : 0;
  };
}

function resolveSettings(options, startTime) {
  const {
    level = 2,
    timeLimitMs,
    random = Math.random,
    maxDepth,
    history = [],
  } = options ?? {};
  const normalizedLevel = normalizeLevel(level);
  const preset = AI_LEVELS[normalizedLevel];

  return {
    level: normalizedLevel,
    timeLimitMs:
      Number.isFinite(timeLimitMs) && timeLimitMs > 0 ? timeLimitMs : preset.timeLimitMs,
    random: unitRandom(typeof random === "function" ? random : Math.random),
    maxDepth:
      Number.isInteger(maxDepth) && maxDepth > 0 ? Math.min(maxDepth, MAX_DEPTH) : preset.maxDepth,
    history: Array.isArray(history) ? history : [],
    noise: preset.noise,
    pruning: preset.pruning,
    startTime,
  };
}

function hashPositionKey(entry) {
  if (typeof entry !== "string") {
    return null;
  }

  const [placement = "", turn] = entry.split(" ");
  try {
    const board = parsePlacement(placement);
    let key = turn === "b" ? SIDE_KEY : 0;
    let lock = turn === "b" ? SIDE_LOCK : 0;
    board.forEach((letter, square) => {
      if (letter !== null) {
        key ^= PIECE_KEYS[pieceCode(letter) * SQUARES + square];
        lock ^= PIECE_LOCKS[pieceCode(letter) * SQUARES + square];
      }
    });
    return { key, lock };
  } catch {
    return null;
  }
}

function previousPositions(position, history) {
  const entries = history.slice(-(position.halfmoveClock + 1));
  if (entries[entries.length - 1] === positionKey(position)) {
    entries.pop();
  }
  return entries.map(hashPositionKey).filter((entry) => entry !== null);
}

function createSearchContext(state, position, settings) {
  const previous = previousPositions(position, settings.history);
  const size = previous.length + MAX_PLY + 2;
  const context = {
    state,
    table: resetTable(),
    moves: new Int32Array(MAX_PLY * MAX_MOVES),
    orders: new Int32Array(MAX_PLY * MAX_MOVES),
    killers: new Int32Array(MAX_PLY * 2),
    history: new Int32Array(1 << 14),
    keys: new Int32Array(size),
    locks: new Int32Array(size),
    clocks: new Int32Array(MAX_PLY + 1),
    boundaries: new Int32Array(MAX_PLY + 1),
    rootIndex: previous.length,
    nodes: 0,
    stopped: false,
    canStop: true,
    startTime: settings.startTime,
    deadline: settings.startTime + settings.timeLimitMs,
    timeLimitMs: settings.timeLimitMs,
    maxDepth: settings.maxDepth,
    random: settings.random,
    noise: settings.noise,
    noiseSeed: 0,
    pruning: settings.pruning,
  };

  previous.forEach(({ key, lock }, index) => {
    context.keys[index] = key;
    context.locks[index] = lock;
  });
  context.keys[context.rootIndex] = state.key;
  context.locks[context.rootIndex] = state.lock;
  context.clocks[0] = position.halfmoveClock;
  return context;
}

function isOutOfTime(context) {
  context.nodes += 1;
  if (
    context.canStop &&
    !context.stopped &&
    (context.nodes & 1023) === 0 &&
    currentTime() >= context.deadline
  ) {
    context.stopped = true;
  }
  return context.stopped;
}

function evaluationNoise(key, seed, amplitude) {
  let hash = Math.imul(key ^ seed, 0x9e3779b1);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x85ebca77);
  hash ^= hash >>> 13;
  return ((hash >>> 0) % (2 * amplitude + 1)) - amplitude;
}

function phaseBalance(counts) {
  const phase =
    2 * (counts[CHARIOT] + counts[CHARIOT | BLACK_BIT]) +
    counts[HORSE] +
    counts[HORSE | BLACK_BIT] +
    counts[CANNON] +
    counts[CANNON | BLACK_BIT];
  const weight = Math.max(0, 12 - phase) * 2;
  return (
    weight *
    (counts[HORSE] - counts[HORSE | BLACK_BIT] - counts[CANNON] + counts[CANNON | BLACK_BIT])
  );
}

function evaluate(context) {
  const { state } = context;
  const { counts } = state;
  const redForces = countForces(counts, 0);
  const blackForces = countForces(counts, BLACK_BIT);
  if (redForces + blackForces === 0) {
    return 0;
  }

  let score = state.score + phaseBalance(counts);
  if (redForces === 0) {
    score = Math.min(score, 0);
  }
  if (blackForces === 0) {
    score = Math.max(score, 0);
  }

  const relative = state.side === 0 ? score : -score;
  return context.noise === 0
    ? relative
    : relative + evaluationNoise(state.key, context.noiseSeed, context.noise);
}

function captureOrder(board, move) {
  const victim = board[move & 127];
  return victim === 0
    ? 0
    : PIECE_VALUES[victim & 7] * 8 - ATTACKER_RANKS[board[move >> 7] & 7];
}

function orderMoves(context, start, end, tableMove, ply) {
  const { moves, orders, killers, history } = context;
  const { board } = context.state;
  const firstKiller = killers[ply * 2];
  const secondKiller = killers[ply * 2 + 1];

  for (let index = start; index < end; index += 1) {
    const move = moves[index];
    if (move === tableMove) {
      orders[index] = TABLE_MOVE_ORDER;
    } else if (board[move & 127] !== 0) {
      orders[index] = CAPTURE_ORDER + captureOrder(board, move);
    } else if (move === firstKiller) {
      orders[index] = CAPTURE_ORDER - 1;
    } else if (move === secondKiller) {
      orders[index] = CAPTURE_ORDER - 2;
    } else {
      orders[index] = history[move];
    }
  }
}

function selectMove(context, index, end) {
  const { moves, orders } = context;
  let best = index;
  for (let candidate = index + 1; candidate < end; candidate += 1) {
    if (orders[candidate] > orders[best]) {
      best = candidate;
    }
  }
  if (best !== index) {
    const move = moves[best];
    const order = orders[best];
    moves[best] = moves[index];
    orders[best] = orders[index];
    moves[index] = move;
    orders[index] = order;
  }
  return moves[index];
}

function rememberCutoff(context, move, depth, ply) {
  const { killers, history } = context;
  if (killers[ply * 2] !== move) {
    killers[ply * 2 + 1] = killers[ply * 2];
    killers[ply * 2] = move;
  }

  history[move] += depth * depth;
  if (history[move] > HISTORY_LIMIT) {
    for (let index = 0; index < history.length; index += 1) {
      history[index] >>= 1;
    }
  }
}

function makeSearchMove(context, move, ply) {
  const { state } = context;
  const captured = makeMove(state, move);
  const index = context.rootIndex + ply + 1;
  context.keys[index] = state.key;
  context.locks[index] = state.lock;
  context.clocks[ply + 1] = captured === 0 ? context.clocks[ply] + 1 : 0;
  context.boundaries[ply + 1] = captured === 0 ? context.boundaries[ply] : index;
  return captured;
}

function toggleNullMove(context, ply) {
  const { state } = context;
  state.side ^= 1;
  state.key ^= SIDE_KEY;
  state.lock ^= SIDE_LOCK;
  const index = context.rootIndex + ply + 1;
  context.keys[index] = state.key;
  context.locks[index] = state.lock;
  context.clocks[ply + 1] = context.clocks[ply];
  context.boundaries[ply + 1] = index;
}

function isRepetition(context, ply) {
  const index = context.rootIndex + ply;
  const key = context.keys[index];
  const lock = context.locks[index];
  for (let earlier = index - 4; earlier >= context.boundaries[ply]; earlier -= 2) {
    if (context.keys[earlier] === key && context.locks[earlier] === lock) {
      return true;
    }
  }
  return false;
}

function canPassTurn(state) {
  const offset = state.side << 3;
  const { counts } = state;
  return counts[offset | CHARIOT] > 0 || counts[offset | HORSE] + counts[offset | CANNON] > 1;
}

function toTableScore(score, ply) {
  if (score > MATE_BOUND) {
    return score + ply;
  }
  return score < -MATE_BOUND ? score - ply : score;
}

function fromTableScore(score, ply) {
  if (score > MATE_BOUND) {
    return score - ply;
  }
  return score < -MATE_BOUND ? score + ply : score;
}

function storeEntry(table, state, depth, score, flag, move) {
  const slot = state.key & TABLE_MASK;
  if (table.flags[slot] !== 0 && table.keys[slot] === state.key && table.depths[slot] > depth) {
    return;
  }
  table.keys[slot] = state.key;
  table.locks[slot] = state.lock;
  table.depths[slot] = depth;
  table.scores[slot] = score;
  table.flags[slot] = flag;
  table.moves[slot] = move;
}

function lateMoveReduction(context, depth, legal, captured, inCheck, move, ply) {
  if (!context.pruning || depth < 3 || legal <= 3 || captured !== 0 || inCheck) {
    return 0;
  }
  if (move === context.killers[ply * 2] || move === context.killers[ply * 2 + 1]) {
    return 0;
  }
  if (isSideInCheck(context.state, context.state.side)) {
    return 0;
  }
  return legal > 10 && depth >= 5 ? 2 : 1;
}

function quiesce(context, alpha, beta, ply) {
  const { state } = context;
  if (isOutOfTime(context)) {
    return 0;
  }
  if (ply >= MAX_PLY - 1) {
    return evaluate(context);
  }

  const inCheck = isSideInCheck(state, state.side);
  let best = -MATE_SCORE + ply;
  let low = alpha;
  if (!inCheck) {
    best = evaluate(context);
    if (best >= beta) {
      return best;
    }
    low = Math.max(low, best);
  }

  const start = ply * MAX_MOVES;
  const end = generateMoves(state, context.moves, start, !inCheck);
  orderMoves(context, start, end, 0, ply);
  for (let index = start; index < end; index += 1) {
    const move = selectMove(context, index, end);
    const captured = makeMove(state, move);
    if (!isLegalAfterMake(state)) {
      unmakeMove(state, move, captured);
      continue;
    }

    const score = -quiesce(context, -beta, -low, ply + 1);
    unmakeMove(state, move, captured);
    if (context.stopped) {
      return 0;
    }
    if (score > best) {
      best = score;
      if (score > low) {
        low = score;
        if (low >= beta) {
          break;
        }
      }
    }
  }

  return best;
}

function searchNode(context, depth, alpha, beta, ply, allowNull) {
  const { state, table } = context;
  if (isRepetition(context, ply) || context.clocks[ply] >= MOVE_LIMIT) {
    return 0;
  }
  if (isOutOfTime(context)) {
    return 0;
  }

  let low = Math.max(alpha, -MATE_SCORE + ply);
  const high = Math.min(beta, MATE_SCORE - ply - 1);
  if (low >= high) {
    return low;
  }

  const inCheck = isSideInCheck(state, state.side);
  const remaining = inCheck ? depth + 1 : depth;
  if (remaining <= 0 || ply >= MAX_PLY - 1) {
    return quiesce(context, low, high, ply);
  }

  const slot = state.key & TABLE_MASK;
  const hit =
    table.flags[slot] !== 0 && table.keys[slot] === state.key && table.locks[slot] === state.lock;
  const tableMove = hit ? table.moves[slot] : 0;
  if (hit && table.depths[slot] >= remaining) {
    const score = fromTableScore(table.scores[slot], ply);
    const flag = table.flags[slot];
    if (flag === EXACT || (flag === LOWER ? score >= high : score <= low)) {
      return score;
    }
  }

  if (
    context.pruning &&
    allowNull &&
    !inCheck &&
    remaining >= 3 &&
    high < MATE_BOUND &&
    canPassTurn(state) &&
    evaluate(context) >= high
  ) {
    toggleNullMove(context, ply);
    const score = -searchNode(
      context,
      remaining - (remaining >= 6 ? 4 : 3),
      -high,
      -high + 1,
      ply + 1,
      false,
    );
    toggleNullMove(context, ply);
    if (context.stopped) {
      return 0;
    }
    if (score >= high) {
      return score >= MATE_BOUND ? high : score;
    }
  }

  const start = ply * MAX_MOVES;
  const end = generateMoves(state, context.moves, start, false);
  orderMoves(context, start, end, tableMove, ply);
  const originalLow = low;
  let best = -INFINITE_SCORE;
  let bestMove = 0;
  let legal = 0;

  for (let index = start; index < end; index += 1) {
    const move = selectMove(context, index, end);
    const captured = makeSearchMove(context, move, ply);
    if (!isLegalAfterMake(state)) {
      unmakeMove(state, move, captured);
      continue;
    }

    legal += 1;
    let score;
    if (legal === 1) {
      score = -searchNode(context, remaining - 1, -high, -low, ply + 1, true);
    } else {
      const reduction = lateMoveReduction(context, remaining, legal, captured, inCheck, move, ply);
      score = -searchNode(context, remaining - 1 - reduction, -low - 1, -low, ply + 1, true);
      if (score > low && reduction > 0 && !context.stopped) {
        score = -searchNode(context, remaining - 1, -low - 1, -low, ply + 1, true);
      }
      if (score > low && score < high && !context.stopped) {
        score = -searchNode(context, remaining - 1, -high, -low, ply + 1, true);
      }
    }
    unmakeMove(state, move, captured);
    if (context.stopped) {
      return 0;
    }

    if (score > best) {
      best = score;
      bestMove = move;
      if (score > low) {
        low = score;
        if (low >= high) {
          if (captured === 0) {
            rememberCutoff(context, move, remaining, ply);
          }
          break;
        }
      }
    }
  }

  // 象棋中无子可走（困毙）与被将死同样判负。
  if (legal === 0) {
    return -MATE_SCORE + ply;
  }

  const flag = best >= high ? LOWER : best > originalLow ? EXACT : UPPER;
  storeEntry(table, state, remaining, toTableScore(best, ply), flag, bestMove);
  return best;
}

function searchRoot(context, rootMoves, depth) {
  let alpha = -INFINITE_SCORE;
  let bestMove = rootMoves[0];

  for (let index = 0; index < rootMoves.length; index += 1) {
    const move = rootMoves[index];
    const captured = makeSearchMove(context, move, 0);
    let score;
    if (index === 0) {
      score = -searchNode(context, depth - 1, -INFINITE_SCORE, -alpha, 1, true);
    } else {
      score = -searchNode(context, depth - 1, -alpha - 1, -alpha, 1, true);
      if (score > alpha && !context.stopped) {
        score = -searchNode(context, depth - 1, -INFINITE_SCORE, -alpha, 1, true);
      }
    }
    unmakeMove(context.state, move, captured);
    if (context.stopped) {
      return null;
    }
    if (score > alpha) {
      alpha = score;
      bestMove = move;
    }
  }

  return { move: bestMove, score: alpha };
}

function shuffleMoves(moves, random) {
  for (let index = moves.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [moves[index], moves[swap]] = [moves[swap], moves[index]];
  }
}

function chooseSearchedMove(context, rootMoves) {
  const { board } = context.state;
  shuffleMoves(rootMoves, context.random);
  context.noiseSeed = Math.floor(context.random() * 0x7fffffff);
  rootMoves.sort((left, right) => captureOrder(board, right) - captureOrder(board, left));

  let bestMove = rootMoves[0];
  for (let depth = 1; depth <= context.maxDepth; depth += 1) {
    context.canStop = depth > 1;
    const result = searchRoot(context, rootMoves, depth);
    if (result === null) {
      break;
    }

    bestMove = result.move;
    rootMoves.splice(rootMoves.indexOf(bestMove), 1);
    rootMoves.unshift(bestMove);
    if (
      Math.abs(result.score) >= MATE_BOUND ||
      currentTime() - context.startTime >= context.timeLimitMs * SOFT_TIME_RATIO
    ) {
      break;
    }
  }

  return bestMove;
}

function allowsMateInOne(context) {
  const { state, moves } = context;
  const end = generateMoves(state, moves, MAX_MOVES, false);

  for (let index = MAX_MOVES; index < end; index += 1) {
    const captured = makeMove(state, moves[index]);
    const mates = isLegalAfterMake(state) && !hasLegalMove(state, moves, 2 * MAX_MOVES);
    unmakeMove(state, moves[index], captured);
    if (mates) {
      return true;
    }
  }

  return false;
}

function gentleScore(context, careful, watchesMate) {
  const { state } = context;
  if (!hasLegalMove(state, context.moves, MAX_MOVES)) {
    return MATE_SCORE;
  }
  if (watchesMate && allowsMateInOne(context)) {
    return -MATE_SCORE;
  }
  if (!careful || context.stopped) {
    return -evaluate(context);
  }

  const score = -quiesce(context, -INFINITE_SCORE, INFINITE_SCORE, 1);
  return context.stopped ? -evaluate(context) : score;
}

function chooseGentleMove(context, rootMoves) {
  const { random, state } = context;
  const careful = random() >= CARELESS_CHANCE;
  const watchesMate = random() >= MATE_BLINDNESS_CHANCE;
  let bestMove = rootMoves[0];
  let bestScore = -Infinity;

  for (const move of rootMoves) {
    const captured = makeMove(state, move);
    const score = gentleScore(context, careful, watchesMate) + (random() * 2 - 1) * GENTLE_NOISE;
    unmakeMove(state, move, captured);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

export function chooseAiMove(position, options = {}) {
  const startTime = currentTime();
  const state = loadState(position);
  const settings = resolveSettings(options, startTime);
  const rootMoves = legalMoveCodes(state);
  if (rootMoves.length === 0) {
    return null;
  }
  if (rootMoves.length === 1) {
    return describeMove(state.board, rootMoves[0]);
  }

  const context = createSearchContext(state, position, settings);
  const move =
    settings.level === 1
      ? chooseGentleMove(context, rootMoves)
      : chooseSearchedMove(context, rootMoves);
  return describeMove(state.board, move);
}
