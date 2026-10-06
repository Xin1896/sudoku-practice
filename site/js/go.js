export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const SUPPORTED_SIZES = Object.freeze([9, 13, 19]);

const OFF_BOARD = 3;
const DEFAULT_KOMI = 7.5;
const GAME_FIELDS = Object.freeze([
  "size",
  "board",
  "turn",
  "komi",
  "prisoners",
  "koPoint",
  "passes",
  "moveNumber",
  "lastMove",
  "over",
]);
const PRISONER_FIELDS = Object.freeze(["black", "white"]);
const STAR_LINES = Object.freeze({
  9: Object.freeze([2, 6]),
  13: Object.freeze([3, 9]),
  19: Object.freeze([3, 9, 15]),
});
const AI_LEVELS = Object.freeze([1, 2, 3]);
const DEFAULT_TIME_LIMITS = Object.freeze({ 1: 150, 2: 400, 3: 1500 });
const OWNERSHIP_PLAYOUTS = Object.freeze({
  9: Object.freeze({ 1: 300, 2: 600, 3: 600 }),
  13: Object.freeze({ 1: 150, 2: 300, 3: 300 }),
  19: Object.freeze({ 1: 80, 2: 150, 3: 150 }),
});
const OWNERSHIP_TIME_SHARE = 0.3;
const DEAD_STONE_PLAYOUTS = Object.freeze({ 9: 2000, 13: 1000, 19: 500 });
const DEAD_STONE_TIME_LIMIT = 350;
const DEAD_OWNERSHIP = 0.7;
const DOUBTFUL_OWNERSHIP = 0.4;
const ENCLOSURE_WEAKNESS = 0.3;
const SECURE_OWNERSHIP = 0.8;
const HEALTHY_LIFE = 0.3;
const SETTLED_DEPTH = 3;
const SETTLED_SIZE = 15;
const PASS_THRESHOLD = 0.5;
const REPLY_TO_PASS_THRESHOLD = 1.5;
const SETTLED_MOVE_VALUE = 4;
const URGENT_THRESHOLD = 10;
const LEVEL_NOISE = Object.freeze({ 1: 4, 2: 0.25, 3: 0.25 });
const SEARCH_SETTINGS = Object.freeze({
  9: Object.freeze({ candidates: 12, priorWeight: 0.08 }),
  13: Object.freeze({ candidates: 8, priorWeight: 0.2 }),
  19: Object.freeze({ candidates: 6, priorWeight: 0.35 }),
});
const SEARCH_MIN_VISITS = 4;
const SEARCH_EXPLORATION = 0.35;
const LADDER_NODE_LIMIT = 300;
const LADDER_DEPTH_LIMIT = 60;
const INFLUENCE_DECAY = Object.freeze([1, 0.5, 0.25, 0.125]);
const QUIET_RADIUS = Object.freeze({ 9: 1, 13: 2, 19: 2 });
const LINE_VALUES = Object.freeze({
  9: Object.freeze([1, 1, 1, 0.95, 0.9]),
  13: Object.freeze([0.95, 1, 1, 0.95, 0.85, 0.75, 0.7]),
  19: Object.freeze([0.9, 1, 1, 0.95, 0.85, 0.75, 0.65, 0.6, 0.6, 0.6]),
});
const WEIGHTS = Object.freeze({
  captureBase: 6,
  capturePerStone: 4,
  rescueBase: 5,
  rescuePerStone: 4,
  ladderBase: 4,
  ladderPerStone: 3,
  atariBase: 0.6,
  atariPerStone: 0.2,
  reduceBase: 0.4,
  reducePerStone: 0.15,
  defendBase: 1,
  defendPerStone: 0.3,
  attackBase: 0.5,
  attackPerStone: 0.2,
  connect: 1,
  cut: 0.8,
  ladderedBase: -1.5,
  ladderedPerStone: -0.8,
  selfAtari: -10,
  shortOfLiberties: -0.8,
  emptyTriangle: -0.8,
  secureArea: -0.5,
  nearLastMove: 0.8,
  earlyFirstLine: -1.5,
  earlySecondLine: -0.5,
});

const neighborTables = new Map();
const layouts = new Map();

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function byNumber(left, right) {
  return left - right;
}

function opponentOf(color) {
  return color === BLACK ? WHITE : BLACK;
}

function clampUnit(value) {
  return value < -1 ? -1 : value > 1 ? 1 : value;
}

