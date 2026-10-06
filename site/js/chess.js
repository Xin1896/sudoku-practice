export const WHITE = "w";
export const BLACK = "b";
export const INITIAL_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const FILES = "abcdefgh";
const PIECE_LETTERS = "PNBRQKpnbrqk";
const CASTLING_LETTERS = "KQkq";

const PAWN = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;

const FLAG_DOUBLE_PUSH = 1;
const FLAG_EN_PASSANT = 2;
const FLAG_CASTLE_KING = 3;
const FLAG_CASTLE_QUEEN = 4;

const MAX_MOVES = 512;
const MAX_PLY = 96;
const MAX_SEARCH_DEPTH = 40;
const STACK_SIZE = 512;
const MAX_SEEDED_HISTORY = 150;

const MATE_SCORE = 100000;
const MATE_THRESHOLD = MATE_SCORE - 1000;
const INFINITE_SCORE = 1000000;
const TOTAL_PHASE = 24;

const TABLE_SIZE = 1 << 18;
const TABLE_MASK = TABLE_SIZE - 1;
const BOUND_EXACT = 1;
const BOUND_LOWER = 2;
const BOUND_UPPER = 3;
const NODE_CHECK_MASK = 1023;

const ORDER_TABLE_MOVE = 4000000;
const ORDER_CAPTURE = 2000000;
const ORDER_PROMOTION = 1900000;
const ORDER_FIRST_KILLER = 1000000;
const ORDER_SECOND_KILLER = 990000;
const ORDER_UNDERPROMOTION = -1000000;
const HISTORY_LIMIT = 800000;

const PLAYFUL_NOISE = 80;
const PLAYFUL_BLUNDER_CHANCE = 0.3;
const PLAYFUL_BLUNDER_WINDOW = 350;

const AI_LEVELS = Object.freeze({
  1: Object.freeze({
    maxDepth: 2,
    timeLimitMs: 150,
    rootNoise: 0,
    playful: true,
    nullMove: false,
    reductions: false,
  }),
  2: Object.freeze({
    maxDepth: 3,
    timeLimitMs: 600,
    rootNoise: 30,
    playful: false,
    nullMove: false,
    reductions: false,
  }),
  3: Object.freeze({
    maxDepth: MAX_SEARCH_DEPTH,
    timeLimitMs: 1500,
    rootNoise: 6,
    playful: false,
    nullMove: true,
    reductions: true,
  }),
});

const KNIGHT_OFFSETS = Object.freeze([-33, -31, -18, -14, 14, 18, 31, 33]);
const KING_OFFSETS = Object.freeze([-17, -16, -15, -1, 1, 15, 16, 17]);
const BISHOP_OFFSETS = Object.freeze([-17, -15, 15, 17]);
const ROOK_OFFSETS = Object.freeze([-16, -1, 1, 16]);
const PIECE_OFFSETS = Object.freeze([
  null,
  null,
  KNIGHT_OFFSETS,
  BISHOP_OFFSETS,
  ROOK_OFFSETS,
  KING_OFFSETS,
  KING_OFFSETS,
]);

const LETTER_BY_CODE = Object.freeze([
  null, "P", "N", "B", "R", "Q", "K", null,
  null, "p", "n", "b", "r", "q", "k", null,
]);
const PROMOTION_LETTERS = Object.freeze([null, null, "n", "b", "r", "q", null]);
const SAN_LETTERS = Object.freeze(["", "", "N", "B", "R", "Q", "K"]);
const CASTLE_SIDES = Object.freeze([null, null, null, "K", "Q"]);
const PROMOTION_CHOICES = Object.freeze([QUEEN, ROOK, BISHOP, KNIGHT]);
const QUIESCENCE_PROMOTIONS = Object.freeze([QUEEN]);
const CASTLING_HOMES = Object.freeze({
  K: Object.freeze({ king: 60, rook: 63, kingPiece: "K", rookPiece: "R" }),
  Q: Object.freeze({ king: 60, rook: 56, kingPiece: "K", rookPiece: "R" }),
  k: Object.freeze({ king: 4, rook: 7, kingPiece: "k", rookPiece: "r" }),
  q: Object.freeze({ king: 4, rook: 0, kingPiece: "k", rookPiece: "r" }),
});

const MATERIAL = Object.freeze([0, 100, 320, 330, 500, 900, 0]);
const PHASE_WEIGHTS = Object.freeze([0, 0, 1, 1, 2, 4, 0]);

const PAWN_TABLE = Object.freeze([
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
]);
const PAWN_ENDGAME_TABLE = Object.freeze([
  0, 0, 0, 0, 0, 0, 0, 0,
  80, 80, 80, 80, 80, 80, 80, 80,
  50, 50, 50, 50, 50, 50, 50, 50,
  30, 30, 30, 30, 30, 30, 30, 30,
  15, 15, 15, 15, 15, 15, 15, 15,
  5, 5, 5, 5, 5, 5, 5, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
]);
const KNIGHT_TABLE = Object.freeze([
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
]);
const BISHOP_TABLE = Object.freeze([
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
]);
const ROOK_TABLE = Object.freeze([
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0,
]);
const QUEEN_TABLE = Object.freeze([
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
]);
const KING_TABLE = Object.freeze([
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
]);
const KING_ENDGAME_TABLE = Object.freeze([
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
]);
const MIDDLEGAME_TABLES = Object.freeze([
  null,
  PAWN_TABLE,
  KNIGHT_TABLE,
  BISHOP_TABLE,
  ROOK_TABLE,
  QUEEN_TABLE,
  KING_TABLE,
]);
const ENDGAME_TABLES = Object.freeze([
  null,
  PAWN_ENDGAME_TABLE,
  KNIGHT_TABLE,
  BISHOP_TABLE,
  ROOK_TABLE,
  QUEEN_TABLE,
  KING_ENDGAME_TABLE,
]);

const nextKey = createKeyStream(0x9e3779b9);
const PIECE_KEYS_LOW = createKeys(16 * 128);
const PIECE_KEYS_HIGH = createKeys(16 * 128);
const CASTLING_KEYS_LOW = createKeys(16);
const CASTLING_KEYS_HIGH = createKeys(16);
const EN_PASSANT_KEYS_LOW = createKeys(8);
const EN_PASSANT_KEYS_HIGH = createKeys(8);
const SIDE_KEY_LOW = nextKey();
const SIDE_KEY_HIGH = nextKey();

const MIDDLEGAME_SCORES = createScoreTable(MIDDLEGAME_TABLES);
const ENDGAME_SCORES = createScoreTable(ENDGAME_TABLES);
const PIECE_PHASES = createPhaseTable();
const CASTLING_MASKS = createCastlingMasks();

let searchMemory = null;

function createKeyStream(seed) {
  let state = seed >>> 0;

  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) | 0;
  };
}

function createKeys(length) {
  const keys = new Int32Array(length);
  for (let index = 0; index < length; index += 1) {
    keys[index] = nextKey();
  }
  return keys;
}

function createScoreTable(tables) {
  const scores = new Int32Array(16 * 128);
  for (let type = PAWN; type <= KING; type += 1) {
    for (let index = 0; index < 64; index += 1) {
      const square = toSquare88(index);
      scores[(type << 7) | square] = MATERIAL[type] + tables[type][index];
      scores[((type | 8) << 7) | square] = -(
        MATERIAL[type] + tables[type][index ^ 56]
      );
    }
  }
  return scores;
}

function createPhaseTable() {
  const phases = new Int8Array(16);
  for (let type = PAWN; type <= KING; type += 1) {
    phases[type] = PHASE_WEIGHTS[type];
    phases[type | 8] = PHASE_WEIGHTS[type];
  }
  return phases;
}

