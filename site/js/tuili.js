export const LEVELS = Object.freeze([1, 2, 3, 4]);
export const LEVEL_SIZES = Object.freeze({ 1: 3, 2: 3, 3: 3, 4: 4 });
export const COLOR_NAMES = Object.freeze(["朱", "墨", "青", "金"]);
export const SHAPE_NAMES = Object.freeze(["圆", "方", "角", "菱"]);

const SIZES = Object.freeze([3, 4]);
const COLOR_WORDS = Object.freeze(["朱色", "墨色", "青色", "金色"]);
const SHAPE_WORDS = Object.freeze(["圆形", "方块", "三角", "菱形"]);
const NUMERALS = Object.freeze(["一", "二", "三", "四"]);
const SMALL_CELL_NAMES = Object.freeze(["左上", "正上", "右上", "左中", "正中", "右中", "左下", "正下", "右下"]);
const SMALL_COLUMN_NAMES = Object.freeze(["左边一列", "中间一列", "右边一列"]);
const AXES = Object.freeze(["row", "col"]);
const DIRECTIONS = Object.freeze(["right", "down"]);
const ATTRIBUTES = Object.freeze(["color", "shape"]);
const CLUE_KEYS = Object.freeze({
  at: "cell,color,shape,type",
  notIn: "color,line,shape,type",
  corners: "color,shape,type",
  adjacent: "a,b,dir,type",
  distinct: "attr,line,type",
  sameLine: "a,axis,b,type",
});
const PUZZLE_ID = /^[a-z0-9-]{1,64}$/;
const MAX_CLUES = 30;
const PROBE_FLAG = 1 << MAX_CLUES;
const CLUE_BITS = PROBE_FLAG - 1;
const MAX_TIER = 4;
const TYPE_RANKS = Object.freeze({
  at: 1,
  notIn: 1,
  corners: 1,
  adjacent: 2,
  distinct: 3,
  sameLine: 4,
});
const PROBE_RANK = 5;
const RANK_TIERS = Object.freeze([1, 1, 2, 3, 3, 4]);
const RANK_TECHNIQUES = Object.freeze({
  2: "adjacent",
  3: "line",
  4: "same-line",
  5: "contradiction",
});
const TECHNIQUES = Object.freeze([
  "direct",
  "only-tile-here",
  "only-place-for-tile",
  "adjacent",
  "line",
  "same-line",
  "contradiction",
]);
const CHECK_BUDGET = 400;
const SUGGESTION_SIZE = 3;
const GENERATION_ATTEMPTS = 500;
const CATEGORIES = Object.freeze([
  "atFull",
  "atPartial",
  "notIn",
  "corners",
  "adjacent",
  "sameLine",
  "distinct",
]);
const LEVEL_RULES = Object.freeze({
  1: levelRule({
    tiers: [1],
    clues: [4, 7],
    fullAt: [2, 9],
    partialAt: 9,
    types: 1,
    stepClues: 3,
    weights: { atFull: 3, atPartial: 2, notIn: 3, corners: 3 },
  }),
  2: levelRule({
    tiers: [2],
    clues: [4, 6],
    fullAt: [0, 1],
    partialAt: 9,
    types: 2,
    stepClues: 4,
    weights: { atFull: 1, atPartial: 1, notIn: 2, corners: 2, adjacent: 6 },
  }),
  3: levelRule({
    tiers: [3],
    clues: [4, 7],
    fullAt: [0, 0],
    partialAt: 1,
    types: 3,
    stepClues: 5,
    weights: { atPartial: 1, notIn: 2, corners: 2, adjacent: 4, sameLine: 3, distinct: 12 },
  }),
  4: levelRule({
    tiers: [3, 4],
    clues: [7, 12],
    fullAt: [0, 0],
    partialAt: 4,
    types: 3,
    stepClues: 6,
    weights: { atPartial: 1, notIn: 1, corners: 1, adjacent: 8, sameLine: 2, distinct: 3 },
  }),
});
const GEOMETRIES = Object.freeze({ 3: createGeometry(3), 4: createGeometry(4) });

function levelRule({ tiers, clues, fullAt, partialAt, types, stepClues, weights }) {
  return Object.freeze({
    maxStepClues: stepClues,
    solveTier: Math.min(Math.max(...tiers), 3),
    polishTier: Math.max(...tiers),
    tiers: Object.freeze(tiers),
    minClues: clues[0],
    maxClues: clues[1],
    minFullAt: fullAt[0],
    maxFullAt: fullAt[1],
    maxPartialAt: partialAt,
    minTypes: types,
    weights: Object.freeze(weights),
  });
}

function createGeometry(size) {
  const count = size * size;
  const rows = [];
  const cols = [];
  for (let index = 0; index < size; index += 1) {
    let row = 0;
    let col = 0;
    for (let offset = 0; offset < size; offset += 1) {
      row |= 1 << (index * size + offset);
      col |= 1 << (offset * size + index);
    }
    rows.push(row);
    cols.push(col);
  }

  return Object.freeze({
    size,
    count,
    full: 2 ** count - 1,
    lines: Object.freeze({ row: Object.freeze(rows), col: Object.freeze(cols) }),
    corners: 1 | (1 << (size - 1)) | (1 << (count - size)) | (1 << (count - 1)),
    groups: Object.freeze({
      color: attributeGroups(size, "color"),
      shape: attributeGroups(size, "shape"),
    }),
  });
}

function attributeGroups(size, attribute) {
  const groups = Array(size).fill(0);
  for (let tile = 0; tile < size * size; tile += 1) {
    groups[attributeOf(size, tile, attribute)] |= 1 << tile;
  }
  return Object.freeze(groups);
}

function attributeOf(size, tile, attribute) {
  return attribute === "color" ? Math.floor(tile / size) : tile % size;
}

function matches(size, tile, color, shape) {
  return (
    (color === null || attributeOf(size, tile, "color") === color) &&
    (shape === null || attributeOf(size, tile, "shape") === shape)
  );
}

function isFullAt(clue) {
  return clue.type === "at" && clue.color !== null && clue.shape !== null;
}

function clueGroup(geometry, clue) {
  return clue.color !== null
    ? geometry.groups.color[clue.color]
    : geometry.groups.shape[clue.shape];
}

function lineMask(geometry, line) {
  return geometry.lines[line.axis][line.index];
}

function lineOfCell(geometry, axis, cell) {
  const { size } = geometry;
  return axis === "row"
    ? geometry.lines.row[Math.floor(cell / size)]
    : geometry.lines.col[cell % size];
}

function neighborOf(size, cell, dir, step) {
  const row = Math.floor(cell / size) + (dir === "down" ? step : 0);
  const col = (cell % size) + (dir === "right" ? step : 0);
  return row >= 0 && row < size && col >= 0 && col < size ? row * size + col : -1;
}

function lowestBit(mask) {
  return 31 - Math.clz32(mask & -mask);
}