function isIntegerInRange(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isCounter(value) {
  return Number.isInteger(value) && value >= 0;
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  try {
    return Object.getPrototypeOf(value) === Object.prototype;
  } catch {
    return false;
  }
}

function hasOwnFields(value, fields) {
  return fields.every((field) => Object.hasOwn(value, field));
}

function isBoardArray(board, area) {
  if (!Array.isArray(board) || board.length !== area) {
    return false;
  }

  for (let point = 0; point < area; point += 1) {
    const value = board[point];
    if (value !== EMPTY && value !== BLACK && value !== WHITE) {
      return false;
    }
  }
  return true;
}

function isKomi(value, area) {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= area;
}

function isPrisoners(value) {
  return (
    isPlainRecord(value) &&
    hasOwnFields(value, PRISONER_FIELDS) &&
    isCounter(value.black) &&
    isCounter(value.white)
  );
}

function isKoPoint(value, board) {
  if (value === -1) {
    return true;
  }
  return isIntegerInRange(value, 0, board.length - 1) && board[value] === EMPTY;
}

function isLastMove(value, area) {
  return value === null || value === "pass" || isIntegerInRange(value, 0, area - 1);
}

function assertSize(size) {
  if (!SUPPORTED_SIZES.includes(size)) {
    throw new RangeError("棋盘大小只能是 9、13 或 19");
  }
}

function assertPoint(size, point) {
  if (!isIntegerInRange(point, 0, size * size - 1)) {
    throw new RangeError("交叉点索引超出棋盘范围");
  }
}

function assertBoard(board, size) {
  if (!isBoardArray(board, size * size)) {
    throw new TypeError(`棋盘必须是包含 ${size * size} 个 0–2 整数的数组`);
  }
}

function assertGame(game) {
  if (game === null || typeof game !== "object") {
    throw new TypeError("对局必须是对象");
  }
  assertSize(game.size);
  assertBoard(game.board, game.size);
}

function neighborTable(size) {
  let table = neighborTables.get(size);
  if (table === undefined) {
    table = Object.freeze(
      Array.from({ length: size * size }, (_, point) => {
        const row = Math.floor(point / size);
        const column = point % size;
        const result = [];
        if (row > 0) {
          result.push(point - size);
        }
        if (column > 0) {
          result.push(point - 1);
        }
        if (column < size - 1) {
          result.push(point + 1);
        }
        if (row < size - 1) {
          result.push(point + size);
        }
        return Object.freeze(result);
      }),
    );
    neighborTables.set(size, table);
  }
  return table;
}

function collectGroup(board, size, point) {
  const color = board[point];
  if (color !== BLACK && color !== WHITE) {
    return { color: EMPTY, stones: [], liberties: [] };
  }

  const table = neighborTable(size);
  const seen = new Uint8Array(size * size);
  const stones = [point];
  const liberties = [];
  seen[point] = 1;

  for (let index = 0; index < stones.length; index += 1) {
    for (const neighbor of table[stones[index]]) {
      if (seen[neighbor]) {
        continue;
      }
      if (board[neighbor] === color) {
        seen[neighbor] = 1;
        stones.push(neighbor);
      } else if (board[neighbor] === EMPTY) {
        seen[neighbor] = 1;
        liberties.push(neighbor);
      }
    }
  }

  return { color, stones: stones.sort(byNumber), liberties: liberties.sort(byNumber) };
}

function everyGroupHasLiberty(board, size) {
  const seen = new Uint8Array(size * size);

  for (let point = 0; point < board.length; point += 1) {
    if (board[point] === EMPTY || seen[point]) {
      continue;
    }

    const group = collectGroup(board, size, point);
    if (group.liberties.length === 0) {
      return false;
    }
    group.stones.forEach((stone) => {
      seen[stone] = 1;
    });
  }
  return true;
}

function resolveMove(game, point) {
  if (game.over) {
    return { reason: "game-over" };
  }
  const { size } = game;
  if (!isIntegerInRange(point, 0, size * size - 1)) {
    return { reason: "off-board" };
  }
  if (game.board[point] !== EMPTY) {
    return { reason: "occupied" };
  }
  if (point === game.koPoint) {
    return { reason: "ko" };
  }

  const player = game.turn;
  const enemy = opponentOf(player);
  const board = [...game.board];
  const captured = [];
  board[point] = player;

  for (const neighbor of neighborTable(size)[point]) {
    if (board[neighbor] !== enemy) {
      continue;
    }
    const group = collectGroup(board, size, neighbor);
    if (group.liberties.length === 0) {
      for (const stone of group.stones) {
        board[stone] = EMPTY;
        captured.push(stone);
      }
    }
  }

  const own = collectGroup(board, size, point);
  if (own.liberties.length === 0) {
    return { reason: "suicide" };
  }

  const isKo =
    captured.length === 1 && own.stones.length === 1 && own.liberties.length === 1;
  return {
    board,
    captured: captured.sort(byNumber),
    koPoint: isKo ? captured[0] : -1,
  };
}

export function createGame(size = 9, { komi = DEFAULT_KOMI } = {}) {
  assertSize(size);
  if (!isKomi(komi, size * size)) {
    throw new RangeError("贴目必须是有限数字且不超过棋盘交叉点数");
  }

  return {
    size,
    board: Array(size * size).fill(EMPTY),
    turn: BLACK,
    komi,
    prisoners: { black: 0, white: 0 },
    koPoint: -1,
    passes: 0,
    moveNumber: 0,
    lastMove: null,
    over: false,
  };
}

export function isValidGame(value) {
  try {
    if (!isPlainRecord(value) || !hasOwnFields(value, GAME_FIELDS)) {
      return false;
    }

    const { size, board } = value;
    if (!SUPPORTED_SIZES.includes(size)) {
      return false;
    }

    const area = size * size;
    return (
      isBoardArray(board, area) &&
      (value.turn === BLACK || value.turn === WHITE) &&
      isKomi(value.komi, area) &&
      isPrisoners(value.prisoners) &&
      isKoPoint(value.koPoint, board) &&
      isCounter(value.passes) &&
      isCounter(value.moveNumber) &&
      isLastMove(value.lastMove, area) &&
      typeof value.over === "boolean" &&
      everyGroupHasLiberty(board, size)
    );
  } catch {
    return false;
  }
}

export function starPoints(size) {
  assertSize(size);
  const lines = STAR_LINES[size];
  const points = [];

  for (const row of lines) {
    for (const column of lines) {
      points.push(row * size + column);
    }
  }
  if (size !== 19) {
    const center = (size - 1) / 2;
    points.push(center * size + center);
  }
  return points.sort(byNumber);
}

export function neighbors(size, point) {
  assertSize(size);
  assertPoint(size, point);
  return [...neighborTable(size)[point]];
}

export function getGroup(board, size, point) {
  assertSize(size);
  assertBoard(board, size);
  assertPoint(size, point);
  return collectGroup(board, size, point);
}

export function isLegalMove(game, point) {
  assertGame(game);
  return resolveMove(game, point).reason === undefined;
}

export function playMove(game, point) {
  assertGame(game);
  const move = resolveMove(game, point);
  if (move.reason !== undefined) {
    return { ok: false, reason: move.reason };
  }

  const side = game.turn === BLACK ? "black" : "white";
  return {
    ok: true,
    game: {
      ...game,
      board: move.board,
      turn: opponentOf(game.turn),
      prisoners: {
        ...game.prisoners,
        [side]: game.prisoners[side] + move.captured.length,
      },
      koPoint: move.koPoint,
      passes: 0,
      moveNumber: game.moveNumber + 1,
      lastMove: point,
      over: false,
    },
    captured: move.captured,
  };
}

export function passTurn(game) {
  assertGame(game);
  if (game.over) {
    return game;
  }

  const passes = game.passes + 1;
  return {
    ...game,
    board: [...game.board],
    turn: opponentOf(game.turn),
    prisoners: { ...game.prisoners },
    koPoint: -1,
    passes,
    moveNumber: game.moveNumber + 1,
    lastMove: "pass",
    over: passes >= 2,
  };
}

export function scoreGame(game, deadStones = []) {
  assertGame(game);
  if (!Array.isArray(deadStones)) {
    throw new TypeError("死子列表必须是数组");
  }

  const { size, komi } = game;
  const area = size * size;
  const board = [...game.board];
  const dead = [];
  for (const point of new Set(deadStones)) {
    assertPoint(size, point);
    if (board[point] !== EMPTY) {
      board[point] = EMPTY;
      dead.push(point);
    }
  }

  const table = neighborTable(size);
  const territoryMap = Array(area).fill(EMPTY);
  const visited = new Uint8Array(area);
  const territory = { [BLACK]: 0, [WHITE]: 0 };

  for (let start = 0; start < area; start += 1) {
    if (board[start] !== EMPTY || visited[start]) {
      continue;
    }

    const region = [start];
    let borders = 0;
    visited[start] = 1;
    for (let index = 0; index < region.length; index += 1) {
      for (const neighbor of table[region[index]]) {
        if (board[neighbor] !== EMPTY) {
          borders |= board[neighbor];
        } else if (!visited[neighbor]) {
          visited[neighbor] = 1;
          region.push(neighbor);
        }
      }
    }

    if (borders === BLACK || borders === WHITE) {
      territory[borders] += region.length;
      region.forEach((point) => {
        territoryMap[point] = borders;
      });
    }
  }

  const blackStones = board.filter((value) => value === BLACK).length;
  const whiteStones = board.filter((value) => value === WHITE).length;
  const blackTotal = blackStones + territory[BLACK];
  const whiteTotal = whiteStones + territory[WHITE] + komi;
  let winner = EMPTY;
  if (blackTotal > whiteTotal) {
    winner = BLACK;
  } else if (whiteTotal > blackTotal) {
    winner = WHITE;
  }

  return {
    black: { stones: blackStones, territory: territory[BLACK], total: blackTotal },
    white: {
      stones: whiteStones,
      territory: territory[WHITE],
      komi,
      total: whiteTotal,
    },
    winner,
    margin: Math.abs(blackTotal - whiteTotal),
    territoryMap,
    dead: dead.sort(byNumber),
  };
}

function layoutFor(size) {
  let layout = layouts.get(size);
  if (layout !== undefined) {
    return layout;
  }

  const stride = size + 1;
  const length = (size + 2) * stride + 1;
  const area = size * size;
  const toInner = new Int32Array(area);
  const toOuter = new Int32Array(length).fill(-1);
  const lineValue = new Float64Array(length);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const inner = (row + 1) * stride + column + 1;
      const line = Math.min(row, column, size - 1 - row, size - 1 - column);
      toInner[row * size + column] = inner;
      toOuter[inner] = row * size + column;
      lineValue[inner] = LINE_VALUES[size][line];
    }
  }

  layout = Object.freeze({
    size,
    stride,
    length,
    area,
    toInner,
    toOuter,
    lineValue,
    offsets: Int32Array.of(-stride, -1, 1, stride),
    diagonals: Int32Array.of(-stride - 1, -stride + 1, stride - 1, stride + 1),
    workspace: {
      stamp: 0,
      libertyMark: new Int32Array(length),
      regionMark: new Int32Array(length),
      queue: new Int32Array(length),
      distance: new Int32Array(length),
      owners: new Uint8Array(length),
      pool: [],
    },
  });
  layouts.set(size, layout);
  return layout;
}