function createCastlingMasks() {
  const masks = new Uint8Array(128).fill(15);
  masks[0x74] = 12;
  masks[0x77] = 14;
  masks[0x70] = 13;
  masks[0x04] = 3;
  masks[0x07] = 11;
  masks[0x00] = 7;
  return masks;
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

// 0x88 layout: square = row * 16 + file, row 0 is rank 8 (public index 0 = a8).
function toSquare88(index) {
  return ((index >> 3) << 4) | (index & 7);
}

function toIndex64(square) {
  return ((square >> 4) << 3) | (square & 7);
}

function squareName88(square) {
  return `${FILES[square & 7]}${8 - (square >> 4)}`;
}

function isSquareIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < 64;
}

function pieceCode(letter) {
  const index =
    typeof letter === "string" && letter.length === 1
      ? PIECE_LETTERS.indexOf(letter)
      : -1;
  if (index < 0) {
    return 0;
  }
  return index < 6 ? index + 1 : index + 3;
}

function castlingBits(text) {
  let bits = 0;
  for (const letter of text) {
    const bit = CASTLING_LETTERS.indexOf(letter);
    if (bit >= 0) {
      bits |= 1 << bit;
    }
  }
  return bits;
}

function castlingText(bits) {
  return [...CASTLING_LETTERS]
    .filter((_, bit) => (bits & (1 << bit)) !== 0)
    .join("");
}

// Move bits: from 0–6, to 7–13, promotion type 14–16, flag 17–19,
// captured piece 20–23, moving piece 24–27.
function encodeMove(from, to, piece, captured, promotion, flag) {
  return (
    from |
    (to << 7) |
    (promotion << 14) |
    (flag << 17) |
    (captured << 20) |
    (piece << 24)
  );
}

function isQuietMove(move) {
  return (move & 0xf1c000) === 0;
}

function createBoard() {
  return {
    squares: new Int8Array(128),
    kings: new Int32Array(2),
    counts: new Int8Array(16),
    side: 0,
    castling: 0,
    enPassant: -1,
    enPassantHashed: 0,
    halfmove: 0,
    fullmove: 1,
    hashLow: 0,
    hashHigh: 0,
    middlegame: 0,
    endgame: 0,
    phase: 0,
    stackSize: 0,
    savedCastling: new Int8Array(STACK_SIZE),
    savedEnPassant: new Int16Array(STACK_SIZE),
    savedEnPassantHashed: new Int8Array(STACK_SIZE),
    savedHalfmove: new Int32Array(STACK_SIZE),
    savedHashLow: new Int32Array(STACK_SIZE),
    savedHashHigh: new Int32Array(STACK_SIZE),
    savedMiddlegame: new Int32Array(STACK_SIZE),
    savedEndgame: new Int32Array(STACK_SIZE),
    savedPhase: new Int16Array(STACK_SIZE),
    historyLength: 0,
    historyLow: new Int32Array(STACK_SIZE),
    historyHigh: new Int32Array(STACK_SIZE),
  };
}

function addPiece(board, square, piece) {
  const key = (piece << 7) | square;
  board.squares[square] = piece;
  board.hashLow ^= PIECE_KEYS_LOW[key];
  board.hashHigh ^= PIECE_KEYS_HIGH[key];
  board.middlegame += MIDDLEGAME_SCORES[key];
  board.endgame += ENDGAME_SCORES[key];
  board.phase += PIECE_PHASES[piece];
  board.counts[piece] += 1;
}

function removePiece(board, square, piece) {
  const key = (piece << 7) | square;
  board.squares[square] = 0;
  board.hashLow ^= PIECE_KEYS_LOW[key];
  board.hashHigh ^= PIECE_KEYS_HIGH[key];
  board.middlegame -= MIDDLEGAME_SCORES[key];
  board.endgame -= ENDGAME_SCORES[key];
  board.phase -= PIECE_PHASES[piece];
  board.counts[piece] -= 1;
}

function toggleCastlingKey(board) {
  board.hashLow ^= CASTLING_KEYS_LOW[board.castling];
  board.hashHigh ^= CASTLING_KEYS_HIGH[board.castling];
}

function toggleSideKey(board) {
  board.hashLow ^= SIDE_KEY_LOW;
  board.hashHigh ^= SIDE_KEY_HIGH;
}

function clearEnPassant(board) {
  if (board.enPassantHashed) {
    board.hashLow ^= EN_PASSANT_KEYS_LOW[board.enPassant & 7];
    board.hashHigh ^= EN_PASSANT_KEYS_HIGH[board.enPassant & 7];
  }
  board.enPassant = -1;
  board.enPassantHashed = 0;
}

// The target square is kept after every double push (FEN style), but it only
// enters the hash when an enemy pawn stands beside the pushed pawn.
function setEnPassant(board, target, pawnSquare, mover) {
  const capturer = PAWN | ((mover ^ 1) << 3);
  const left = pawnSquare - 1;
  const right = pawnSquare + 1;
  board.enPassant = target;
  if (
    (!(left & 0x88) && board.squares[left] === capturer) ||
    (!(right & 0x88) && board.squares[right] === capturer)
  ) {
    board.enPassantHashed = 1;
    board.hashLow ^= EN_PASSANT_KEYS_LOW[target & 7];
    board.hashHigh ^= EN_PASSANT_KEYS_HIGH[target & 7];
  }
}

function saveState(board) {
  const depth = board.stackSize;
  board.savedCastling[depth] = board.castling;
  board.savedEnPassant[depth] = board.enPassant;
  board.savedEnPassantHashed[depth] = board.enPassantHashed;
  board.savedHalfmove[depth] = board.halfmove;
  board.savedHashLow[depth] = board.hashLow;
  board.savedHashHigh[depth] = board.hashHigh;
  board.savedMiddlegame[depth] = board.middlegame;
  board.savedEndgame[depth] = board.endgame;
  board.savedPhase[depth] = board.phase;
  board.stackSize = depth + 1;
  board.historyLow[board.historyLength] = board.hashLow;
  board.historyHigh[board.historyLength] = board.hashHigh;
  board.historyLength += 1;
}

function restoreState(board) {
  const depth = board.stackSize - 1;
  board.stackSize = depth;
  board.castling = board.savedCastling[depth];
  board.enPassant = board.savedEnPassant[depth];
  board.enPassantHashed = board.savedEnPassantHashed[depth];
  board.halfmove = board.savedHalfmove[depth];
  board.hashLow = board.savedHashLow[depth];
  board.hashHigh = board.savedHashHigh[depth];
  board.middlegame = board.savedMiddlegame[depth];
  board.endgame = board.savedEndgame[depth];
  board.phase = board.savedPhase[depth];
  board.historyLength -= 1;
}

function makeMove(board, move) {
  const from = move & 127;
  const to = (move >> 7) & 127;
  const promotion = (move >> 14) & 7;
  const flag = (move >> 17) & 7;
  const captured = (move >> 20) & 15;
  const piece = (move >> 24) & 15;
  const side = board.side;
  const color = side << 3;

  saveState(board);
  clearEnPassant(board);
  toggleCastlingKey(board);
  if (flag === FLAG_EN_PASSANT) {
    removePiece(board, side === 0 ? to + 16 : to - 16, captured);
  } else if (captured !== 0) {
    removePiece(board, to, captured);
  }
  removePiece(board, from, piece);
  addPiece(board, to, promotion === 0 ? piece : promotion | color);
  if (flag === FLAG_CASTLE_KING) {
    removePiece(board, to + 1, ROOK | color);
    addPiece(board, to - 1, ROOK | color);
  } else if (flag === FLAG_CASTLE_QUEEN) {
    removePiece(board, to - 2, ROOK | color);
    addPiece(board, to + 1, ROOK | color);
  }
  if ((piece & 7) === KING) {
    board.kings[side] = to;
  }
  board.castling &= CASTLING_MASKS[from] & CASTLING_MASKS[to];
  toggleCastlingKey(board);
  if (flag === FLAG_DOUBLE_PUSH) {
    setEnPassant(board, (from + to) >> 1, to, side);
  }
  board.halfmove =
    (piece & 7) === PAWN || captured !== 0 ? 0 : board.halfmove + 1;
  if (side === 1) {
    board.fullmove += 1;
  }
  board.side = side ^ 1;
  toggleSideKey(board);
}