function isSingle(mask) {
  return mask !== 0 && (mask & (mask - 1)) === 0;
}

function countBits(mask) {
  let total = 0;
  for (let rest = mask; rest !== 0; rest &= rest - 1) {
    total += 1;
  }
  return total;
}

function bitsOf(mask) {
  const bits = [];
  for (let rest = mask; rest !== 0; rest &= rest - 1) {
    bits.push(lowestBit(rest));
  }
  return bits;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKeys(value, keys) {
  return isRecord(value) && Object.keys(value).sort().join(",") === keys;
}

function isIndex(value, limit) {
  return Number.isInteger(value) && value >= 0 && value < limit;
}

function isOptionalIndex(value, limit) {
  return value === null || isIndex(value, limit);
}

function isLine(size, line) {
  return hasKeys(line, "axis,index") && AXES.includes(line.axis) && isIndex(line.index, size);
}

function hasOneAttribute(size, clue) {
  return (
    isOptionalIndex(clue.color, size) &&
    isOptionalIndex(clue.shape, size) &&
    (clue.color === null) !== (clue.shape === null)
  );
}

function isTilePair(count, clue) {
  return isIndex(clue.a, count) && isIndex(clue.b, count) && clue.a !== clue.b;
}

function isClue(size, clue) {
  if (
    !isRecord(clue) ||
    !Object.hasOwn(CLUE_KEYS, clue.type) ||
    !hasKeys(clue, CLUE_KEYS[clue.type])
  ) {
    return false;
  }

  const count = size * size;
  switch (clue.type) {
    case "at":
      return (
        isIndex(clue.cell, count) &&
        isOptionalIndex(clue.color, size) &&
        isOptionalIndex(clue.shape, size) &&
        (clue.color !== null || clue.shape !== null)
      );
    case "notIn":
      return isLine(size, clue.line) && hasOneAttribute(size, clue);
    case "corners":
      return hasOneAttribute(size, clue);
    case "adjacent":
      return isTilePair(count, clue) && DIRECTIONS.includes(clue.dir);
    case "distinct":
      return isLine(size, clue.line) && ATTRIBUTES.includes(clue.attr);
    default:
      return isTilePair(count, clue) && AXES.includes(clue.axis);
  }
}

function clueKey(clue) {
  switch (clue.type) {
    case "at":
      return `at:${clue.cell}:${clue.color}:${clue.shape}`;
    case "notIn":
      return `notIn:${clue.line.axis}:${clue.line.index}:${clue.color}:${clue.shape}`;
    case "corners":
      return `corners:${clue.color}:${clue.shape}`;
    case "adjacent":
      return `adjacent:${clue.a}:${clue.b}:${clue.dir}`;
    case "distinct":
      return `distinct:${clue.line.axis}:${clue.line.index}:${clue.attr}`;
    default:
      return `sameLine:${Math.min(clue.a, clue.b)}:${Math.max(clue.a, clue.b)}:${clue.axis}`;
  }
}

function isPlacements(size, placements) {
  if (!Array.isArray(placements) || placements.length !== size * size) {
    return false;
  }
  for (let cell = 0; cell < placements.length; cell += 1) {
    if (placements[cell] !== null && !isIndex(placements[cell], size * size)) {
      return false;
    }
  }
  return true;
}

function assertSize(size) {
  if (!SIZES.includes(size)) {
    throw new RangeError("棋盘边长只能是 3 或 4");
  }
}

function assertTile(size, tile) {
  assertSize(size);
  if (!isIndex(tile, size * size)) {
    throw new RangeError(`棋子编号必须是 0–${size * size - 1} 的整数`);
  }
}

function assertCell(size, cell) {
  assertSize(size);
  if (!isIndex(cell, size * size)) {
    throw new RangeError(`格子编号必须是 0–${size * size - 1} 的整数`);
  }
}

function assertClue(size, clue) {
  assertSize(size);
  if (!isClue(size, clue)) {
    throw new TypeError("线索格式不正确");
  }
}

function assertClues(size, clues) {
  assertSize(size);
  if (!Array.isArray(clues) || !Array.from(clues).every((clue) => isClue(size, clue))) {
    throw new TypeError("线索列表格式不正确");
  }
}

function assertPlacements(size, placements) {
  if (!isPlacements(size, placements)) {
    throw new TypeError(`摆放必须是长度为 ${size * size} 的数组，每格是棋子编号或 null`);
  }
}

function assertPuzzle(puzzle) {
  if (!isValidPuzzle(puzzle)) {
    throw new TypeError("题目格式不正确");
  }
}

export function tileColor(size, tile) {
  assertTile(size, tile);
  return attributeOf(size, tile, "color");
}

export function tileShape(size, tile) {
  assertTile(size, tile);
  return attributeOf(size, tile, "shape");
}

export function tileName(size, tile) {
  assertTile(size, tile);
  const color = COLOR_NAMES[attributeOf(size, tile, "color")];
  return `${color}${SHAPE_NAMES[attributeOf(size, tile, "shape")]}`;
}

export function cellName(size, cell) {
  assertCell(size, cell);
  if (size === 3) {
    return SMALL_CELL_NAMES[cell];
  }
  return `第${NUMERALS[Math.floor(cell / size)]}行第${NUMERALS[cell % size]}格`;
}

export function lineName(size, line) {
  assertSize(size);
  if (!isLine(size, line)) {
    throw new TypeError("行列格式不正确");
  }
  if (line.axis === "row") {
    return `第${NUMERALS[line.index]}行`;
  }
  return size === 3 ? SMALL_COLUMN_NAMES[line.index] : `第${NUMERALS[line.index]}列`;
}

function attributeWord(clue) {
  return clue.color !== null ? COLOR_WORDS[clue.color] : SHAPE_WORDS[clue.shape];
}

export function describeClue(size, clue) {
  assertClue(size, clue);
  switch (clue.type) {
    case "at":
      return `${cellName(size, clue.cell)}是${
        isFullAt(clue) ? tileName(size, clue.color * size + clue.shape) : attributeWord(clue)
      }`;
    case "notIn":
      return `${lineName(size, clue.line)}没有${attributeWord(clue)}`;
    case "corners":
      return `四个角上都没有${attributeWord(clue)}`;
    case "adjacent":
      return clue.dir === "right"
        ? `${tileName(size, clue.a)}右边紧挨着${tileName(size, clue.b)}`
        : `${tileName(size, clue.a)}正下方是${tileName(size, clue.b)}`;
    case "distinct":
      return `${lineName(size, clue.line)}${NUMERALS[size - 1]}种${
        clue.attr === "color" ? "颜色" : "形状"
      }各一个`;
    default:
      return `${tileName(size, clue.a)}和${tileName(size, clue.b)}在同一${
        clue.axis === "row" ? "行" : "列"
      }`;
  }
}

export function clueInvolvement(size, clue) {
  assertClue(size, clue);
  const geometry = GEOMETRIES[size];
  switch (clue.type) {
    case "at":
      return {
        cells: [clue.cell],
        tiles: isFullAt(clue) ? [clue.color * size + clue.shape] : [],
      };
    case "notIn":
    case "distinct":
      return { cells: bitsOf(lineMask(geometry, clue.line)), tiles: [] };
    case "corners":
      return { cells: bitsOf(geometry.corners), tiles: [] };
    default:
      return { cells: [], tiles: [clue.a, clue.b] };
  }
}

export function evaluateClue(size, clue, placements) {
  assertClue(size, clue);
  assertPlacements(size, placements);
  return evaluate(size, clue, placements);
}

function evaluate(size, clue, placements) {
  const geometry = GEOMETRIES[size];
  switch (clue.type) {
    case "at":
      if (placements[clue.cell] === null) {
        return "open";
      }
      return matches(size, placements[clue.cell], clue.color, clue.shape)
        ? "satisfied"
        : "violated";
    case "notIn":
      return evaluateRegion(size, lineMask(geometry, clue.line), clue, placements);
    case "corners":
      return evaluateRegion(size, geometry.corners, clue, placements);
    case "adjacent":
      return evaluateAdjacent(size, clue, placements);
    case "distinct":
      return evaluateDistinct(size, lineMask(geometry, clue.line), clue.attr, placements);
    default:
      return evaluateSameLine(geometry, clue, placements);
  }
}

function evaluateRegion(size, cells, clue, placements) {
  let open = false;
  for (const cell of bitsOf(cells)) {
    const tile = placements[cell];
    if (tile === null) {
      open = true;
    } else if (matches(size, tile, clue.color, clue.shape)) {
      return "violated";
    }
  }
  return open ? "open" : "satisfied";
}

function isBlocked(cell, placements) {
  return cell === -1 || placements[cell] !== null;
}

function evaluateAdjacent(size, clue, placements) {
  const from = placements.indexOf(clue.a);
  const to = placements.indexOf(clue.b);
  if (from !== -1 && to !== -1) {
    return neighborOf(size, from, clue.dir, 1) === to ? "satisfied" : "violated";
  }
  if (from !== -1) {
    return isBlocked(neighborOf(size, from, clue.dir, 1), placements) ? "violated" : "open";
  }
  if (to !== -1) {
    return isBlocked(neighborOf(size, to, clue.dir, -1), placements) ? "violated" : "open";
  }
  return "open";
}

function evaluateDistinct(size, cells, attribute, placements) {
  const seen = new Set();
  let open = false;
  for (const cell of bitsOf(cells)) {
    const tile = placements[cell];
    if (tile === null) {
      open = true;
      continue;
    }
    const value = attributeOf(size, tile, attribute);
    if (seen.has(value)) {
      return "violated";
    }
    seen.add(value);
  }
  return open ? "open" : "satisfied";
}

function evaluateSameLine(geometry, clue, placements) {
  const from = placements.indexOf(clue.a);
  const to = placements.indexOf(clue.b);
  if (from === -1 || to === -1) {
    return "open";
  }
  return (lineOfCell(geometry, clue.axis, from) & (1 << to)) !== 0 ? "satisfied" : "violated";
}

export function isValidPuzzle(value) {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value).sort().join(",");
  if (keys !== "clues,id,level,size,solution" && keys !== "clues,level,size,solution") {
    return false;
  }
  if (Object.hasOwn(value, "id") && !(typeof value.id === "string" && PUZZLE_ID.test(value.id))) {
    return false;
  }
  if (!LEVELS.includes(value.level) || value.size !== LEVEL_SIZES[value.level]) {
    return false;
  }

  const { size, solution, clues } = value;
  const count = size * size;
  if (!Array.isArray(solution) || solution.length !== count) {
    return false;
  }
  const tiles = new Set();
  for (let cell = 0; cell < count; cell += 1) {
    if (!isIndex(solution[cell], count) || tiles.has(solution[cell])) {
      return false;
    }
    tiles.add(solution[cell]);
  }

  if (!Array.isArray(clues) || clues.length === 0 || clues.length > MAX_CLUES) {
    return false;
  }
  const seen = new Set();
  for (const clue of Array.from(clues)) {
    if (
      !isClue(size, clue) ||
      seen.has(clueKey(clue)) ||
      evaluate(size, clue, solution) !== "satisfied"
    ) {
      return false;
    }
    seen.add(clueKey(clue));
  }
  return true;
}