function nextStamp(workspace) {
  if (workspace.stamp >= 0x3fffffff) {
    workspace.libertyMark.fill(0);
    workspace.regionMark.fill(0);
    workspace.stamp = 0;
  }
  workspace.stamp += 1;
  return workspace.stamp;
}

// Board fields share one buffer so copying a position is a single typed-array set.
function createPosition(layout) {
  const { length, area } = layout;
  const data = new Int32Array(length * 8 + area);
  const field = (index) => data.subarray(index * length, (index + 1) * length);

  return {
    layout,
    data,
    color: field(0),
    head: field(1),
    next: field(2),
    stones: field(3),
    libs: field(4),
    libSum: field(5),
    libSumSq: field(6),
    emptyIndex: field(7),
    empties: data.subarray(length * 8),
    emptyCount: 0,
    ko: 0,
    turn: BLACK,
  };
}

function copyPosition(target, source) {
  target.data.set(source.data);
  target.emptyCount = source.emptyCount;
  target.ko = source.ko;
  target.turn = source.turn;
}

function poolPosition(layout, index) {
  const { pool } = layout.workspace;
  while (pool.length <= index) {
    pool.push(createPosition(layout));
  }
  return pool[index];
}

function addEmpty(position, point) {
  const index = position.emptyCount;
  position.empties[index] = point;
  position.emptyIndex[point] = index;
  position.emptyCount = index + 1;
}

function removeEmpty(position, point) {
  const { empties, emptyIndex } = position;
  const index = emptyIndex[point];
  const last = empties[position.emptyCount - 1];
  empties[index] = last;
  emptyIndex[last] = index;
  position.emptyCount -= 1;
}

// Pseudo-liberties: a group is in atari exactly when every counted liberty is one point.
function addLiberty(position, groupHead, point) {
  position.libs[groupHead] += 1;
  position.libSum[groupHead] += point;
  position.libSumSq[groupHead] += point * point;
}

function removeLiberty(position, groupHead, point) {
  position.libs[groupHead] -= 1;
  position.libSum[groupHead] -= point;
  position.libSumSq[groupHead] -= point * point;
}

function inAtari(position, groupHead) {
  const count = position.libs[groupHead];
  const sum = position.libSum[groupHead];
  return count > 0 && sum * sum === position.libSumSq[groupHead] * count;
}

function atariPoint(position, groupHead) {
  return position.libSum[groupHead] / position.libs[groupHead];
}

function buildGroups(position) {
  const { layout, color, head, next, stones } = position;
  const { offsets, toInner, area, workspace } = layout;
  const { regionMark: mark, queue } = workspace;
  const stamp = nextStamp(workspace);

  for (let outer = 0; outer < area; outer += 1) {
    const start = toInner[outer];
    const value = color[start];
    if ((value !== BLACK && value !== WHITE) || mark[start] === stamp) {
      continue;
    }

    let count = 0;
    queue[count] = start;
    count += 1;
    mark[start] = stamp;
    for (let index = 0; index < count; index += 1) {
      for (let side = 0; side < 4; side += 1) {
        const neighbor = queue[index] + offsets[side];
        if (color[neighbor] === value && mark[neighbor] !== stamp) {
          mark[neighbor] = stamp;
          queue[count] = neighbor;
          count += 1;
        }
      }
    }

    stones[start] = count;
    for (let index = 0; index < count; index += 1) {
      const stone = queue[index];
      head[stone] = start;
      next[stone] = queue[(index + 1) % count];
      for (let side = 0; side < 4; side += 1) {
        const neighbor = stone + offsets[side];
        if (color[neighbor] === EMPTY) {
          addLiberty(position, start, neighbor);
        }
      }
    }
  }
}

function positionFromGame(game) {
  const layout = layoutFor(game.size);
  const position = createPosition(layout);
  const { color } = position;
  color.fill(OFF_BOARD);

  for (let outer = 0; outer < layout.area; outer += 1) {
    const inner = layout.toInner[outer];
    color[inner] = game.board[outer];
    if (game.board[outer] === EMPTY) {
      addEmpty(position, inner);
    }
  }
  buildGroups(position);
  position.ko = game.koPoint >= 0 ? layout.toInner[game.koPoint] : 0;
  position.turn = game.turn;
  return position;
}

function mergeGroups(position, first, second) {
  const { head, next, stones, libs, libSum, libSumSq } = position;
  const keep = stones[first] >= stones[second] ? first : second;
  const absorb = keep === first ? second : first;

  let stone = absorb;
  do {
    head[stone] = keep;
    stone = next[stone];
  } while (stone !== absorb);

  const link = next[keep];
  next[keep] = next[absorb];
  next[absorb] = link;
  stones[keep] += stones[absorb];
  libs[keep] += libs[absorb];
  libSum[keep] += libSum[absorb];
  libSumSq[keep] += libSumSq[absorb];
}

function removeGroup(position, groupHead) {
  const { color, head, next, layout } = position;
  const { offsets } = layout;
  const capturer = opponentOf(color[groupHead]);
  let count = 0;
  let stone = groupHead;

  do {
    color[stone] = EMPTY;
    addEmpty(position, stone);
    count += 1;
    for (let side = 0; side < 4; side += 1) {
      const neighbor = stone + offsets[side];
      if (color[neighbor] === capturer) {
        addLiberty(position, head[neighbor], stone);
      }
    }
    stone = next[stone];
  } while (stone !== groupHead);

  return count;
}

function placeStone(position, point, player) {
  const { color, head, next, stones, libs, layout } = position;
  const { offsets } = layout;
  const enemy = opponentOf(player);

  color[point] = player;
  head[point] = point;
  next[point] = point;
  stones[point] = 1;
  libs[point] = 0;
  position.libSum[point] = 0;
  position.libSumSq[point] = 0;
  removeEmpty(position, point);

  for (let side = 0; side < 4; side += 1) {
    const neighbor = point + offsets[side];
    const value = color[neighbor];
    if (value === EMPTY) {
      addLiberty(position, point, neighbor);
    } else if (value === BLACK || value === WHITE) {
      removeLiberty(position, head[neighbor], point);
    }
  }

  for (let side = 0; side < 4; side += 1) {
    const neighbor = point + offsets[side];
    if (color[neighbor] === player && head[neighbor] !== head[point]) {
      mergeGroups(position, head[point], head[neighbor]);
    }
  }

  let captured = 0;
  let capturedPoint = 0;
  for (let side = 0; side < 4; side += 1) {
    const neighbor = point + offsets[side];
    if (color[neighbor] === enemy && libs[head[neighbor]] === 0) {
      capturedPoint = neighbor;
      captured += removeGroup(position, head[neighbor]);
    }
  }

  const own = head[point];
  const isKo = captured === 1 && stones[own] === 1 && libs[own] === 1;
  position.ko = isKo ? capturedPoint : 0;
  position.turn = enemy;
  return captured;
}