function unmakeMove(board, move) {
  const from = move & 127;
  const to = (move >> 7) & 127;
  const promotion = (move >> 14) & 7;
  const flag = (move >> 17) & 7;
  const captured = (move >> 20) & 15;
  const piece = (move >> 24) & 15;
  const side = board.side ^ 1;
  const color = side << 3;
  const { squares, counts } = board;

  board.side = side;
  if (side === 1) {
    board.fullmove -= 1;
  }
  squares[from] = piece;
  if (promotion !== 0) {
    counts[promotion | color] -= 1;
    counts[piece] += 1;
  }
  if (flag === FLAG_EN_PASSANT) {
    squares[to] = 0;
    squares[side === 0 ? to + 16 : to - 16] = captured;
  } else {
    squares[to] = captured;
  }
  if (captured !== 0) {
    counts[captured] += 1;
  }
  if (flag === FLAG_CASTLE_KING) {
    squares[to - 1] = 0;
    squares[to + 1] = ROOK | color;
  } else if (flag === FLAG_CASTLE_QUEEN) {
    squares[to + 1] = 0;
    squares[to - 2] = ROOK | color;
  }
  if ((piece & 7) === KING) {
    board.kings[side] = from;
  }
  restoreState(board);
}

function makeNullMove(board) {
  saveState(board);
  clearEnPassant(board);
  board.halfmove = 0;
  board.side ^= 1;
  toggleSideKey(board);
}

function unmakeNullMove(board) {
  board.side ^= 1;
  restoreState(board);
}

function isAttacked(board, square, by) {
  const { squares } = board;
  const color = by << 3;
  const pawn = PAWN | color;
  const pawnRow = by === 0 ? square + 16 : square - 16;

  let from = pawnRow - 1;
  if (!(from & 0x88) && squares[from] === pawn) {
    return true;
  }
  from = pawnRow + 1;
  if (!(from & 0x88) && squares[from] === pawn) {
    return true;
  }

  const knight = KNIGHT | color;
  for (let index = 0; index < 8; index += 1) {
    from = square + KNIGHT_OFFSETS[index];
    if (!(from & 0x88) && squares[from] === knight) {
      return true;
    }
  }

  const king = KING | color;
  for (let index = 0; index < 8; index += 1) {
    from = square + KING_OFFSETS[index];
    if (!(from & 0x88) && squares[from] === king) {
      return true;
    }
  }

  const queen = QUEEN | color;
  return (
    isSlidingAttack(squares, square, BISHOP_OFFSETS, BISHOP | color, queen) ||
    isSlidingAttack(squares, square, ROOK_OFFSETS, ROOK | color, queen)
  );
}

function isSlidingAttack(squares, square, offsets, slider, queen) {
  for (let index = 0; index < 4; index += 1) {
    const offset = offsets[index];
    let from = square + offset;
    while (!(from & 0x88)) {
      const piece = squares[from];
      if (piece !== 0) {
        if (piece === slider || piece === queen) {
          return true;
        }
        break;
      }
      from += offset;
    }
  }
  return false;
}

function isSideInCheck(board, side) {
  return isAttacked(board, board.kings[side], side ^ 1);
}

function generateMoves(board, list, start, capturesOnly) {
  const { squares, side } = board;
  let count = start;

  for (let from = 0; from < 128; from += 1) {
    if (from & 0x88) {
      from += 7;
      continue;
    }
    const piece = squares[from];
    if (piece === 0 || piece >> 3 !== side) {
      continue;
    }

    const type = piece & 7;
    if (type === PAWN) {
      count = addPawnMoves(board, list, count, from, piece, capturesOnly);
    } else if (type === KNIGHT || type === KING) {
      count = addStepMoves(squares, list, count, from, piece, capturesOnly);
    } else {
      count = addSlidingMoves(squares, list, count, from, piece, capturesOnly);
    }
  }

  return capturesOnly ? count : addCastlingMoves(board, list, count);
}

function addStepMoves(squares, list, start, from, piece, capturesOnly) {
  const offsets = PIECE_OFFSETS[piece & 7];
  const side = piece >> 3;
  let count = start;
  for (let index = 0; index < 8; index += 1) {
    const to = from + offsets[index];
    if (to & 0x88) {
      continue;
    }
    const target = squares[to];
    if (target === 0) {
      if (!capturesOnly) {
        list[count] = encodeMove(from, to, piece, 0, 0, 0);
        count += 1;
      }
    } else if (target >> 3 !== side) {
      list[count] = encodeMove(from, to, piece, target, 0, 0);
      count += 1;
    }
  }
  return count;
}

function addSlidingMoves(squares, list, start, from, piece, capturesOnly) {
  const offsets = PIECE_OFFSETS[piece & 7];
  const side = piece >> 3;
  let count = start;
  for (let index = 0; index < offsets.length; index += 1) {
    const offset = offsets[index];
    let to = from + offset;
    while (!(to & 0x88)) {
      const target = squares[to];
      if (target === 0) {
        if (!capturesOnly) {
          list[count] = encodeMove(from, to, piece, 0, 0, 0);
          count += 1;
        }
      } else {
        if (target >> 3 !== side) {
          list[count] = encodeMove(from, to, piece, target, 0, 0);
          count += 1;
        }
        break;
      }
      to += offset;
    }
  }
  return count;
}

function addPawnMoves(board, list, start, from, piece, capturesOnly) {
  const { squares } = board;
  const side = piece >> 3;
  const forward = side === 0 ? -16 : 16;
  const promotionRow = side === 0 ? 0 : 7;
  const startRow = side === 0 ? 6 : 1;
  const ahead = from + forward;
  let count = start;

  if (!(ahead & 0x88) && squares[ahead] === 0) {
    if (ahead >> 4 === promotionRow) {
      count = addPromotions(list, count, from, ahead, piece, 0, capturesOnly);
    } else if (!capturesOnly) {
      list[count] = encodeMove(from, ahead, piece, 0, 0, 0);
      count += 1;
      const twoAhead = ahead + forward;
      if (from >> 4 === startRow && squares[twoAhead] === 0) {
        list[count] = encodeMove(from, twoAhead, piece, 0, 0, FLAG_DOUBLE_PUSH);
        count += 1;
      }
    }
  }

  for (let delta = -1; delta <= 1; delta += 2) {
    const to = ahead + delta;
    if (to & 0x88) {
      continue;
    }
    const target = squares[to];
    if (target !== 0) {
      if (target >> 3 === side) {
        continue;
      }
      if (to >> 4 === promotionRow) {
        count = addPromotions(
          list,
          count,
          from,
          to,
          piece,
          target,
          capturesOnly,
        );
      } else {
        list[count] = encodeMove(from, to, piece, target, 0, 0);
        count += 1;
      }
    } else if (to === board.enPassant) {
      const victim = PAWN | ((side ^ 1) << 3);
      if (squares[to - forward] === victim) {
        list[count] = encodeMove(from, to, piece, victim, 0, FLAG_EN_PASSANT);
        count += 1;
      }
    }
  }

  return count;
}

function addPromotions(list, start, from, to, piece, captured, capturesOnly) {
  const types = capturesOnly ? QUIESCENCE_PROMOTIONS : PROMOTION_CHOICES;
  let count = start;
  for (const type of types) {
    list[count] = encodeMove(from, to, piece, captured, type, 0);
    count += 1;
  }
  return count;
}