export function isSolved(puzzle, placements) {
  assertPuzzle(puzzle);
  assertPlacements(puzzle.size, placements);
  return placements.every((tile, cell) => tile === puzzle.solution[cell]);
}

function createState(size) {
  const { count, full } = GEOMETRIES[size];
  return {
    size,
    domains: new Int32Array(count).fill(full),
    reasons: new Int32Array(count * count),
    conflict: -1,
  };
}

function copyState(state) {
  return {
    size: state.size,
    domains: state.domains.slice(),
    reasons: state.reasons.slice(),
    conflict: state.conflict,
  };
}

function eliminate(state, tile, cell, reason) {
  const bit = 1 << cell;
  if ((state.domains[tile] & bit) === 0) {
    return false;
  }
  state.domains[tile] &= ~bit;
  state.reasons[tile * state.domains.length + cell] = reason;
  if (state.domains[tile] === 0 && state.conflict === -1) {
    state.conflict = tileReason(state, tile, GEOMETRIES[state.size].full);
  }
  return true;
}

function removeCells(state, tile, cells, reason) {
  let changed = false;
  for (let rest = cells & state.domains[tile]; rest !== 0; rest &= rest - 1) {
    changed = eliminate(state, tile, lowestBit(rest), reason) || changed;
  }
  return changed;
}

function removeTiles(state, tiles, cell, reason) {
  let changed = false;
  for (let rest = tiles; rest !== 0; rest &= rest - 1) {
    changed = eliminate(state, lowestBit(rest), cell, reason) || changed;
  }
  return changed;
}

function tileReason(state, tile, cells) {
  const count = state.domains.length;
  let reason = 0;
  for (let rest = cells & ~state.domains[tile]; rest !== 0; rest &= rest - 1) {
    reason |= state.reasons[tile * count + lowestBit(rest)];
  }
  return reason;
}

function cellReason(state, tiles, cell) {
  const count = state.domains.length;
  let reason = 0;
  for (let rest = tiles; rest !== 0; rest &= rest - 1) {
    const tile = lowestBit(rest);
    if ((state.domains[tile] & (1 << cell)) === 0) {
      reason |= state.reasons[tile * count + cell];
    }
  }
  return reason;
}

function regionReason(state, tiles, cells) {
  let reason = 0;
  for (let rest = tiles; rest !== 0; rest &= rest - 1) {
    reason |= tileReason(state, lowestBit(rest), cells);
  }
  return reason;
}