function isLegalPoint(position, point, player) {
  const { color, head, layout } = position;
  const { offsets } = layout;
  if (color[point] !== EMPTY || point === position.ko) {
    return false;
  }

  for (let side = 0; side < 4; side += 1) {
    if (color[point + offsets[side]] === EMPTY) {
      return true;
    }
  }

  for (let side = 0; side < 4; side += 1) {
    const neighbor = point + offsets[side];
    const value = color[neighbor];
    if (value === player && !inAtari(position, head[neighbor])) {
      return true;
    }
    if (value !== player && value !== OFF_BOARD && inAtari(position, head[neighbor])) {
      return true;
    }
  }
  return false;
}

function isEyeLike(position, point, player) {
  const { color, layout } = position;
  const { offsets, diagonals } = layout;

  for (let side = 0; side < 4; side += 1) {
    const value = color[point + offsets[side]];
    if (value !== player && value !== OFF_BOARD) {
      return false;
    }
  }

  const enemy = opponentOf(player);
  let enemyCorners = 0;
  let edge = 0;
  for (let corner = 0; corner < 4; corner += 1) {
    const value = color[point + diagonals[corner]];
    if (value === OFF_BOARD) {
      edge = 1;
    } else if (value === enemy) {
      enemyCorners += 1;
    }
  }
  return enemyCorners + edge < 2;
}

function emptyNeighborCount(position, point) {
  const { color, layout } = position;
  let count = 0;
  for (let side = 0; side < 4; side += 1) {
    if (color[point + layout.offsets[side]] === EMPTY) {
      count += 1;
    }
  }
  return count;
}

function collectLiberties(position, groupHead, limit, output) {
  const { color, next, layout } = position;
  const { offsets, workspace } = layout;
  const mark = workspace.libertyMark;
  const stamp = nextStamp(workspace);
  let count = 0;
  let stone = groupHead;

  do {
    for (let side = 0; side < 4; side += 1) {
      const neighbor = stone + offsets[side];
      if (color[neighbor] === EMPTY && mark[neighbor] !== stamp) {
        mark[neighbor] = stamp;
        if (output !== undefined) {
          output[count] = neighbor;
        }
        count += 1;
        if (count >= limit) {
          return count;
        }
      }
    }
    stone = next[stone];
  } while (stone !== groupHead);

  return count;
}

function countLiberties(position, groupHead, limit) {
  return collectLiberties(position, groupHead, limit, undefined);
}

// True when a non-capturing move leaves a group of two or more stones in atari.
function isGroupSelfAtari(position, point, player) {
  const { color, head, next, layout } = position;
  const { offsets } = layout;
  const enemy = opponentOf(player);
  let liberty = 0;

  for (let side = 0; side < 4; side += 1) {
    const neighbor = point + offsets[side];
    const value = color[neighbor];
    if (value === EMPTY) {
      if (liberty !== 0) {
        return false;
      }
      liberty = neighbor;
    } else if (value === enemy && inAtari(position, head[neighbor])) {
      return false;
    }
  }

  let connected = false;
  let previous = -1;
  for (let side = 0; side < 4; side += 1) {
    const neighbor = point + offsets[side];
    if (color[neighbor] !== player || head[neighbor] === previous) {
      continue;
    }
    const groupHead = head[neighbor];
    previous = groupHead;
    connected = true;
    let stone = groupHead;
    do {
      for (let around = 0; around < 4; around += 1) {
        const candidate = stone + offsets[around];
        if (color[candidate] === EMPTY && candidate !== point && candidate !== liberty) {
          if (liberty !== 0) {
            return false;
          }
          liberty = candidate;
        }
      }
      stone = next[stone];
    } while (stone !== groupHead);
  }
  return connected;
}

function isPlayoutCandidate(position, point, player) {
  return (
    !isEyeLike(position, point, player) &&
    isLegalPoint(position, point, player) &&
    !isGroupSelfAtari(position, point, player)
  );
}

function pickRandomMove(position, player, random) {
  const count = position.emptyCount;
  if (count === 0) {
    return 0;
  }

  const { empties } = position;
  let index = Math.floor(random() * count);
  for (let tried = 0; tried < count; tried += 1) {
    const point = empties[index];
    if (isPlayoutCandidate(position, point, player)) {
      return point;
    }
    index = index + 1 === count ? 0 : index + 1;
  }
  return 0;
}

function captureNear(position, player, point) {
  const { color, head, layout } = position;
  const enemy = opponentOf(player);
  for (let side = 0; side < 4; side += 1) {
    const neighbor = point + layout.offsets[side];
    if (color[neighbor] === enemy && inAtari(position, head[neighbor])) {
      const liberty = atariPoint(position, head[neighbor]);
      if (isLegalPoint(position, liberty, player)) {
        return liberty;
      }
    }
  }
  return 0;
}

function escapeNear(position, player, point) {
  const { color, head, layout } = position;
  for (let side = 0; side < 4; side += 1) {
    const neighbor = point + layout.offsets[side];
    if (color[neighbor] !== player || !inAtari(position, head[neighbor])) {
      continue;
    }
    const liberty = atariPoint(position, head[neighbor]);
    const roomy = emptyNeighborCount(position, liberty) >= 2;
    if (roomy && isLegalPoint(position, liberty, player)) {
      return liberty;
    }
  }
  return 0;
}

function urgentReply(position, player, lastMove, ownMove) {
  const { color, head } = position;
  if (lastMove > 0) {
    if (color[lastMove] === opponentOf(player) && inAtari(position, head[lastMove])) {
      const liberty = atariPoint(position, head[lastMove]);
      if (isLegalPoint(position, liberty, player)) {
        return liberty;
      }
    }
    const escape = escapeNear(position, player, lastMove);
    if (escape > 0) {
      return escape;
    }
  }
  return ownMove > 0 ? captureNear(position, player, ownMove) : 0;
}

function runPlayout(position, random, maxMoves, lastMove) {
  let previous = lastMove;
  let ownPrevious = 0;
  let passes = 0;

  for (let moves = 0; moves < maxMoves && passes < 2; moves += 1) {
    const player = position.turn;
    let point = urgentReply(position, player, previous, ownPrevious);
    if (point === 0) {
      point = pickRandomMove(position, player, random);
    }

    if (point === 0) {
      passes += 1;
      position.ko = 0;
      position.turn = opponentOf(player);
    } else {
      placeStone(position, point, player);
      passes = 0;
    }
    ownPrevious = previous;
    previous = point;
  }
}