function addCastlingMoves(board, list, start) {
  const { squares, side } = board;
  const rights = side === 0 ? board.castling & 3 : (board.castling >> 2) & 3;
  if (rights === 0) {
    return start;
  }

  const home = side === 0 ? 0x70 : 0x00;
  const kingSquare = home + 4;
  const king = KING | (side << 3);
  const rook = ROOK | (side << 3);
  const enemy = side ^ 1;
  if (squares[kingSquare] !== king || isAttacked(board, kingSquare, enemy)) {
    return start;
  }

  let count = start;
  if (
    (rights & 1) !== 0 &&
    squares[home + 7] === rook &&
    squares[home + 5] === 0 &&
    squares[home + 6] === 0 &&
    !isAttacked(board, home + 5, enemy) &&
    !isAttacked(board, home + 6, enemy)
  ) {
    list[count] = encodeMove(
      kingSquare,
      home + 6,
      king,
      0,
      0,
      FLAG_CASTLE_KING,
    );
    count += 1;
  }
  if (
    (rights & 2) !== 0 &&
    squares[home] === rook &&
    squares[home + 1] === 0 &&
    squares[home + 2] === 0 &&
    squares[home + 3] === 0 &&
    !isAttacked(board, home + 3, enemy) &&
    !isAttacked(board, home + 2, enemy)
  ) {
    list[count] = encodeMove(
      kingSquare,
      home + 2,
      king,
      0,
      0,
      FLAG_CASTLE_QUEEN,
    );
    count += 1;
  }
  return count;
}

function isLegalAfter(board, move, side) {
  makeMove(board, move);
  const legal = !isSideInCheck(board, side);
  unmakeMove(board, move);
  return legal;
}

function collectLegalMoves(board) {
  const list = new Int32Array(MAX_MOVES);
  const count = generateMoves(board, list, 0, false);
  const side = board.side;
  const legal = [];
  for (let index = 0; index < count; index += 1) {
    if (isLegalAfter(board, list[index], side)) {
      legal.push(list[index]);
    }
  }
  return legal;
}

function hasLegalMove(board, list, start) {
  const end = generateMoves(board, list, start, false);
  const side = board.side;
  for (let index = start; index < end; index += 1) {
    if (isLegalAfter(board, list[index], side)) {
      return true;
    }
  }
  return false;
}

function hasLegalEnPassant(board) {
  if (board.enPassant < 0) {
    return false;
  }
  const list = new Int32Array(MAX_MOVES);
  const count = generateMoves(board, list, 0, true);
  for (let index = 0; index < count; index += 1) {
    const move = list[index];
    if (
      ((move >> 17) & 7) === FLAG_EN_PASSANT &&
      isLegalAfter(board, move, board.side)
    ) {
      return true;
    }
  }
  return false;
}

function isRepetition(board) {
  const first = Math.max(0, board.historyLength - board.halfmove);
  for (let index = board.historyLength - 2; index >= first; index -= 2) {
    if (
      board.historyLow[index] === board.hashLow &&
      board.historyHigh[index] === board.hashHigh
    ) {
      return true;
    }
  }
  return false;
}

function isDeadPosition(board) {
  const { counts } = board;
  if (
    counts[PAWN] + counts[PAWN | 8] + counts[ROOK] + counts[ROOK | 8] > 0 ||
    counts[QUEEN] + counts[QUEEN | 8] > 0
  ) {
    return false;
  }
  const knights = counts[KNIGHT] + counts[KNIGHT | 8];
  const bishops = counts[BISHOP] + counts[BISHOP | 8];
  if (knights + bishops <= 1) {
    return true;
  }
  return knights === 0 && bishopsShareColour(board.squares);
}

function bishopsShareColour(squares) {
  let colours = 0;
  for (let square = 0; square < 128; square += 1) {
    if (square & 0x88) {
      square += 7;
      continue;
    }
    if ((squares[square] & 7) === BISHOP) {
      colours |= 1 << (((square >> 4) + square) & 1);
    }
  }
  return colours !== 3;
}

function assertPosition(position) {
  if (position === null || typeof position !== "object") {
    throw new TypeError("局面必须是对象");
  }
  const { board, turn, castling, halfmoveClock, fullmoveNumber } = position;
  const enPassant = position.enPassant ?? null;
  if (!Array.isArray(board) || board.length !== 64) {
    throw new TypeError("棋盘必须是包含 64 个格子的数组");
  }
  for (let index = 0; index < 64; index += 1) {
    if (board[index] !== null && pieceCode(board[index]) === 0) {
      throw new TypeError("棋盘包含无效的棋子");
    }
  }
  if (turn !== WHITE && turn !== BLACK) {
    throw new TypeError("行棋方必须是 w 或 b");
  }
  if (typeof castling !== "string" || !/^K?Q?k?q?$/.test(castling)) {
    throw new TypeError("易位权必须是 KQkq 的有序子集");
  }
  if (
    enPassant !== null &&
    !(isSquareIndex(enPassant) && enPassant >> 3 === (turn === WHITE ? 2 : 5))
  ) {
    throw new TypeError("吃过路兵目标格无效");
  }
  if (!Number.isInteger(halfmoveClock) || halfmoveClock < 0) {
    throw new TypeError("半回合计数必须是非负整数");
  }
  if (!Number.isInteger(fullmoveNumber) || fullmoveNumber < 1) {
    throw new TypeError("回合数必须是正整数");
  }
}

function loadPosition(position) {
  assertPosition(position);
  const board = createBoard();
  for (let index = 0; index < 64; index += 1) {
    const piece = pieceCode(position.board[index]);
    if (piece === 0) {
      continue;
    }
    const square = toSquare88(index);
    addPiece(board, square, piece);
    if ((piece & 7) === KING) {
      board.kings[piece >> 3] = square;
    }
  }
  if (board.counts[KING] !== 1 || board.counts[KING | 8] !== 1) {
    throw new Error("双方必须各有且只有一个王");
  }

  board.side = position.turn === WHITE ? 0 : 1;
  board.castling = castlingBits(position.castling);
  board.halfmove = position.halfmoveClock;
  board.fullmove = position.fullmoveNumber;
  toggleCastlingKey(board);
  if (board.side === 1) {
    toggleSideKey(board);
  }
  const enPassant = position.enPassant ?? null;
  if (enPassant !== null) {
    const target = toSquare88(enPassant);
    const mover = board.side ^ 1;
    setEnPassant(board, target, mover === 0 ? target - 16 : target + 16, mover);
  }
  return board;
}

function exportPosition(board) {
  return {
    board: Array.from(
      { length: 64 },
      (_, index) => LETTER_BY_CODE[board.squares[toSquare88(index)]],
    ),
    turn: board.side === 0 ? WHITE : BLACK,
    castling: castlingText(board.castling),
    enPassant: board.enPassant < 0 ? null : toIndex64(board.enPassant),
    halfmoveClock: board.halfmove,
    fullmoveNumber: board.fullmove,
  };
}

function toMoveObject(move) {
  return {
    from: toIndex64(move & 127),
    to: toIndex64((move >> 7) & 127),
    piece: LETTER_BY_CODE[(move >> 24) & 15],
    captured: LETTER_BY_CODE[(move >> 20) & 15],
    promotion: PROMOTION_LETTERS[(move >> 14) & 7],
    castle: CASTLE_SIDES[(move >> 17) & 7],
    enPassant: ((move >> 17) & 7) === FLAG_EN_PASSANT,
  };
}