function holdersOf(state, cell) {
  let holders = 0;
  for (let tile = 0; tile < state.domains.length; tile += 1) {
    if ((state.domains[tile] & (1 << cell)) !== 0) {
      holders |= 1 << tile;
    }
  }
  return holders;
}

function pin(state, tile, cell, reason) {
  removeCells(state, tile, ~(1 << cell), reason);
  removeTiles(state, GEOMETRIES[state.size].full & ~(1 << tile), cell, reason);
}

function applyPlacements(state, placements) {
  for (let cell = 0; cell < placements.length; cell += 1) {
    const tile = placements[cell];
    if (tile === null) {
      continue;
    }
    if ((state.domains[tile] & (1 << cell)) === 0) {
      state.conflict = 0;
      return false;
    }
    pin(state, tile, cell, 0);
  }
  return state.conflict === -1;
}

function applyUnary(state, clues) {
  const { size } = state;
  const geometry = GEOMETRIES[size];
  for (let index = 0; index < clues.length; index += 1) {
    const clue = clues[index];
    const reason = 1 << index;
    if (clue === null) {
      continue;
    }
    if (clue.type === "at") {
      for (let tile = 0; tile < geometry.count; tile += 1) {
        if (!matches(size, tile, clue.color, clue.shape)) {
          eliminate(state, tile, clue.cell, reason);
        }
      }
      if (isFullAt(clue)) {
        removeCells(state, clue.color * size + clue.shape, ~(1 << clue.cell), reason);
      }
    } else if (clue.type === "notIn" || clue.type === "corners") {
      const cells = clue.type === "corners" ? geometry.corners : lineMask(geometry, clue.line);
      for (let rest = clueGroup(geometry, clue); rest !== 0; rest &= rest - 1) {
        removeCells(state, lowestBit(rest), cells, reason);
      }
    }
  }
}

function checkCoverage(state) {
  if (state.conflict !== -1) {
    return false;
  }
  const { full } = GEOMETRIES[state.size];
  let covered = 0;
  for (let tile = 0; tile < state.domains.length; tile += 1) {
    covered |= state.domains[tile];
  }
  if (covered !== full) {
    const cell = lowestBit(full & ~covered);
    state.conflict = cellReason(state, full, cell);
    return false;
  }
  return true;
}

function applySingles(state) {
  const { full } = GEOMETRIES[state.size];
  let changed = false;
  for (let tile = 0; tile < state.domains.length; tile += 1) {
    const domain = state.domains[tile];
    if (isSingle(domain)) {
      const cell = lowestBit(domain);
      const others = holdersOf(state, cell) & ~(1 << tile);
      if (others !== 0) {
        changed = removeTiles(state, others, cell, tileReason(state, tile, full)) || changed;
      }
    }
  }
  for (let cell = 0; cell < state.domains.length; cell += 1) {
    const holders = holdersOf(state, cell);
    if (isSingle(holders)) {
      const tile = lowestBit(holders);
      if (state.domains[tile] !== 1 << cell) {
        const reason = cellReason(state, full & ~holders, cell);
        changed = removeCells(state, tile, ~(1 << cell), reason) || changed;
      }
    }
  }
  return changed;
}

function passAdjacent(state, clues) {
  let changed = false;
  for (let index = 0; index < clues.length; index += 1) {
    const clue = clues[index];
    if (clue?.type === "adjacent") {
      changed = reviseAdjacent(state, clue.dir, 1 << index, clue.a, clue.b, 1) || changed;
      changed = reviseAdjacent(state, clue.dir, 1 << index, clue.b, clue.a, -1) || changed;
    }
  }
  return changed;
}

function reviseAdjacent(state, dir, reason, tile, partner, step) {
  const count = state.domains.length;
  let changed = false;
  for (let rest = state.domains[tile]; rest !== 0; rest &= rest - 1) {
    const cell = lowestBit(rest);
    const target = neighborOf(state.size, cell, dir, step);
    if (target === -1) {
      changed = eliminate(state, tile, cell, reason) || changed;
    } else if ((state.domains[partner] & (1 << target)) === 0) {
      const why = reason | state.reasons[partner * count + target];
      changed = eliminate(state, tile, cell, why) || changed;
    }
  }
  return changed;
}

function passSameLine(state, clues) {
  let changed = false;
  for (let index = 0; index < clues.length; index += 1) {
    const clue = clues[index];
    if (clue?.type === "sameLine") {
      changed = reviseSameLine(state, clue.axis, 1 << index, clue.a, clue.b) || changed;
      changed = reviseSameLine(state, clue.axis, 1 << index, clue.b, clue.a) || changed;
    }
  }
  return changed;
}

function reviseSameLine(state, axis, reason, tile, partner) {
  const geometry = GEOMETRIES[state.size];
  let changed = false;
  for (let rest = state.domains[tile]; rest !== 0; rest &= rest - 1) {
    const cell = lowestBit(rest);
    const others = lineOfCell(geometry, axis, cell) & ~(1 << cell);
    if ((state.domains[partner] & others) === 0) {
      const why = reason | tileReason(state, partner, others);
      changed = eliminate(state, tile, cell, why) || changed;
    }
  }
  return changed;
}

function passDistinct(state, clues) {
  let changed = false;
  for (let index = 0; index < clues.length && state.conflict === -1; index += 1) {
    const clue = clues[index];
    if (clue?.type === "distinct") {
      changed = reviseDistinct(state, clue, 1 << index) || changed;
    }
  }
  return changed;
}

function reviseDistinct(state, clue, reason) {
  const geometry = GEOMETRIES[state.size];
  const line = lineMask(geometry, clue.line);
  const groups = geometry.groups[clue.attr];
  let changed = false;
  for (const group of groups) {
    changed = reviseGroup(state, line, group, reason) || changed;
    if (state.conflict !== -1) {
      return true;
    }
  }
  for (let rest = line; rest !== 0; rest &= rest - 1) {
    changed = reviseCellValue(state, line, groups, lowestBit(rest), reason) || changed;
  }
  return changed;
}

function reviseGroup(state, line, group, reason) {
  const { domains } = state;
  const { full } = GEOMETRIES[state.size];
  let able = 0;
  let inside = 0;
  let spots = 0;
  for (let rest = group; rest !== 0; rest &= rest - 1) {
    const tile = lowestBit(rest);
    if ((domains[tile] & line) !== 0) {
      able |= 1 << tile;
    }
    if (domains[tile] !== 0 && (domains[tile] & ~line) === 0) {
      inside |= 1 << tile;
    }
    spots |= domains[tile] & line;
  }

  if (able === 0) {
    state.conflict = reason | regionReason(state, group, line);
    return true;
  }
  if (countBits(inside) > 1) {
    state.conflict = reason | regionReason(state, inside, full & ~line);
    return true;
  }

  let changed = false;
  if (isSingle(able)) {
    const why = reason | regionReason(state, group & ~able, line);
    changed = removeCells(state, lowestBit(able), full & ~line, why) || changed;
  }
  if (isSingle(inside)) {
    const why = reason | tileReason(state, lowestBit(inside), full & ~line);
    for (let rest = group & ~inside; rest !== 0; rest &= rest - 1) {
      changed = removeCells(state, lowestBit(rest), line, why) || changed;
    }
  }
  if (isSingle(spots)) {
    const why = reason | regionReason(state, group, line & ~spots);
    changed = removeTiles(state, full & ~group, lowestBit(spots), why) || changed;
  }
  return changed;
}