// Owner of every point after a playout: stones, plus empty regions touching one colour.
function markOwners(position) {
  const { color, layout } = position;
  const { area, toInner, offsets, workspace } = layout;
  const { queue, regionMark, owners } = workspace;
  const stamp = nextStamp(workspace);
  let balance = 0;

  for (let outer = 0; outer < area; outer += 1) {
    const start = toInner[outer];
    const value = color[start];
    if (value !== EMPTY) {
      owners[start] = value;
      balance += value === BLACK ? 1 : -1;
      continue;
    }
    if (regionMark[start] === stamp) {
      continue;
    }

    let tail = 1;
    let borders = 0;
    queue[0] = start;
    regionMark[start] = stamp;
    for (let index = 0; index < tail; index += 1) {
      for (let side = 0; side < 4; side += 1) {
        const neighbor = queue[index] + offsets[side];
        const around = color[neighbor];
        if (around === BLACK || around === WHITE) {
          borders |= around;
        } else if (around === EMPTY && regionMark[neighbor] !== stamp) {
          regionMark[neighbor] = stamp;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
    }

    const owner = borders === BLACK || borders === WHITE ? borders : EMPTY;
    for (let index = 0; index < tail; index += 1) {
      owners[queue[index]] = owner;
    }
    if (owner !== EMPTY) {
      balance += owner === BLACK ? tail : -tail;
    }
  }
  return balance;
}

function areaScore(position, komi) {
  return markOwners(position) - komi;
}

function lastMoveOf(game, layout) {
  return Number.isInteger(game.lastMove) ? layout.toInner[game.lastMove] : 0;
}

function collectOwnership(root, playouts, random, deadline, lastMove) {
  const { layout } = root;
  const { area, toInner } = layout;
  const { owners } = layout.workspace;
  const black = new Int32Array(area);
  const white = new Int32Array(area);
  const work = createPosition(layout);
  const maxMoves = area * 3;
  let completed = 0;

  while (completed < playouts && (completed < 8 || now() < deadline)) {
    copyPosition(work, root);
    runPlayout(work, random, maxMoves, lastMove);
    markOwners(work);
    for (let outer = 0; outer < area; outer += 1) {
      const owner = owners[toInner[outer]];
      if (owner === BLACK) {
        black[outer] += 1;
      } else if (owner === WHITE) {
        white[outer] += 1;
      }
    }
    completed += 1;
  }

  return { black, white, playouts: completed };
}

function enemyShares(position, ownership) {
  const { layout, color, head, next } = position;
  const { area, toInner, toOuter } = layout;
  const shares = new Float64Array(layout.length);

  for (let outer = 0; outer < area; outer += 1) {
    const groupHead = toInner[outer];
    const value = color[groupHead];
    if ((value !== BLACK && value !== WHITE) || head[groupHead] !== groupHead) {
      continue;
    }

    const enemyCounts = value === BLACK ? ownership.white : ownership.black;
    let owned = 0;
    let count = 0;
    let stone = groupHead;
    do {
      owned += enemyCounts[toOuter[stone]];
      count += 1;
      stone = next[stone];
    } while (stone !== groupHead);
    shares[groupHead] = owned / (count * ownership.playouts);
  }
  return shares;
}

// Stones sharing an enemy-walled enclosure with `groupHead`, or null if they could live.
function enclosedStones(position, groupHead, shares) {
  const { layout, color, head } = position;
  const { offsets, area } = layout;
  const player = color[groupHead];
  const enemy = opponentOf(player);
  const seen = new Set([groupHead]);
  const queue = [groupHead];
  const stones = [];
  let space = 0;
  let eyes = 0;
  let walled = false;

  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    if (color[point] === player) {
      stones.push(point);
    } else {
      space += 1;
      if (isEyeLike(position, point, player)) {
        eyes += 1;
      }
    }
    for (let side = 0; side < 4; side += 1) {
      const neighbor = point + offsets[side];
      const value = color[neighbor];
      if (value === enemy) {
        if (shares[head[neighbor]] > ENCLOSURE_WEAKNESS) {
          return null;
        }
        walled = true;
      } else if (value !== OFF_BOARD && !seen.has(neighbor)) {
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return walled && eyes < 2 && space <= area / 2 ? stones : null;
}

function findDeadStones(position, ownership) {
  const { layout, color, head, next } = position;
  const { area, toInner } = layout;
  const shares = enemyShares(position, ownership);
  const dead = new Uint8Array(layout.length);

  for (let outer = 0; outer < area; outer += 1) {
    const groupHead = toInner[outer];
    const value = color[groupHead];
    if ((value !== BLACK && value !== WHITE) || head[groupHead] !== groupHead) {
      continue;
    }

    const share = shares[groupHead];
    if (share > DEAD_OWNERSHIP) {
      let stone = groupHead;
      do {
        dead[stone] = 1;
        stone = next[stone];
      } while (stone !== groupHead);
    } else if (share >= DOUBTFUL_OWNERSHIP) {
      enclosedStones(position, groupHead, shares)?.forEach((stone) => {
        dead[stone] = 1;
      });
    }
  }
  return dead;
}

function deadPoints(position, dead) {
  const { area, toInner } = position.layout;
  const points = [];
  for (let outer = 0; outer < area; outer += 1) {
    if (dead[toInner[outer]] === 1) {
      points.push(outer);
    }
  }
  return points;
}

export function estimateDeadStones(game, options = {}) {
  assertGame(game);
  const { playouts, random = Math.random } = options ?? {};
  if (playouts !== undefined && !isIntegerInRange(playouts, 1, 100000)) {
    throw new RangeError("模拟次数必须是正整数");
  }
  if (typeof random !== "function") {
    throw new TypeError("random 必须是函数");
  }
  if (game.board.every((value) => value === EMPTY)) {
    return [];
  }

  const root = positionFromGame(game);
  const deadline = playouts === undefined ? now() + DEAD_STONE_TIME_LIMIT : Infinity;
  const ownership = collectOwnership(
    root,
    playouts ?? DEAD_STONE_PLAYOUTS[game.size],
    random,
    deadline,
    lastMoveOf(game, root.layout),
  );
  return deadPoints(root, findDeadStones(root, ownership));
}

function canCaptureNeighbor(position, groupHead, attacker) {
  const { color, head, next, layout } = position;
  let stone = groupHead;

  do {
    for (let side = 0; side < 4; side += 1) {
      const neighbor = stone + layout.offsets[side];
      if (color[neighbor] === attacker && inAtari(position, head[neighbor])) {
        return true;
      }
    }
    stone = next[stone];
  } while (stone !== groupHead);

  return false;
}

function ladderBudget() {
  return { nodes: LADDER_NODE_LIMIT };
}

// Defender to move with the group of `stone` in atari: can it run or capture its way out?
function canEscape(position, stone, depth, budget) {
  const { color, head, layout } = position;
  const defender = color[stone];
  const attacker = opponentOf(defender);
  const groupHead = head[stone];
  if (canCaptureNeighbor(position, groupHead, attacker)) {
    return true;
  }

  budget.nodes -= 1;
  if (budget.nodes <= 0 || depth > LADDER_DEPTH_LIMIT) {
    return true;
  }

  const liberty = atariPoint(position, groupHead);
  if (!isLegalPoint(position, liberty, defender)) {
    return false;
  }

  const extended = poolPosition(layout, depth * 2);
  copyPosition(extended, position);
  placeStone(extended, liberty, defender);
  const targets = [0, 0, 0];
  const count = collectLiberties(extended, extended.head[stone], 3, targets);
  if (count !== 2) {
    return count > 2;
  }

  for (let index = 0; index < 2; index += 1) {
    const target = targets[index];
    if (!isLegalPoint(extended, target, attacker)) {
      continue;
    }
    const chased = poolPosition(layout, depth * 2 + 1);
    copyPosition(chased, extended);
    placeStone(chased, target, attacker);
    if (inAtari(chased, chased.head[target])) {
      continue;
    }
    if (!canEscape(chased, stone, depth + 1, budget)) {
      return false;
    }
  }
  return true;
}

// Attacker to move against the group of `stone` that has exactly two liberties.
function isLadderCaptured(position, stone, budget) {
  const { color, head, layout } = position;
  const attacker = opponentOf(color[stone]);
  const targets = [0, 0, 0];
  const count = collectLiberties(position, head[stone], 3, targets);
  if (count !== 2) {
    return count < 2;
  }

  for (let index = 0; index < 2; index += 1) {
    const target = targets[index];
    if (!isLegalPoint(position, target, attacker)) {
      continue;
    }
    const chased = poolPosition(layout, 1);
    copyPosition(chased, position);
    placeStone(chased, target, attacker);
    if (inAtari(chased, chased.head[target])) {
      continue;
    }
    if (!canEscape(chased, stone, 1, budget)) {
      return true;
    }
  }
  return false;
}

function groupLifeOf(position, groupHead, ownMe, me) {
  const { next, color } = position;
  const sign = color[groupHead] === me ? 1 : -1;
  let total = 0;
  let count = 0;
  let stone = groupHead;

  do {
    total += ownMe[stone] * sign;
    count += 1;
    stone = next[stone];
  } while (stone !== groupHead);

  return total / count;
}

function spreadInfluence(position, influence, origin, amount) {
  const { color, layout } = position;
  const { offsets, workspace } = layout;
  const { queue, distance, regionMark } = workspace;
  const stamp = nextStamp(workspace);
  let tail = 1;
  queue[0] = origin;
  distance[origin] = 0;
  regionMark[origin] = stamp;

  for (let index = 0; index < tail; index += 1) {
    const current = queue[index];
    const step = distance[current] + 1;
    if (step >= INFLUENCE_DECAY.length) {
      continue;
    }
    for (let side = 0; side < 4; side += 1) {
      const neighbor = current + offsets[side];
      if (color[neighbor] !== EMPTY || regionMark[neighbor] === stamp) {
        continue;
      }
      regionMark[neighbor] = stamp;
      distance[neighbor] = step;
      queue[tail] = neighbor;
      tail += 1;
      influence[neighbor] += amount * INFLUENCE_DECAY[step];
    }
  }
}

function groupStrength(liberties, isDead) {
  const base = liberties <= 1 ? 0.25 : liberties === 2 ? 0.6 : 1;
  return isDead ? base * 0.2 : base;
}

function isTransparent(position, dead, point) {
  return position.color[point] === EMPTY || dead[point] === 1;
}

function regionDepth(position, dead, region, regionOf, id) {
  const { layout } = position;
  const { offsets } = layout;
  const { distance } = layout.workspace;
  const queue = [];

  for (const point of region) {
    distance[point] = 0;
    for (let side = 0; side < 4; side += 1) {
      const neighbor = point + offsets[side];
      const value = position.color[neighbor];
      if (value !== OFF_BOARD && !isTransparent(position, dead, neighbor)) {
        distance[point] = 1;
      }
    }
    if (distance[point] === 1) {
      queue.push(point);
    }
  }

  let deepest = 1;
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    deepest = Math.max(deepest, distance[point]);
    for (let side = 0; side < 4; side += 1) {
      const neighbor = point + offsets[side];
      if (regionOf[neighbor] === id && distance[neighbor] === 0) {
        distance[neighbor] = distance[point] + 1;
        queue.push(neighbor);
      }
    }
  }
  return deepest;
}

// Regions (dead stones count as empty) walled by one healthy colour, too small to invade.
function classifyRegions(position, dead, groupLife, groupLiberties, me) {
  const { layout, color, head } = position;
  const { area, toInner, offsets, length } = layout;
  const settled = new Int8Array(length);
  const regionOf = new Int32Array(length);
  let id = 0;

  for (let outer = 0; outer < area; outer += 1) {
    const start = toInner[outer];
    if (regionOf[start] !== 0 || !isTransparent(position, dead, start)) {
      continue;
    }

    id += 1;
    const region = [start];
    let borders = 0;
    let healthy = true;
    regionOf[start] = id;
    for (let index = 0; index < region.length; index += 1) {
      for (let side = 0; side < 4; side += 1) {
        const neighbor = region[index] + offsets[side];
        const value = color[neighbor];
        if (value === OFF_BOARD || regionOf[neighbor] === id) {
          continue;
        }
        if (isTransparent(position, dead, neighbor)) {
          regionOf[neighbor] = id;
          region.push(neighbor);
        } else {
          borders |= value;
          const groupHead = head[neighbor];
          healthy &&=
            groupLiberties[groupHead] >= 3 && groupLife[groupHead] >= HEALTHY_LIFE;
        }
      }
    }

    if ((borders !== BLACK && borders !== WHITE) || !healthy) {
      continue;
    }
    if (
      region.length > SETTLED_SIZE &&
      regionDepth(position, dead, region, regionOf, id) > SETTLED_DEPTH
    ) {
      continue;
    }
    const mark = borders === me ? 1 : -1;
    region.forEach((point) => {
      settled[point] = mark;
    });
  }
  return settled;
}

function analyzePosition(game, level, random, start, budget) {
  const root = positionFromGame(game);
  const { layout } = root;
  const { area, toInner, length } = layout;
  const me = game.turn;
  const ownership = collectOwnership(
    root,
    OWNERSHIP_PLAYOUTS[game.size][level],
    random,
    start + budget * OWNERSHIP_TIME_SHARE,
    lastMoveOf(game, layout),
  );

  const ownMe = new Float64Array(length);
  const mine = me === BLACK ? ownership.black : ownership.white;
  const theirs = me === BLACK ? ownership.white : ownership.black;
  for (let outer = 0; outer < area; outer += 1) {
    ownMe[toInner[outer]] = (mine[outer] - theirs[outer]) / ownership.playouts;
  }

  const dead = findDeadStones(root, ownership);
  const groupLiberties = new Int32Array(length);
  const groupLife = new Float64Array(length);
  const influence = new Float64Array(length);
  const ownAtari = [];
  for (let outer = 0; outer < area; outer += 1) {
    const point = toInner[outer];
    const value = root.color[point];
    if ((value !== BLACK && value !== WHITE) || root.head[point] !== point) {
      continue;
    }

    groupLiberties[point] = countLiberties(root, point, 4);
    groupLife[point] = groupLifeOf(root, point, ownMe, me);
    if (value === me && groupLiberties[point] === 1) {
      ownAtari.push(point);
    }
  }

  for (let outer = 0; outer < area; outer += 1) {
    const point = toInner[outer];
    const value = root.color[point];
    if (value === BLACK || value === WHITE) {
      const groupHead = root.head[point];
      const strength = groupStrength(groupLiberties[groupHead], dead[groupHead] === 1);
      spreadInfluence(root, influence, point, value === me ? strength : -strength);
    }
  }

  return {
    game,
    level,
    random,
    root,
    layout,
    scratch: createPosition(layout),
    me,
    enemy: opponentOf(me),
    ownership,
    ownMe,
    dead,
    groupLiberties,
    groupLife,
    influence,
    ownAtari,
    settled: classifyRegions(root, dead, groupLife, groupLiberties, me),
    early: game.moveNumber < area / 6,
    deadline: start + budget,
  };
}

function lineOf(size, index) {
  return Math.min(index, size - 1 - index) + 1;
}

function openingValue(size, row, column) {
  const low = Math.min(lineOf(size, row), lineOf(size, column));
  const high = Math.max(lineOf(size, row), lineOf(size, column));
  if (low === 1) {
    return -3;
  }
  if (low === 2) {
    return -1.5;
  }
  if (size === 9) {
    if (low === 5 || high === 3) {
      return 2.5;
    }
    return high === 4 ? 2 : 1;
  }
  if (high <= 4) {
    return high === 3 ? 2 : 3;
  }
  if (high === 5 && low <= 4) {
    return 2;
  }
  return low <= 4 ? 1.5 : 0.5;
}

function isQuietArea(board, size, row, column) {
  const radius = QUIET_RADIUS[size];
  const top = Math.max(0, row - radius);
  const bottom = Math.min(size - 1, row + radius);
  const left = Math.max(0, column - radius);
  const right = Math.min(size - 1, column + radius);
  for (let r = top; r <= bottom; r += 1) {
    for (let c = left; c <= right; c += 1) {
      if (board[r * size + c] !== EMPTY) {
        return false;
      }
    }
  }
  return true;
}

function shapeValue(context, outer) {
  const { game, early } = context;
  const { size, board } = game;
  const row = Math.floor(outer / size);
  const column = outer % size;
  if (isQuietArea(board, size, row, column)) {
    return openingValue(size, row, column);
  }
  if (!early) {
    return 0;
  }

  const low = Math.min(lineOf(size, row), lineOf(size, column));
  if (low === 1) {
    return WEIGHTS.earlyFirstLine;
  }
  return low === 2 ? WEIGHTS.earlySecondLine : 0;
}

function formsEmptyTriangle(position, point, player) {
  const { color, layout } = position;
  const { stride } = layout;
  for (const vertical of [-stride, stride]) {
    for (const horizontal of [-1, 1]) {
      if (
        color[point + vertical] === player &&
        color[point + horizontal] === player &&
        color[point + vertical + horizontal] === EMPTY
      ) {
        return true;
      }
    }
  }
  return false;
}

function uncertaintyAt(ownMe, point) {
  const value = ownMe[point];
  return 1 - value * value;
}

function positionalValue(context, point) {
  const { root, influence, ownMe, layout } = context;
  const { color } = root;
  const { offsets, workspace, lineValue } = layout;
  const { queue, distance, regionMark } = workspace;
  const stamp = nextStamp(workspace);
  const claimed = 1 - clampUnit(influence[point]);
  let gain = claimed * uncertaintyAt(ownMe, point) * lineValue[point];
  let tail = 1;
  queue[0] = point;
  distance[point] = 0;
  regionMark[point] = stamp;

  for (let index = 0; index < tail; index += 1) {
    const current = queue[index];
    const step = distance[current] + 1;
    if (step >= INFLUENCE_DECAY.length) {
      continue;
    }
    for (let side = 0; side < 4; side += 1) {
      const neighbor = current + offsets[side];
      if (color[neighbor] !== EMPTY || regionMark[neighbor] === stamp) {
        continue;
      }
      regionMark[neighbor] = stamp;
      distance[neighbor] = step;
      queue[tail] = neighbor;
      tail += 1;
      const before = clampUnit(influence[neighbor]);
      const after = clampUnit(influence[neighbor] + INFLUENCE_DECAY[step]);
      gain += (after - before) * uncertaintyAt(ownMe, neighbor) * lineValue[neighbor];
    }
  }
  return gain;
}

function rescueValue(context, captured) {
  const { scratch, ownAtari, level, root, dead } = context;
  let value = 0;

  for (const groupHead of ownAtari) {
    const liberties = countLiberties(scratch, scratch.head[groupHead], 3);
    if (liberties < 2) {
      continue;
    }
    if (
      liberties === 2 &&
      level >= 2 &&
      captured === 0 &&
      isLadderCaptured(scratch, groupHead, ladderBudget())
    ) {
      continue;
    }

    const saved = WEIGHTS.rescueBase + WEIGHTS.rescuePerStone * root.stones[groupHead];
    value += dead[groupHead] === 1 && liberties === 2 ? 0 : saved;
  }
  return value;
}

function weaknessOf(life) {
  return Math.min(1, Math.max(0, (0.6 - life) / 1.2));
}

function threatValue(context, point) {
  const { scratch, root, enemy, level, groupLife, dead, layout } = context;
  const { color, head } = scratch;
  let ladder = 0;
  let pressure = 0;
  const seen = [];

  for (let side = 0; side < 4; side += 1) {
    const neighbor = point + layout.offsets[side];
    const isTarget = color[neighbor] === enemy && dead[neighbor] === 0;
    if (!isTarget || seen.includes(head[neighbor])) {
      continue;
    }
    const groupHead = head[neighbor];
    seen.push(groupHead);

    const weakness = weaknessOf(groupLife[root.head[neighbor]]);
    const size = scratch.stones[groupHead];
    if (inAtari(scratch, groupHead)) {
      const escapes = level < 2 || canEscape(scratch, neighbor, 1, ladderBudget());
      if (escapes) {
        pressure += WEIGHTS.atariBase + WEIGHTS.atariPerStone * size;
        pressure += weakness * (WEIGHTS.attackBase + WEIGHTS.attackPerStone * size);
      } else {
        ladder += WEIGHTS.ladderBase + WEIGHTS.ladderPerStone * size;
      }
      continue;
    }

    const liberties = countLiberties(scratch, groupHead, 4);
    if (liberties === 2) {
      pressure += (WEIGHTS.reduceBase + WEIGHTS.reducePerStone * size) * (0.3 + weakness);
    } else if (liberties === 3) {
      pressure += weakness * (WEIGHTS.attackBase + WEIGHTS.attackPerStone * size) * 0.5;
    }
  }
  return { ladder, pressure };
}

function supportValue(context, point, ownLiberties) {
  const { root, me, enemy, groupLiberties, groupLife, dead, layout } = context;
  const { color, head } = root;
  const ownGroups = [];
  const enemyGroups = [];
  let value = 0;

  for (let side = 0; side < 4; side += 1) {
    const neighbor = point + layout.offsets[side];
    const groupHead = head[neighbor];
    if (color[neighbor] === me && !ownGroups.includes(groupHead)) {
      ownGroups.push(groupHead);
    } else if (color[neighbor] === enemy && !enemyGroups.includes(groupHead)) {
      enemyGroups.push(groupHead);
    }
  }

  let weakest = 0;
  for (const groupHead of ownGroups) {
    if (dead[groupHead] === 1) {
      continue;
    }
    const weakness = weaknessOf(groupLife[groupHead]);
    const size = root.stones[groupHead];
    const gained = ownLiberties - groupLiberties[groupHead];
    weakest = Math.max(weakest, weakness);
    if (groupLiberties[groupHead] === 2 && ownLiberties >= 3) {
      value += (WEIGHTS.defendBase + WEIGHTS.defendPerStone * size) * (0.3 + weakness);
    } else if (gained > 0) {
      const urgency = WEIGHTS.attackBase + WEIGHTS.attackPerStone * size;
      value += weakness * urgency * gained * 0.5;
    }
  }
  if (ownGroups.length >= 2) {
    value += WEIGHTS.connect * (ownGroups.length - 1) * (0.3 + weakest);
  }

  if (enemyGroups.length >= 2 && ownLiberties >= 2) {
    const weaknesses = enemyGroups
      .filter((groupHead) => dead[groupHead] === 0)
      .map((groupHead) => weaknessOf(groupLife[groupHead]));
    value += WEIGHTS.cut * (0.5 + Math.max(0, ...weaknesses));
  }
  return value;
}

function proximityValue(game, outer) {
  if (!Number.isInteger(game.lastMove)) {
    return 0;
  }
  const { size, lastMove } = game;
  const distance =
    Math.abs(Math.floor(outer / size) - Math.floor(lastMove / size)) +
    Math.abs((outer % size) - (lastMove % size));
  if (distance <= 2) {
    return WEIGHTS.nearLastMove;
  }
  return distance === 3 ? WEIGHTS.nearLastMove / 2 : 0;
}

function evaluateMove(context, point, outer) {
  const { root, scratch, me, ownMe, settled, game } = context;
  copyPosition(scratch, root);
  const captured = placeStone(scratch, point, me);
  const ownHead = scratch.head[point];
  const ownLiberties = countLiberties(scratch, ownHead, 4);
  const ownSize = scratch.stones[ownHead];
  if (captured === 0 && ownLiberties === 1 && ownSize > 1) {
    return null;
  }

  let urgent = rescueValue(context, captured);
  if (captured > 0) {
    urgent += WEIGHTS.captureBase + WEIGHTS.capturePerStone * captured;
  }
  if (settled[point] < 0 && urgent === 0) {
    return null;
  }
  const threat = threatValue(context, point);
  let score = urgent + threat.ladder;

  if (captured === 0 && ownLiberties === 1) {
    score += WEIGHTS.selfAtari;
  } else if (captured === 0 && ownLiberties === 2 && urgent === 0) {
    score += WEIGHTS.shortOfLiberties;
    if (context.level >= 2 && isLadderCaptured(scratch, point, ladderBudget())) {
      score += WEIGHTS.ladderedBase + WEIGHTS.ladderedPerStone * ownSize;
    }
  }

  if (settled[point] > 0 || Math.abs(ownMe[point]) >= SECURE_OWNERSHIP) {
    score += WEIGHTS.secureArea;
  } else {
    score += threat.pressure + supportValue(context, point, ownLiberties);
    score += positionalValue(context, point) + shapeValue(context, outer);
    score += proximityValue(game, outer);
    if (formsEmptyTriangle(root, point, me)) {
      score += WEIGHTS.emptyTriangle;
    }
  }

  return { point, outer, urgent, base: score, score };
}

function rankCandidates(context, threshold) {
  const { root, layout, me, level, random, deadline } = context;
  const candidates = [];

  for (let outer = 0; outer < layout.area; outer += 1) {
    const point = layout.toInner[outer];
    if (!isLegalPoint(root, point, me) || isEyeLike(root, point, me)) {
      continue;
    }
    const candidate = evaluateMove(context, point, outer);
    if (candidate !== null && candidate.score >= threshold) {
      candidates.push(candidate);
    }
    if (now() > deadline) {
      break;
    }
  }

  for (const candidate of candidates) {
    if (candidate.urgent < URGENT_THRESHOLD) {
      candidate.score += random() * LEVEL_NOISE[level];
    }
  }
  return candidates.sort(
    (left, right) => right.score - left.score || left.outer - right.outer,
  );
}

function acceptsEnding(context, playable) {
  const { game, me, root, dead } = context;
  return (
    game.lastMove === "pass" &&
    playable.every((candidate) => candidate.base < SETTLED_MOVE_VALUE) &&
    scoreGame(game, deadPoints(root, dead)).winner === me
  );
}

function pickCasualMove(playable) {
  const urgent = playable.filter((candidate) => candidate.urgent >= URGENT_THRESHOLD);
  if (urgent.length === 0) {
    return playable[0];
  }
  return urgent.reduce((best, candidate) =>
    candidate.score > best.score ? candidate : best,
  );
}

function playoutReward(margin, size) {
  return (margin > 0 ? 0.85 : 0) + 0.15 * (0.5 + 0.5 * Math.tanh(margin / size));
}

function selectArm(visits, rewards, total) {
  const logTotal = Math.log(total);
  let best = 0;
  let bestValue = -Infinity;
  for (let arm = 0; arm < visits.length; arm += 1) {
    const value =
      rewards[arm] / visits[arm] + SEARCH_EXPLORATION * Math.sqrt(logTotal / visits[arm]);
    if (value > bestValue) {
      best = arm;
      bestValue = value;
    }
  }
  return best;
}

function searchCandidates(context, playable) {
  const { root, layout, me, game, random, deadline } = context;
  const settings = SEARCH_SETTINGS[game.size];
  const pool = playable.slice(0, settings.candidates);
  if (pool.length === 1) {
    return pool[0];
  }

  const work = createPosition(layout);
  const visits = new Float64Array(pool.length);
  const rewards = new Float64Array(pool.length);
  const maxMoves = layout.area * 3;
  const sign = me === BLACK ? 1 : -1;
  let total = 0;

  while (now() < deadline) {
    const arm =
      total < pool.length * SEARCH_MIN_VISITS
        ? total % pool.length
        : selectArm(visits, rewards, total);
    copyPosition(work, root);
    placeStone(work, pool[arm].point, me);
    runPlayout(work, random, maxMoves, pool[arm].point);
    rewards[arm] += playoutReward(sign * areaScore(work, game.komi), game.size);
    visits[arm] += 1;
    total += 1;
  }

  const topScore = pool[0].score;
  let best = pool[0];
  let bestValue = -Infinity;
  for (let arm = 0; arm < pool.length; arm += 1) {
    if (visits[arm] < SEARCH_MIN_VISITS) {
      continue;
    }
    const prior = (settings.priorWeight * (pool[arm].score - topScore)) / 10;
    const value = rewards[arm] / visits[arm] + prior;
    if (value > bestValue) {
      best = pool[arm];
      bestValue = value;
    }
  }
  return best;
}

export function chooseAiMove(game, options = {}) {
  assertGame(game);
  const { level = 2, timeLimitMs, random = Math.random } = options ?? {};
  if (!AI_LEVELS.includes(level)) {
    throw new RangeError("AI 等级只能是 1、2 或 3");
  }
  const budget = timeLimitMs ?? DEFAULT_TIME_LIMITS[level];
  if (typeof budget !== "number" || !(budget > 0)) {
    throw new RangeError("思考时间必须是正数");
  }
  if (typeof random !== "function") {
    throw new TypeError("random 必须是函数");
  }
  if (game.over) {
    return "pass";
  }

  const context = analyzePosition(game, level, random, now(), budget);
  const threshold = game.lastMove === "pass" ? REPLY_TO_PASS_THRESHOLD : PASS_THRESHOLD;
  const playable = rankCandidates(context, threshold);
  if (playable.length === 0 || acceptsEnding(context, playable)) {
    return "pass";
  }

  let choice = playable[0];
  if (level === 1) {
    choice = pickCasualMove(playable);
  } else if (level === 3) {
    choice = searchCandidates(context, playable);
  }
  return resolveMove(game, choice.outer).reason === undefined ? choice.outer : "pass";
}