function resolveMove(legalMoves, move) {
  if (move === null || typeof move !== "object") {
    throw new TypeError("走法必须是包含 from 和 to 的对象");
  }
  const { from, to } = move;
  if (!isSquareIndex(from) || !isSquareIndex(to)) {
    throw new RangeError("走法的起点和终点必须是 0–63 的格子索引");
  }
  const origin = toSquare88(from);
  const target = toSquare88(to);
  const candidates = legalMoves.filter(
    (candidate) =>
      (candidate & 127) === origin && ((candidate >> 7) & 127) === target,
  );
  if (candidates.length === 0) {
    throw new Error(`非法走法：${squareName(from)}-${squareName(to)}`);
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  const letter = move.promotion ?? "q";
  const promotion =
    typeof letter === "string"
      ? PROMOTION_LETTERS.indexOf(letter.toLowerCase())
      : -1;
  const match = candidates.find(
    (candidate) => ((candidate >> 14) & 7) === promotion,
  );
  if (match === undefined) {
    throw new Error("升变棋子必须是 q、r、b 或 n");
  }
  return match;
}

function placementText(board) {
  const rows = [];
  for (let row = 0; row < 8; row += 1) {
    let text = "";
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const piece = board[row * 8 + file];
      if (piece === null) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        text += empty;
        empty = 0;
      }
      text += piece;
    }
    rows.push(empty > 0 ? `${text}${empty}` : text);
  }
  return rows.join("/");
}

function keyFor(board, position) {
  const placement = placementText(position.board);
  const castling = position.castling || "-";
  const enPassant = hasLegalEnPassant(board)
    ? squareName(position.enPassant)
    : "-";
  return `${placement} ${position.turn} ${castling} ${enPassant}`;
}

function parsePlacement(placement) {
  const rows = placement.split("/");
  if (rows.length !== 8) {
    throw new Error("FEN 棋盘必须有 8 行");
  }
  const board = [];
  rows.forEach((row, rowIndex) => {
    let files = 0;
    for (const char of row) {
      if (char >= "1" && char <= "8") {
        files += Number(char);
        board.push(...Array(Number(char)).fill(null));
      } else if (pieceCode(char) !== 0) {
        files += 1;
        board.push(char);
      } else {
        throw new Error(`FEN 包含未知字符：${char}`);
      }
    }
    if (files !== 8) {
      throw new Error(`FEN 第 ${rowIndex + 1} 行必须正好 8 格`);
    }
  });
  return board;
}

function parseEnPassantField(field, turn) {
  if (field === "-") {
    return null;
  }
  if (!/^[a-h][36]$/.test(field) || field[1] !== (turn === WHITE ? "6" : "3")) {
    throw new Error("FEN 的吃过路兵字段无效");
  }
  return squareIndex(field);
}

function validateSetup(position) {
  const { board, castling, enPassant, turn } = position;
  for (let file = 0; file < 8; file += 1) {
    for (const index of [file, 56 + file]) {
      if (board[index] === "P" || board[index] === "p") {
        throw new Error("兵不能位于第一或第八横排");
      }
    }
  }
  for (const right of castling) {
    const home = CASTLING_HOMES[right];
    if (
      board[home.king] !== home.kingPiece ||
      board[home.rook] !== home.rookPiece
    ) {
      throw new Error(`易位权 ${right} 与王车位置不符`);
    }
  }
  if (enPassant !== null) {
    const step = turn === WHITE ? 8 : -8;
    const pushedPawn = turn === WHITE ? "p" : "P";
    if (
      board[enPassant] !== null ||
      board[enPassant - step] !== null ||
      board[enPassant + step] !== pushedPawn
    ) {
      throw new Error("FEN 的吃过路兵目标格与棋子位置不符");
    }
  }
}

export function createInitialPosition() {
  return fromFen(INITIAL_FEN);
}

export function fromFen(fen) {
  if (typeof fen !== "string") {
    throw new TypeError("FEN 必须是字符串");
  }
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6 && fields.length !== 4) {
    throw new Error("FEN 必须包含 6 个字段");
  }
  const [placement, turn, castling, enPassant, halfmove = "0", fullmove = "1"] =
    fields;
  const board = parsePlacement(placement);
  if (turn !== WHITE && turn !== BLACK) {
    throw new Error("FEN 的行棋方必须是 w 或 b");
  }
  if (!/^(?:-|K?Q?k?q?)$/.test(castling)) {
    throw new Error("FEN 的易位字段无效");
  }
  if (!/^\d+$/.test(halfmove) || !/^[1-9]\d*$/.test(fullmove)) {
    throw new Error("FEN 的步数字段无效");
  }

  const position = {
    board,
    turn,
    castling: castling === "-" ? "" : castling,
    enPassant: parseEnPassantField(enPassant, turn),
    halfmoveClock: Number(halfmove),
    fullmoveNumber: Number(fullmove),
  };
  validateSetup(position);
  const loaded = loadPosition(position);
  if (isSideInCheck(loaded, loaded.side ^ 1)) {
    throw new Error("非行棋方的王不能处于被将军状态");
  }
  return position;
}

export function toFen(position) {
  assertPosition(position);
  const enPassant = position.enPassant ?? null;
  return [
    placementText(position.board),
    position.turn,
    position.castling || "-",
    enPassant === null ? "-" : squareName(enPassant),
    position.halfmoveClock,
    position.fullmoveNumber,
  ].join(" ");
}

export function squareName(index) {
  if (!isSquareIndex(index)) {
    throw new RangeError("格子索引必须在 0–63 之间");
  }
  return `${FILES[index & 7]}${8 - (index >> 3)}`;
}

export function squareIndex(name) {
  if (typeof name !== "string" || !/^[a-h][1-8]$/.test(name)) {
    throw new RangeError("格子名称必须是 a1–h8");
  }
  return (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]);
}

export function positionKey(position) {
  return keyFor(loadPosition(position), position);
}

export function generateLegalMoves(position) {
  return collectLegalMoves(loadPosition(position)).map((move) =>
    toMoveObject(move),
  );
}

export function legalMovesFrom(position, from) {
  if (!isSquareIndex(from)) {
    throw new RangeError("格子索引必须在 0–63 之间");
  }
  return generateLegalMoves(position).filter((move) => move.from === from);
}

export function applyMove(position, move) {
  const board = loadPosition(position);
  makeMove(board, resolveMove(collectLegalMoves(board), move));
  return exportPosition(board);
}

export function isInCheck(position, color = position?.turn) {
  const board = loadPosition(position);
  if (color !== WHITE && color !== BLACK) {
    throw new TypeError("颜色必须是 w 或 b");
  }
  return isSideInCheck(board, color === WHITE ? 0 : 1);
}

export function getGameStatus(position, history = []) {
  const board = loadPosition(position);
  if (!Array.isArray(history)) {
    throw new TypeError("历史记录必须是局面键数组");
  }
  const inCheck = isSideInCheck(board, board.side);
  if (!hasLegalMove(board, new Int32Array(MAX_MOVES), 0)) {
    return inCheck
      ? {
          state: "checkmate",
          winner: board.side === 0 ? BLACK : WHITE,
          inCheck,
          reason: null,
        }
      : { state: "stalemate", winner: null, inCheck, reason: "stalemate" };
  }

  const reason = drawReason(board, position, history);
  return {
    state: reason === null ? "playing" : "draw",
    winner: null,
    inCheck,
    reason,
  };
}

function drawReason(board, position, history) {
  if (history.length >= 3) {
    const key = keyFor(board, position);
    if (history.filter((entry) => entry === key).length >= 3) {
      return "repetition";
    }
  }
  if (board.halfmove >= 100) {
    return "fifty-move";
  }
  if (isDeadPosition(board)) {
    return "material";
  }
  return null;
}

export function moveToSan(position, move) {
  const board = loadPosition(position);
  const legalMoves = collectLegalMoves(board);
  return formatSan(board, legalMoves, resolveMove(legalMoves, move));
}