function reviseCellValue(state, line, groups, cell, reason) {
  const { full } = GEOMETRIES[state.size];
  const holders = holdersOf(state, cell);
  const present = groups.filter((group) => (group & holders) !== 0);
  if (present.length !== 1) {
    return false;
  }
  const [group] = present;
  const why = reason | cellReason(state, full & ~group, cell);
  let changed = false;
  for (let rest = group; rest !== 0; rest &= rest - 1) {
    changed = removeCells(state, lowestBit(rest), line & ~(1 << cell), why) || changed;
  }
  return changed;
}

function settle(state, clues, maxTier) {
  while (checkCoverage(state)) {
    if (applySingles(state)) {
      continue;
    }
    if (maxTier >= 2 && passAdjacent(state, clues)) {
      continue;
    }
    if (maxTier >= 3 && (passDistinct(state, clues) || passSameLine(state, clues))) {
      continue;
    }
    if (maxTier >= 4 && probeAll(state, clues)) {
      continue;
    }
    return true;
  }
  return false;
}

function isComplete(state) {
  return state.domains.every((domain) => isSingle(domain));
}

function probe(state, clues, tile, cell, placed) {
  const trial = copyState(state);
  if (placed) {
    pin(trial, tile, cell, 0);
  } else {
    eliminate(trial, tile, cell, 0);
  }
  settle(trial, clues, 3);
  return trial.conflict;
}

function probeAll(state, clues) {
  let changed = false;
  for (let tile = 0; tile < state.domains.length; tile += 1) {
    for (const cell of bitsOf(state.domains[tile])) {
      if (isSingle(state.domains[tile]) || state.conflict !== -1) {
        break;
      }
      const placedConflict = probe(state, clues, tile, cell, true);
      if (placedConflict !== -1) {
        eliminate(state, tile, cell, placedConflict | PROBE_FLAG);
        changed = true;
        continue;
      }
      const missingConflict = probe(state, clues, tile, cell, false);
      if (missingConflict !== -1) {
        removeCells(state, tile, ~(1 << cell), missingConflict | PROBE_FLAG);
        changed = true;
      }
    }
  }
  return changed;
}

function humanTier(size, clues, maxTier = MAX_TIER) {
  const state = createState(size);
  applyUnary(state, clues);
  for (let tier = 1; tier <= maxTier; tier += 1) {
    if (!settle(state, clues, tier)) {
      return null;
    }
    if (isComplete(state)) {
      return tier;
    }
  }
  return null;
}

function boardOf(state) {
  const board = Array(state.domains.length).fill(null);
  state.domains.forEach((domain, tile) => {
    board[lowestBit(domain)] = tile;
  });
  return board;
}

function search(state, clues, limit, boards) {
  if (!settle(state, clues, 3)) {
    return 0;
  }

  let branchTile = -1;
  let smallest = Infinity;
  for (let tile = 0; tile < state.domains.length; tile += 1) {
    const options = countBits(state.domains[tile]);
    if (options > 1 && options < smallest) {
      smallest = options;
      branchTile = tile;
    }
  }

  if (branchTile === -1) {
    const board = boardOf(state);
    if (!clues.every((clue) => evaluate(state.size, clue, board) === "satisfied")) {
      return 0;
    }
    boards?.push(board);
    return 1;
  }

  let total = 0;
  for (const cell of bitsOf(state.domains[branchTile])) {
    const branch = copyState(state);
    pin(branch, branchTile, cell, 0);
    total += search(branch, clues, limit - total, boards);
    if (total >= limit) {
      break;
    }
  }
  return total;
}

function countBoards(size, clues, placements, limit, excluded = null, boards = null) {
  const state = createState(size);
  if (placements !== null && !applyPlacements(state, placements)) {
    return 0;
  }
  if (excluded !== null) {
    eliminate(state, excluded.tile, excluded.cell, 0);
  }
  applyUnary(state, clues);
  return search(state, clues, limit, boards);
}

export function countSolutions(size, clues, { placements = null, limit = 2 } = {}) {
  assertClues(size, clues);
  if (placements !== null) {
    assertPlacements(size, placements);
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("解答数量上限必须是正整数");
  }
  return countBoards(size, Array.from(clues), placements, limit);
}

function rankOf(clues, reason) {
  if ((reason & PROBE_FLAG) !== 0) {
    return PROBE_RANK;
  }
  let rank = 0;
  for (const index of bitsOf(reason & CLUE_BITS)) {
    rank = Math.max(rank, TYPE_RANKS[clues[index].type]);
  }
  return rank;
}

function techniqueOf(clues, reason, kind) {
  const rank = rankOf(clues, reason);
  if (rank > 1) {
    return RANK_TECHNIQUES[rank];
  }
  return kind === "cell" ? "only-tile-here" : "only-place-for-tile";
}

function createStep(clues, step) {
  const { kind, tile, cell, reason, technique = null, other = null, negated = false } = step;
  return {
    kind,
    tile,
    cell,
    other,
    negated,
    rank: technique === "direct" ? 0 : rankOf(clues, reason),
    clues: bitsOf(reason & CLUE_BITS),
    technique: technique ?? techniqueOf(clues, reason, kind),
  };
}

function compareSteps(left, right) {
  return (
    left.rank - right.rank ||
    left.clues.length - right.clues.length ||
    left.cell - right.cell ||
    (left.kind === right.kind ? 0 : left.kind === "cell" ? -1 : 1)
  );
}

function bestOf(steps) {
  return steps.reduce(
    (best, step) => (best === null || compareSteps(step, best) < 0 ? step : best),
    null,
  );
}

function directStep(puzzle, placements) {
  const index = puzzle.clues.findIndex((clue) => isFullAt(clue) && placements[clue.cell] === null);
  if (index === -1) {
    return null;
  }
  const clue = puzzle.clues[index];
  return createStep(puzzle.clues, {
    kind: "cell",
    tile: clue.color * puzzle.size + clue.shape,
    cell: clue.cell,
    reason: 1 << index,
    technique: "direct",
  });
}

function singleAt(state, clues, tile, cell) {
  const { full } = GEOMETRIES[state.size];
  const steps = [];
  if (state.domains[tile] === 1 << cell) {
    const reason = tileReason(state, tile, full);
    steps.push(createStep(clues, { kind: "tile", tile, cell, reason }));
  }
  const holders = holdersOf(state, cell);
  if (holders === 1 << tile) {
    const reason = cellReason(state, full & ~holders, cell);
    steps.push(createStep(clues, { kind: "cell", tile, cell, reason }));
  }
  return steps;
}