function formatSan(board, legalMoves, move) {
  const flag = (move >> 17) & 7;
  let san;
  if (flag === FLAG_CASTLE_KING) {
    san = "O-O";
  } else if (flag === FLAG_CASTLE_QUEEN) {
    san = "O-O-O";
  } else {
    san = describeMove(legalMoves, move);
  }

  makeMove(board, move);
  if (isSideInCheck(board, board.side)) {
    san += hasLegalMove(board, new Int32Array(MAX_MOVES), 0) ? "+" : "#";
  }
  unmakeMove(board, move);
  return san;
}

function describeMove(legalMoves, move) {
  const from = move & 127;
  const target = squareName88((move >> 7) & 127);
  const promotion = (move >> 14) & 7;
  const capture = ((move >> 20) & 15) !== 0;
  const type = (move >> 24) & 7;

  if (type === PAWN) {
    const prefix = capture ? `${FILES[from & 7]}x` : "";
    const suffix = promotion === 0 ? "" : `=${SAN_LETTERS[promotion]}`;
    return `${prefix}${target}${suffix}`;
  }
  const prefix = SAN_LETTERS[type] + disambiguation(legalMoves, move);
  return `${prefix}${capture ? "x" : ""}${target}`;
}

function disambiguation(legalMoves, move) {
  const from = move & 127;
  const to = (move >> 7) & 127;
  const piece = (move >> 24) & 15;
  let ambiguous = false;
  let sharesFile = false;
  let sharesRank = false;

  for (const other of legalMoves) {
    const otherFrom = other & 127;
    if (
      otherFrom === from ||
      ((other >> 7) & 127) !== to ||
      ((other >> 24) & 15) !== piece
    ) {
      continue;
    }
    ambiguous = true;
    sharesFile ||= (otherFrom & 7) === (from & 7);
    sharesRank ||= otherFrom >> 4 === from >> 4;
  }

  if (!ambiguous) {
    return "";
  }
  if (!sharesFile) {
    return FILES[from & 7];
  }
  if (!sharesRank) {
    return String(8 - (from >> 4));
  }
  return squareName88(from);
}

export function perft(position, depth) {
  if (!Number.isInteger(depth) || depth < 0) {
    throw new RangeError("perft 深度必须是非负整数");
  }
  const board = loadPosition(position);
  if (depth === 0) {
    return 1;
  }
  return countLeaves(board, depth, 0, new Int32Array(MAX_MOVES * depth));
}

function countLeaves(board, depth, ply, list) {
  const start = ply * MAX_MOVES;
  const end = generateMoves(board, list, start, false);
  const side = board.side;
  let nodes = 0;
  for (let index = start; index < end; index += 1) {
    const move = list[index];
    makeMove(board, move);
    if (!isSideInCheck(board, side)) {
      nodes += depth === 1 ? 1 : countLeaves(board, depth - 1, ply + 1, list);
    }
    unmakeMove(board, move);
  }
  return nodes;
}

function evaluate(board) {
  const { counts } = board;
  const phase = board.phase < TOTAL_PHASE ? board.phase : TOTAL_PHASE;
  let middlegame = board.middlegame;
  let endgame = board.endgame;

  if (counts[BISHOP] >= 2) {
    middlegame += 30;
    endgame += 50;
  }
  if (counts[BISHOP | 8] >= 2) {
    middlegame -= 30;
    endgame -= 50;
  }
  if (phase > 6) {
    middlegame += kingShelter(board, 0) - kingShelter(board, 1);
  }

  let score =
    ((middlegame * phase + endgame * (TOTAL_PHASE - phase)) / TOTAL_PHASE) | 0;
  if (phase <= 12) {
    score += mopUp(board);
  }
  return board.side === 0 ? score : -score;
}

function kingShelter(board, side) {
  const king = board.kings[side];
  const file = king & 7;
  if (file === 3 || file === 4) {
    return 0;
  }
  const forward = side === 0 ? -16 : 16;
  const pawn = PAWN | (side << 3);
  let score = 0;
  for (let delta = -1; delta <= 1; delta += 1) {
    if (file + delta < 0 || file + delta > 7) {
      continue;
    }
    const near = king + forward + delta;
    const far = near + forward;
    if (!(near & 0x88) && board.squares[near] === pawn) {
      score += 12;
    } else if (!(far & 0x88) && board.squares[far] === pawn) {
      score += 6;
    } else {
      score -= 12;
    }
  }
  return score;
}

function pieceMaterial(counts, side) {
  const color = side << 3;
  return (
    counts[KNIGHT | color] * MATERIAL[KNIGHT] +
    counts[BISHOP | color] * MATERIAL[BISHOP] +
    counts[ROOK | color] * MATERIAL[ROOK] +
    counts[QUEEN | color] * MATERIAL[QUEEN]
  );
}

function mopUp(board) {
  const { counts } = board;
  const white = pieceMaterial(counts, 0);
  const black = pieceMaterial(counts, 1);
  if (white >= black + 400 && counts[PAWN | 8] === 0) {
    return cornerPressure(board, 0);
  }
  if (black >= white + 400 && counts[PAWN] === 0) {
    return -cornerPressure(board, 1);
  }
  return 0;
}

function cornerPressure(board, strong) {
  const weakKing = board.kings[strong ^ 1];
  const strongKing = board.kings[strong];
  const file = weakKing & 7;
  const row = weakKing >> 4;
  const centerDistance =
    Math.max(3 - file, file - 4) + Math.max(3 - row, row - 4);
  const kingDistance =
    Math.abs(file - (strongKing & 7)) + Math.abs(row - (strongKing >> 4));
  return 10 * centerDistance + 4 * (14 - kingDistance);
}

function hasPieces(board, side) {
  return pieceMaterial(board.counts, side) > 0;
}

function prepareSearchMemory() {
  if (searchMemory === null) {
    searchMemory = {
      moves: new Int32Array(MAX_PLY * MAX_MOVES),
      scores: new Int32Array(MAX_PLY * MAX_MOVES),
      killers: new Int32Array(MAX_PLY * 2),
      history: new Int32Array(16 * 128),
      tableLock: new Int32Array(TABLE_SIZE),
      tableMove: new Int32Array(TABLE_SIZE),
      tableScore: new Int32Array(TABLE_SIZE),
      tableDepth: new Int8Array(TABLE_SIZE),
      tableBound: new Uint8Array(TABLE_SIZE),
    };
  }
  searchMemory.killers.fill(0);
  searchMemory.history.fill(0);
  searchMemory.tableBound.fill(0);
  return searchMemory;
}

function orderScore(move) {
  const captured = (move >> 20) & 15;
  const promotion = (move >> 14) & 7;
  if (captured !== 0) {
    return (
      ORDER_CAPTURE +
      MATERIAL[captured & 7] * 8 -
      ((move >> 24) & 7) +
      (promotion === QUEEN ? 800 : 0)
    );
  }
  if (promotion !== 0) {
    return promotion === QUEEN ? ORDER_PROMOTION : ORDER_UNDERPROMOTION;
  }
  return 0;
}

function scoreMoves(memory, start, end, tableMove, ply) {
  const { moves, scores, history, killers } = memory;
  const firstKiller = killers[ply * 2];
  const secondKiller = killers[ply * 2 + 1];
  for (let index = start; index < end; index += 1) {
    const move = moves[index];
    if (move === tableMove) {
      scores[index] = ORDER_TABLE_MOVE;
    } else if (!isQuietMove(move)) {
      scores[index] = orderScore(move);
    } else if (move === firstKiller) {
      scores[index] = ORDER_FIRST_KILLER;
    } else if (move === secondKiller) {
      scores[index] = ORDER_SECOND_KILLER;
    } else {
      scores[index] = history[((move >> 24) << 7) | ((move >> 7) & 127)];
    }
  }
}

function pickMove(memory, index, end) {
  const { moves, scores } = memory;
  let bestIndex = index;
  for (let other = index + 1; other < end; other += 1) {
    if (scores[other] > scores[bestIndex]) {
      bestIndex = other;
    }
  }
  if (bestIndex !== index) {
    const move = moves[bestIndex];
    const score = scores[bestIndex];
    moves[bestIndex] = moves[index];
    scores[bestIndex] = scores[index];
    moves[index] = move;
    scores[index] = score;
  }
  return moves[index];
}

function rememberQuietCutoff(memory, move, depth, ply) {
  const { killers, history } = memory;
  if (killers[ply * 2] !== move) {
    killers[ply * 2 + 1] = killers[ply * 2];
    killers[ply * 2] = move;
  }
  const slot = ((move >> 24) << 7) | ((move >> 7) & 127);
  history[slot] += depth * depth;
  if (history[slot] > HISTORY_LIMIT) {
    for (let index = 0; index < history.length; index += 1) {
      history[index] >>= 1;
    }
  }
}

function scoreToTable(score, ply) {
  if (score >= MATE_THRESHOLD) {
    return score + ply;
  }
  return score <= -MATE_THRESHOLD ? score - ply : score;
}

function scoreFromTable(score, ply) {
  if (score >= MATE_THRESHOLD) {
    return score - ply;
  }
  return score <= -MATE_THRESHOLD ? score + ply : score;
}

function storeEntry(search, depth, bound, score, move, ply) {
  const { memory, board } = search;
  const slot = board.hashLow & TABLE_MASK;
  memory.tableLock[slot] = board.hashHigh;
  memory.tableDepth[slot] = depth;
  memory.tableBound[slot] = bound;
  memory.tableScore[slot] = scoreToTable(score, ply);
  memory.tableMove[slot] = move;
}

function isOutOfTime(search) {
  search.nodes += 1;
  if ((search.nodes & NODE_CHECK_MASK) === 0 && now() >= search.deadline) {
    search.stopped = true;
  }
  return search.stopped;
}

function negamax(
  search,
  requestedDepth,
  requestedAlpha,
  requestedBeta,
  ply,
  allowNull,
) {
  if (isOutOfTime(search)) {
    return 0;
  }
  const { board, memory } = search;
  const side = board.side;
  const inCheck = isSideInCheck(board, side);
  const start = ply * MAX_MOVES;

  if (isRepetition(board) || isDeadPosition(board)) {
    return 0;
  }
  if (board.halfmove >= 100) {
    return inCheck && !hasLegalMove(board, memory.moves, start)
      ? -MATE_SCORE + ply
      : 0;
  }

  let alpha = Math.max(requestedAlpha, -MATE_SCORE + ply);
  const beta = Math.min(requestedBeta, MATE_SCORE - ply - 1);
  if (alpha >= beta) {
    return alpha;
  }
  const depth = inCheck ? requestedDepth + 1 : requestedDepth;
  if (depth <= 0) {
    return quiesce(search, alpha, beta, ply);
  }
  if (ply >= MAX_PLY - 1) {
    return evaluate(board);
  }

  const slot = board.hashLow & TABLE_MASK;
  let tableMove = 0;
  if (
    memory.tableBound[slot] !== 0 &&
    memory.tableLock[slot] === board.hashHigh
  ) {
    tableMove = memory.tableMove[slot];
    if (memory.tableDepth[slot] >= depth) {
      const score = scoreFromTable(memory.tableScore[slot], ply);
      const bound = memory.tableBound[slot];
      if (
        bound === BOUND_EXACT ||
        (bound === BOUND_LOWER && score >= beta) ||
        (bound === BOUND_UPPER && score <= alpha)
      ) {
        return score;
      }
    }
  }

  if (
    allowNull &&
    search.nullMove &&
    !inCheck &&
    depth >= 3 &&
    beta - alpha === 1 &&
    hasPieces(board, side) &&
    evaluate(board) >= beta
  ) {
    makeNullMove(board);
    const score = -negamax(
      search,
      depth - (depth > 6 ? 4 : 3),
      -beta,
      1 - beta,
      ply + 1,
      false,
    );
    unmakeNullMove(board);
    if (search.stopped) {
      return 0;
    }
    if (score >= beta) {
      return score >= MATE_THRESHOLD ? beta : score;
    }
  }

  const end = generateMoves(board, memory.moves, start, false);
  scoreMoves(memory, start, end, tableMove, ply);
  const originalAlpha = alpha;
  let bestScore = -INFINITE_SCORE;
  let bestMove = 0;
  let legalCount = 0;

  for (let index = start; index < end; index += 1) {
    const move = pickMove(memory, index, end);
    makeMove(board, move);
    if (isSideInCheck(board, side)) {
      unmakeMove(board, move);
      continue;
    }
    legalCount += 1;

    let score;
    if (legalCount === 1) {
      score = scoreChild(search, depth - 1, alpha, beta, ply);
    } else {
      const reduction =
        inCheck || legalCount <= 3
          ? 0
          : lateMoveReduction(search, move, depth, ply, legalCount);
      score = scoreChild(search, depth - 1 - reduction, alpha, alpha + 1, ply);
      if (reduction > 0 && score > alpha) {
        score = scoreChild(search, depth - 1, alpha, alpha + 1, ply);
      }
      if (score > alpha && score < beta) {
        score = scoreChild(search, depth - 1, alpha, beta, ply);
      }
    }
    unmakeMove(board, move);
    if (search.stopped) {
      return 0;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      if (score > alpha) {
        alpha = score;
        if (score >= beta) {
          if (isQuietMove(move)) {
            rememberQuietCutoff(memory, move, depth, ply);
          }
          break;
        }
      }
    }
  }

  if (legalCount === 0) {
    return inCheck ? -MATE_SCORE + ply : 0;
  }
  let bound = BOUND_UPPER;
  if (bestScore >= beta) {
    bound = BOUND_LOWER;
  } else if (bestScore > originalAlpha) {
    bound = BOUND_EXACT;
  }
  storeEntry(search, depth, bound, bestScore, bestMove, ply);
  return bestScore;
}

function scoreChild(search, depth, alpha, beta, ply) {
  return -negamax(search, depth, -beta, -alpha, ply + 1, true);
}

function lateMoveReduction(search, move, depth, ply, legalCount) {
  if (
    !search.reductions ||
    depth < 3 ||
    !isQuietMove(move) ||
    move === search.memory.killers[ply * 2] ||
    move === search.memory.killers[ply * 2 + 1]
  ) {
    return 0;
  }
  const board = search.board;
  if (isSideInCheck(board, board.side)) {
    return 0;
  }
  return legalCount > 10 && depth > 5 ? 2 : 1;
}

function quiesce(search, requestedAlpha, beta, ply) {
  if (isOutOfTime(search)) {
    return 0;
  }
  const { board, memory } = search;
  const standPat = evaluate(board);
  if (standPat >= beta || ply >= MAX_PLY - 1) {
    return standPat;
  }
  let alpha = Math.max(requestedAlpha, standPat);
  const start = ply * MAX_MOVES;
  const end = generateMoves(board, memory.moves, start, true);
  scoreMoves(memory, start, end, 0, ply);
  const side = board.side;
  let bestScore = standPat;

  for (let index = start; index < end; index += 1) {
    const move = pickMove(memory, index, end);
    if (
      ((move >> 14) & 7) === 0 &&
      standPat + MATERIAL[(move >> 20) & 7] + 200 <= alpha
    ) {
      continue;
    }
    makeMove(board, move);
    if (isSideInCheck(board, side)) {
      unmakeMove(board, move);
      continue;
    }
    const score = -quiesce(search, -beta, -alpha, ply + 1);
    unmakeMove(board, move);
    if (search.stopped) {
      return 0;
    }
    if (score > bestScore) {
      bestScore = score;
      if (score > alpha) {
        alpha = score;
        if (score >= beta) {
          break;
        }
      }
    }
  }
  return bestScore;
}