function singleSteps(state, clues, placements) {
  const steps = [];
  for (let tile = 0; tile < state.domains.length; tile += 1) {
    if (isSingle(state.domains[tile]) && !placements.includes(tile)) {
      steps.push(...singleAt(state, clues, tile, lowestBit(state.domains[tile])));
    }
  }
  for (let cell = 0; cell < placements.length; cell += 1) {
    const holders = holdersOf(state, cell);
    const tile = lowestBit(holders);
    if (placements[cell] === null && isSingle(holders) && !isSingle(state.domains[tile])) {
      steps.push(...singleAt(state, clues, tile, cell));
    }
  }
  return steps;
}

function negationStep(state, clues, tile, cell) {
  const conflict = probe(state, clues, tile, cell, false);
  if (conflict === -1) {
    return null;
  }
  const reason = conflict | PROBE_FLAG;
  const cells = state.domains[tile] & ~(1 << cell);
  const tiles = holdersOf(state, cell) & ~(1 << tile);
  if (isSingle(cells)) {
    return createStep(clues, { kind: "tile", tile, cell, reason, other: lowestBit(cells) });
  }
  if (isSingle(tiles)) {
    return createStep(clues, { kind: "cell", tile, cell, reason, other: lowestBit(tiles) });
  }
  return createStep(clues, { kind: "tile", tile, cell, reason, negated: true });
}

function probeSteps(state, clues, placements) {
  const steps = [];
  for (let tile = 0; tile < state.domains.length; tile += 1) {
    if (isSingle(state.domains[tile]) || placements.includes(tile)) {
      continue;
    }
    for (const cell of bitsOf(state.domains[tile])) {
      const step = negationStep(state, clues, tile, cell);
      if (step !== null) {
        steps.push(step);
      }
    }
  }
  return steps;
}

function deduce(size, clues, placements, maxTier, pick, guess) {
  const state = createState(size);
  applyPlacements(state, placements);
  applyUnary(state, clues);
  while (checkCoverage(state)) {
    const found = pick(state);
    if (found !== null) {
      return found;
    }
    if (maxTier >= 2 && passAdjacent(state, clues)) {
      continue;
    }
    if (maxTier >= 3 && (passDistinct(state, clues) || passSameLine(state, clues))) {
      continue;
    }
    if (maxTier < 4) {
      return null;
    }
    const guessed = guess(state);
    if (guessed !== null) {
      return guessed;
    }
    if (!probeAll(state, clues)) {
      return null;
    }
  }
  return null;
}

function deriveTarget(size, clues, placements, target, maxTier) {
  return deduce(
    size,
    clues,
    placements,
    maxTier,
    (state) => bestOf(singleAt(state, clues, target.tile, target.cell)),
    (state) => negationStep(state, clues, target.tile, target.cell),
  );
}

function refineStep(size, clues, placements, step) {
  const maxTier = RANK_TIERS[step.rank];
  const order = [...step.clues].sort(
    (left, right) => TYPE_RANKS[clues[right].type] - TYPE_RANKS[clues[left].type] || right - left,
  );
  let best = step;
  for (const index of order) {
    if (!best.clues.includes(index)) {
      continue;
    }
    const kept = new Set(best.clues.filter((other) => other !== index));
    const restricted = clues.map((clue, other) => (kept.has(other) ? clue : null));
    const derived = deriveTarget(size, restricted, placements, step, maxTier);
    if (derived !== null) {
      best = derived;
    }
  }
  return best;
}

function findStep(puzzle, placements, maxTier) {
  const direct = directStep(puzzle, placements);
  if (direct !== null) {
    return direct;
  }

  const { size, clues } = puzzle;
  const step = deduce(
    size,
    clues,
    placements,
    maxTier,
    (state) => bestOf(singleSteps(state, clues, placements)),
    (state) => bestOf(probeSteps(state, clues, placements)),
  );
  return step === null || step.clues.length < 2 ? step : refineStep(size, clues, placements, step);
}

function circled(index) {
  return String.fromCodePoint(index < 20 ? 0x2460 + index : 0x3251 + index - 20);
}

function citeClues(indexes) {
  return `第${indexes.map(circled).join("、")}条`;
}

function citeConflict(indexes) {
  if (indexes.length === 0) {
    return "就放不下了";
  }
  if (indexes.length === 1) {
    return `${citeClues(indexes)}就不成立了`;
  }
  if (indexes.length === 2) {
    return `第${circled(indexes[0])}条和第${circled(indexes[1])}条就没法同时成立`;
  }
  return `${citeClues(indexes)}就没法同时成立`;
}

function explainStep(puzzle, step) {
  const { size, clues } = puzzle;
  const tile = tileName(size, step.tile);
  const cell = cellName(size, step.cell);
  const indexes = step.clues;
  const conclusion = step.kind === "cell" ? `${cell}只能放${tile}` : `${tile}只能放在${cell}`;

  if (step.technique === "direct") {
    return `第${circled(indexes[0])}条直接说了：${describeClue(size, clues[indexes[0]])}。`;
  }
  if (step.technique === "contradiction") {
    if (step.negated) {
      return `假设${tile}不在${cell}，${citeConflict(indexes)}，所以${tile}在${cell}。`;
    }
    if (step.other === null) {
      return `用${citeClues(indexes)}一个一个试，会发现${conclusion}。`;
    }
    return step.kind === "cell"
      ? `假设${cell}放${tileName(size, step.other)}，${citeConflict(indexes)}，所以${cell}放${tile}。`
      : `假设${tile}放在${cellName(size, step.other)}，${citeConflict(indexes)}，所以${tile}在${cell}。`;
  }
  if (indexes.length === 0) {
    return step.kind === "cell"
      ? `只剩${tile}还没放，就放在${cell}。`
      : `只剩${cell}还空着，${tile}就放在这里。`;
  }
  if (indexes.length === 1) {
    return `第${circled(indexes[0])}条说${describeClue(size, clues[indexes[0]])}，所以${conclusion}。`;
  }

  const cited = citeClues(indexes);
  switch (step.technique) {
    case "only-place-for-tile":
      return `根据${cited}，${tile}只剩${cell}一个地方可以放。`;
    case "only-tile-here":
      return `根据${cited}，${cell}只能放${tile}。`;
    case "adjacent":
      return `根据${cited}，看看谁和谁挨着，${conclusion}。`;
    case "line":
      return `根据${cited}，数数这一行或这一列还缺什么，${conclusion}。`;
    default:
      return `根据${cited}，看看谁和谁在同一行或同一列，${conclusion}。`;
  }
}