// Each root move carries a small random bonus. Searching it against
// (alpha - bonus) keeps alpha-beta exact while near-equal moves can vary.
function searchRoot(search, entries, depth, exhaustive) {
  const { board } = search;
  let alpha = -INFINITE_SCORE;
  let best = null;

  for (const entry of entries) {
    makeMove(board, entry.move);
    let score;
    if (exhaustive || best === null) {
      score = scoreChild(search, depth - 1, -INFINITE_SCORE, INFINITE_SCORE, 0);
    } else {
      const bound = alpha - entry.bonus;
      score = scoreChild(search, depth - 1, bound, bound + 1, 0);
      if (score > bound && !search.stopped) {
        score = scoreChild(search, depth - 1, bound, INFINITE_SCORE, 0);
      }
    }
    unmakeMove(board, entry.move);
    if (search.stopped) {
      return null;
    }
    entry.pending = score;
    if (best === null || score + entry.bonus > alpha) {
      alpha = score + entry.bonus;
      best = entry;
    }
  }

  for (const entry of entries) {
    entry.score = entry.pending;
  }
  return best;
}

function randomUnit(random) {
  const value = Number(random());
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value < 1 ? value : 0.999999;
}

function randomIndex(random, length) {
  return Math.floor(randomUnit(random) * length);
}

function createRootEntries(moves, noise, random) {
  const entries = moves.map((move) => ({
    move,
    bonus: 0,
    score: -INFINITE_SCORE,
    pending: -INFINITE_SCORE,
  }));
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const other = randomIndex(random, index + 1);
    [entries[index], entries[other]] = [entries[other], entries[index]];
  }
  if (noise > 0) {
    for (const entry of entries) {
      entry.bonus = Math.floor(randomUnit(random) * noise);
    }
  }
  return entries.sort(
    (left, right) => orderScore(right.move) - orderScore(left.move),
  );
}

function reorderRootEntries(entries, best, exhaustive) {
  if (exhaustive) {
    entries.sort((left, right) => right.score - left.score);
    return;
  }
  entries.splice(entries.indexOf(best), 1);
  entries.unshift(best);
}

function iterativeDeepening(board, entries, settings, limits) {
  const startedAt = now();
  const search = {
    board,
    memory: prepareSearchMemory(),
    nodes: 0,
    stopped: false,
    deadline: startedAt + limits.timeLimitMs,
    nullMove: settings.nullMove,
    reductions: settings.reductions,
  };
  let best = entries[0];

  try {
    for (let depth = 1; depth <= limits.maxDepth; depth += 1) {
      const result = searchRoot(search, entries, depth, settings.playful);
      if (result === null) {
        break;
      }
      best = result;
      reorderRootEntries(entries, result, settings.playful);
      if (typeof limits.onInfo === "function") {
        limits.onInfo({
          depth,
          score: result.score,
          nodes: search.nodes,
          elapsedMs: now() - startedAt,
          move: toMoveObject(result.move),
        });
      }
      if (
        Math.abs(result.score) >= MATE_THRESHOLD ||
        now() - startedAt >= limits.timeLimitMs / 2
      ) {
        break;
      }
    }
  } catch {
    // Never let an unexpected error cost the player a turn.
  }
  return best;
}

function choosePlayfulMove(entries, random) {
  const bestScore = Math.max(...entries.map((entry) => entry.score));
  let choice = entries[0];
  let choiceValue = -Infinity;
  for (const entry of entries) {
    const value = entry.score + (randomUnit(random) * 2 - 1) * PLAYFUL_NOISE;
    if (value > choiceValue) {
      choiceValue = value;
      choice = entry;
    }
  }
  if (randomUnit(random) < PLAYFUL_BLUNDER_CHANCE) {
    const pool = entries.filter(
      (entry) => entry.score >= bestScore - PLAYFUL_BLUNDER_WINDOW,
    );
    choice = pool[randomIndex(random, pool.length)];
  }
  return choice.move;
}

function hashFromKey(key) {
  const fields = typeof key === "string" ? key.split(" ") : [];
  if (fields.length < 4) {
    return null;
  }
  const [placement, turn, castling, enPassant] = fields;
  let low = 0;
  let high = 0;
  let row = 0;
  let file = 0;
  for (const char of placement) {
    if (char === "/") {
      row += 1;
      file = 0;
    } else if (char >= "1" && char <= "8") {
      file += Number(char);
    } else {
      const piece = pieceCode(char);
      if (piece === 0 || row > 7 || file > 7) {
        return null;
      }
      const slot = (piece << 7) | (row << 4) | file;
      low ^= PIECE_KEYS_LOW[slot];
      high ^= PIECE_KEYS_HIGH[slot];
      file += 1;
    }
  }
  const rights = castlingBits(castling);
  low ^= CASTLING_KEYS_LOW[rights];
  high ^= CASTLING_KEYS_HIGH[rights];
  if (turn === BLACK) {
    low ^= SIDE_KEY_LOW;
    high ^= SIDE_KEY_HIGH;
  }
  if (/^[a-h][36]$/.test(enPassant)) {
    low ^= EN_PASSANT_KEYS_LOW[FILES.indexOf(enPassant[0])];
    high ^= EN_PASSANT_KEYS_HIGH[FILES.indexOf(enPassant[0])];
  }
  return { low, high };
}

function seedRepetitionHistory(board, position, history) {
  if (!Array.isArray(history) || history.length === 0 || board.halfmove === 0) {
    return;
  }
  const previous =
    history[history.length - 1] === keyFor(board, position)
      ? history.slice(0, -1)
      : history;
  const lookback = Math.min(
    board.halfmove,
    MAX_SEEDED_HISTORY,
    previous.length,
  );
  for (const key of previous.slice(previous.length - lookback)) {
    const hash = hashFromKey(key) ?? { low: 0, high: 0 };
    board.historyLow[board.historyLength] = hash.low;
    board.historyHigh[board.historyLength] = hash.high;
    board.historyLength += 1;
  }
}

function normalizeLevel(level) {
  const value = Math.round(Number(level ?? 2));
  if (!Number.isFinite(value)) {
    return 2;
  }
  return Math.min(3, Math.max(1, value));
}

export function chooseAiMove(position, options = {}) {
  const config = options ?? {};
  const board = loadPosition(position);
  const moves = collectLegalMoves(board);
  if (moves.length === 0) {
    return null;
  }
  if (moves.length === 1) {
    return toMoveObject(moves[0]);
  }

  const settings = AI_LEVELS[normalizeLevel(config.level)];
  const random =
    typeof config.random === "function" ? config.random : Math.random;
  const timeLimitMs =
    Number.isFinite(config.timeLimitMs) && config.timeLimitMs > 0
      ? config.timeLimitMs
      : settings.timeLimitMs;
  const maxDepth =
    Number.isInteger(config.maxDepth) && config.maxDepth > 0
      ? Math.min(config.maxDepth, MAX_SEARCH_DEPTH)
      : settings.maxDepth;

  seedRepetitionHistory(board, position, config.history);
  const entries = createRootEntries(moves, settings.rootNoise, random);
  const best = iterativeDeepening(board, entries, settings, {
    timeLimitMs,
    maxDepth,
    onInfo: config.onInfo,
  });
  return toMoveObject(
    settings.playful ? choosePlayfulMove(entries, random) : best.move,
  );
}