function fallbackStep(puzzle, placements) {
  const cell = placements.indexOf(null);
  return {
    kind: "cell",
    tile: puzzle.solution[cell],
    cell,
    other: null,
    negated: false,
    rank: PROBE_RANK,
    clues: puzzle.clues.map((_, index) => index),
    technique: "contradiction",
  };
}

function conflictExplanation(size, placements, wrongCells) {
  const pieces = wrongCells.map(
    (cell) => `${cellName(size, cell)}的${tileName(size, placements[cell])}`,
  );
  return wrongCells.length === 1
    ? `${pieces[0]}放错了，先把它拿掉再想一想。`
    : `${pieces.join("、")}放错了，先把它们拿掉再想一想。`;
}

export function nextDeduction(puzzle, placements) {
  assertPuzzle(puzzle);
  assertPlacements(puzzle.size, placements);
  const wrongCells = [];
  placements.forEach((tile, cell) => {
    if (tile !== null && tile !== puzzle.solution[cell]) {
      wrongCells.push(cell);
    }
  });
  if (wrongCells.length > 0) {
    return {
      kind: "conflict",
      wrongCells,
      explanation: conflictExplanation(puzzle.size, placements, wrongCells),
    };
  }
  if (placements.every((tile) => tile !== null)) {
    return { kind: "done" };
  }

  const board = Array.from(placements);
  const step = findStep(puzzle, board, MAX_TIER) ?? fallbackStep(puzzle, board);
  return {
    kind: "place",
    cell: step.cell,
    tile: step.tile,
    clues: step.clues,
    technique: step.technique,
    explanation: explainStep(puzzle, step),
  };
}

function walkSteps(puzzle, maxTier) {
  const placements = Array(puzzle.size * puzzle.size).fill(null);
  const steps = [];
  while (placements.includes(null)) {
    const step = findStep(puzzle, placements, maxTier);
    if (step === null) {
      break;
    }
    steps.push(step);
    placements[step.cell] = step.tile;
  }
  return steps;
}

function isGenericProbe(step) {
  return step.technique === "contradiction" && step.other === null && !step.negated;
}

export function gradePuzzle(puzzle) {
  assertPuzzle(puzzle);
  const tier = humanTier(puzzle.size, puzzle.clues);
  const steps = (tier === null ? [] : walkSteps(puzzle, tier)).map((step) => ({
    cell: step.cell,
    tile: step.tile,
    clues: step.clues,
    technique: step.technique,
    explanation: explainStep(puzzle, step),
  }));
  return {
    tier,
    steps,
    techniques: TECHNIQUES.filter((name) => steps.some((step) => step.technique === name)),
  };
}

function* combinations(items, size, start = 0, prefix = []) {
  if (prefix.length === size) {
    yield [...prefix];
    return;
  }
  for (let index = start; index <= items.length - (size - prefix.length); index += 1) {
    prefix.push(items[index]);
    yield* combinations(items, size, index + 1, prefix);
    prefix.pop();
  }
}

function forcedBy(size, clues, base, cell, tile) {
  const boards = [];
  if (countBoards(size, clues, base, 1, { tile, cell }, boards) > 0) {
    return { sufficient: false, counterexampleCell: boards[0].indexOf(tile) };
  }
  const pinned = base.map((value, index) => (index === cell ? tile : value));
  return { sufficient: countBoards(size, clues, pinned, 1) > 0, counterexampleCell: null };
}

function smallestSubset(indexes, isSufficient) {
  let budget = CHECK_BUDGET;
  for (let size = 0; size <= indexes.length; size += 1) {
    for (const subset of combinations(indexes, size)) {
      if (budget === 0) {
        return reduceGreedily(indexes, isSufficient);
      }
      budget -= 1;
      if (isSufficient(subset)) {
        return subset;
      }
    }
  }
  return [...indexes];
}

function reduceGreedily(indexes, isSufficient) {
  let kept = [...indexes];
  for (const index of indexes) {
    const trial = kept.filter((other) => other !== index);
    if (isSufficient(trial)) {
      kept = trial;
    }
  }
  return kept;
}

function suggestClues(total, chosen, isSufficient) {
  const all = Array.from({ length: total }, (_, index) => index);
  const picked = new Set(chosen);
  for (let size = 1; size <= Math.min(SUGGESTION_SIZE, total); size += 1) {
    let best = null;
    let bestOverlap = -1;
    for (const subset of combinations(all, size)) {
      const overlap = subset.filter((index) => picked.has(index)).length;
      if (overlap < size && overlap > bestOverlap && isSufficient(subset)) {
        best = subset;
        bestOverlap = overlap;
      }
    }
    if (best !== null) {
      return best;
    }
  }
  return null;
}

export function explainReasons(puzzle, placementsBefore, cell, tile, selected) {
  assertPuzzle(puzzle);
  const { size, clues } = puzzle;
  assertPlacements(size, placementsBefore);
  assertCell(size, cell);
  assertTile(size, tile);
  const validChoice = (index) => isIndex(index, clues.length);
  if (!Array.isArray(selected) || !Array.from(selected).every(validChoice)) {
    throw new RangeError("所选线索编号无效");
  }

  const base = placementsBefore.map((value, index) =>
    index === cell || value === tile ? null : value,
  );
  const chosen = [...new Set(selected)].sort((left, right) => left - right);
  const check = (indexes) => forcedBy(size, indexes.map((index) => clues[index]), base, cell, tile);
  const isSufficient = (indexes) => check(indexes).sufficient;
  const verdict = check(chosen);
  if (verdict.sufficient) {
    return {
      sufficient: true,
      counterexampleCell: null,
      minimal: smallestSubset(chosen, isSufficient),
      suggestion: null,
    };
  }
  return {
    sufficient: false,
    counterexampleCell: verdict.counterexampleCell,
    minimal: null,
    suggestion:
      puzzle.solution[cell] === tile ? suggestClues(clues.length, chosen, isSufficient) : null,
  };
}

export function createRandom(seed) {
  if (!Number.isFinite(seed)) {
    throw new TypeError("随机种子必须是有限数字");
  }
  let state = Math.trunc(seed) >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function unitRandom(random) {
  const value = Number(random());
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1 - Number.EPSILON) : 0;
}

function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(unitRandom(random) * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function attributeClue(type, attribute, value, extra = {}) {
  return {
    type,
    ...extra,
    color: attribute === "color" ? value : null,
    shape: attribute === "shape" ? value : null,
  };
}

function cluePool(size, solution, weights) {
  const geometry = GEOMETRIES[size];
  const pool = [];
  const add = (category, clue) => {
    if ((weights[category] ?? 0) > 0) {
      pool.push({ category, clue, weight: weights[category] });
    }
  };
  const valuesIn = (cells, attribute) =>
    new Set(bitsOf(cells).map((cell) => attributeOf(size, solution[cell], attribute)));

  solution.forEach((tile, cell) => {
    const color = attributeOf(size, tile, "color");
    const shape = attributeOf(size, tile, "shape");
    add("atFull", { type: "at", cell, color, shape });
    add("atPartial", { type: "at", cell, color, shape: null });
    add("atPartial", { type: "at", cell, color: null, shape });
  });
  for (const axis of AXES) {
    geometry.lines[axis].forEach((cells, index) => {
      for (const attribute of ATTRIBUTES) {
        const present = valuesIn(cells, attribute);
        for (let value = 0; value < size; value += 1) {
          if (!present.has(value)) {
            add("notIn", attributeClue("notIn", attribute, value, { line: { axis, index } }));
          }
        }
        if (present.size === size) {
          add("distinct", { type: "distinct", line: { axis, index }, attr: attribute });
        }
      }
      const tiles = bitsOf(cells).map((cell) => solution[cell]);
      for (const [first, second] of combinations(tiles, 2)) {
        const [a, b] = first < second ? [first, second] : [second, first];
        add("sameLine", { type: "sameLine", a, b, axis });
      }
    });
  }
  for (const attribute of ATTRIBUTES) {
    const present = valuesIn(geometry.corners, attribute);
    for (let value = 0; value < size; value += 1) {
      if (!present.has(value)) {
        add("corners", attributeClue("corners", attribute, value));
      }
    }
  }
  solution.forEach((tile, cell) => {
    for (const dir of DIRECTIONS) {
      const next = neighborOf(size, cell, dir, 1);
      if (next !== -1) {
        add("adjacent", { type: "adjacent", a: tile, b: solution[next], dir });
      }
    }
  });
  return pool;
}

function takeEntry(pool, random, accept) {
  const candidates = pool.filter(accept);
  if (candidates.length === 0) {
    return null;
  }
  const total = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  let target = unitRandom(random) * total;
  let picked = candidates[candidates.length - 1];
  for (const entry of candidates) {
    target -= entry.weight;
    if (target < 0) {
      picked = entry;
      break;
    }
  }
  pool.splice(pool.indexOf(picked), 1);
  return picked;
}

function countCategory(entries, category) {
  return entries.filter((entry) => entry.category === category).length;
}

function canAdd(rule, chosen, entry) {
  if (entry.category !== "atFull" && entry.category !== "atPartial") {
    return true;
  }
  const limit = entry.category === "atFull" ? rule.maxFullAt : rule.maxPartialAt;
  return (
    countCategory(chosen, entry.category) < limit &&
    !chosen.some((other) => sharesCell(other, entry))
  );
}

function sharesCell(left, right) {
  return left.clue.type === "at" && right.clue.type === "at" && left.clue.cell === right.clue.cell;
}

function isHumanSolvable(size, entries, maxTier) {
  const clues = entries.map((entry) => entry.clue);
  return (
    clues.length > 0 &&
    countBoards(size, clues, null, 2) === 1 &&
    humanTier(size, clues, maxTier) !== null
  );
}

function pruneClues(entries, random, keep) {
  let kept = entries;
  for (const entry of shuffled(entries, random)) {
    const rest = kept.filter((other) => other !== entry);
    if (keep(rest)) {
      kept = rest;
    }
  }
  return kept;
}

function readablePuzzle(level, solution, entries) {
  const rule = LEVEL_RULES[level];
  const size = LEVEL_SIZES[level];
  const clues = orderClues(entries);
  const tier = humanTier(size, clues);
  if (!rule.tiers.includes(tier)) {
    return null;
  }
  const puzzle = { level, size, solution, clues };
  const steps = walkSteps(puzzle, tier);
  const readable =
    steps.length === size * size &&
    steps.every((step) => step.clues.length <= rule.maxStepClues && !isGenericProbe(step));
  return readable ? puzzle : null;
}

function clueOrder(entry) {
  const { clue } = entry;
  const attributeRank = (value) => (value.color !== null ? value.color : 10 + value.shape);
  const lineRank = (line) => AXES.indexOf(line.axis) * 10 + line.index;
  const keys = {
    at: () => [clue.cell, clue.color === null ? 1 : 0],
    notIn: () => [lineRank(clue.line), attributeRank(clue)],
    corners: () => [attributeRank(clue)],
    adjacent: () => [DIRECTIONS.indexOf(clue.dir), clue.a, clue.b],
    sameLine: () => [AXES.indexOf(clue.axis), clue.a, clue.b],
    distinct: () => [lineRank(clue.line), ATTRIBUTES.indexOf(clue.attr)],
  };
  return [CATEGORIES.indexOf(entry.category), ...keys[clue.type]()];
}

function compareKeys(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return left.length - right.length;
}

function orderClues(entries) {
  return entries
    .map((entry) => ({ entry, key: clueOrder(entry) }))
    .sort((left, right) => compareKeys(left.key, right.key))
    .map(({ entry }) => entry.clue);
}

function attemptPuzzle(level, random) {
  const rule = LEVEL_RULES[level];
  const size = LEVEL_SIZES[level];
  const solution = shuffled(
    Array.from({ length: size * size }, (_, tile) => tile),
    random,
  );
  const pool = cluePool(size, solution, rule.weights);
  const chosen = [];
  while (countCategory(chosen, "atFull") < rule.minFullAt) {
    const given = (entry) => entry.category === "atFull" && canAdd(rule, chosen, entry);
    chosen.push(takeEntry(pool, random, given));
  }
  while (!isHumanSolvable(size, chosen, rule.solveTier)) {
    const entry = takeEntry(pool, random, (candidate) => canAdd(rule, chosen, candidate));
    if (entry === null) {
      return null;
    }
    chosen.push(entry);
  }

  let kept = pruneClues(
    chosen,
    random,
    (rest) =>
      countCategory(rest, "atFull") >= rule.minFullAt &&
      isHumanSolvable(size, rest, rule.solveTier),
  );
  if (
    rule.polishTier > rule.solveTier &&
    kept.length <= rule.maxClues + 1 &&
    readablePuzzle(level, solution, kept) !== null
  ) {
    kept = pruneClues(
      kept,
      random,
      (rest) =>
        isHumanSolvable(size, rest, rule.polishTier) &&
        readablePuzzle(level, solution, rest) !== null,
    );
  }

  const types = new Set(kept.map((entry) => entry.clue.type));
  if (kept.length < rule.minClues || kept.length > rule.maxClues || types.size < rule.minTypes) {
    return null;
  }
  return readablePuzzle(level, solution, kept);
}

export function generatePuzzle({ level, random = Math.random } = {}) {
  if (!LEVELS.includes(level)) {
    throw new RangeError("关卡只能是 1、2、3 或 4");
  }
  if (typeof random !== "function") {
    throw new TypeError("random 必须是返回 0–1 小数的函数");
  }
  for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt += 1) {
    const puzzle = attemptPuzzle(level, random);
    if (puzzle !== null) {
      return puzzle;
    }
  }
  throw new Error("多次尝试后仍没能生成符合要求的题目");
}
