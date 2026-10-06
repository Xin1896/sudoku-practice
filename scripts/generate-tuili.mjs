import { writeFile } from "node:fs/promises";

import {
  LEVELS,
  countSolutions,
  createRandom,
  generatePuzzle,
  gradePuzzle,
  isValidPuzzle,
} from "../site/js/tuili.js";

const PER_LEVEL = 40;
const SEEDS = Object.freeze({ 1: 20261006, 2: 20261016, 3: 20261026, 4: 20261036 });
const OUTPUT = new URL("../site/js/tuili-puzzles.js", import.meta.url);

const RUNTIME = `const DAY_MS = 86400000;

function deepFreeze(value) {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const PUZZLES = deepFreeze(PUZZLE_DATA);

function puzzlesOfLevel(level) {
  return PUZZLES.filter((puzzle) => puzzle.level === level);
}

export function choosePuzzle(level, completedIds = [], random = Math.random) {
  const puzzles = puzzlesOfLevel(level);
  if (puzzles.length === 0) {
    return null;
  }

  let completed;
  try {
    completed = new Set(completedIds ?? []);
  } catch {
    completed = new Set();
  }

  const unfinished = puzzles.filter((puzzle) => !completed.has(puzzle.id));
  const candidates = unfinished.length > 0 ? unfinished : puzzles;
  const randomValue = Number(random());
  const boundedValue = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON)
    : 0;
  return candidates[Math.floor(boundedValue * candidates.length)];
}

export function dailyPuzzle(level, date = new Date()) {
  const puzzles = puzzlesOfLevel(level);
  if (puzzles.length === 0 || !(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  return puzzles[((day % puzzles.length) + puzzles.length) % puzzles.length];
}

export function findPuzzle(id) {
  return PUZZLES.find((puzzle) => puzzle.id === id) ?? null;
}
`;

function literal(value) {
  if (Array.isArray(value)) {
    return `[${value.map(literal).join(", ")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const fields = Object.entries(value).map(([key, field]) => `${key}: ${literal(field)}`);
    return `{ ${fields.join(", ")} }`;
  }
  return JSON.stringify(value);
}

function formatPuzzle(puzzle) {
  return [
    "  {",
    `    id: ${literal(puzzle.id)},`,
    `    level: ${puzzle.level},`,
    `    size: ${puzzle.size},`,
    `    solution: ${literal(puzzle.solution)},`,
    "    clues: [",
    ...puzzle.clues.map((clue) => `      ${literal(clue)},`),
    "    ],",
    "  },",
  ].join("\n");
}

function moduleSource(puzzles) {
  return [
    "// 由 scripts/generate-tuili.mjs 按固定种子生成，请勿手动修改；重新生成：node scripts/generate-tuili.mjs",
    "const PUZZLE_DATA = [",
    ...puzzles.map(formatPuzzle),
    "];",
    "",
    RUNTIME,
  ].join("\n");
}

function verify(puzzle) {
  const grade = gradePuzzle(puzzle);
  if (!isValidPuzzle(puzzle) || countSolutions(puzzle.size, puzzle.clues) !== 1) {
    throw new Error(`${puzzle.id} 不是有效的唯一解题目`);
  }
  if (grade.steps.length !== puzzle.size * puzzle.size) {
    throw new Error(`${puzzle.id} 无法用推理步骤解完`);
  }
  return grade;
}

function generateLevel(level) {
  const random = createRandom(SEEDS[level]);
  const seen = new Set();
  const puzzles = [];
  while (puzzles.length < PER_LEVEL) {
    const generated = generatePuzzle({ level, random });
    const key = JSON.stringify([generated.solution, generated.clues]);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const id = `tuili-${level}-${String(puzzles.length + 1).padStart(3, "0")}`;
    puzzles.push({ id, ...generated });
  }
  return puzzles;
}

function summarize(level, puzzles, grades, milliseconds) {
  const tiers = new Map();
  for (const grade of grades) {
    tiers.set(grade.tier, (tiers.get(grade.tier) ?? 0) + 1);
  }
  const counts = puzzles.map((puzzle) => puzzle.clues.length);
  const tierText = [...tiers].map(([tier, count]) => `${tier} 级 ${count} 题`).join("，");
  return `第 ${level} 档：${puzzles.length} 题（${tierText}），线索 ${Math.min(...counts)}–${Math.max(
    ...counts,
  )} 条，用时 ${(milliseconds / 1000).toFixed(1)} 秒`;
}

const started = performance.now();
const bank = [];
for (const level of LEVELS) {
  const levelStarted = performance.now();
  const puzzles = generateLevel(level);
  const grades = puzzles.map(verify);
  bank.push(...puzzles);
  console.log(summarize(level, puzzles, grades, performance.now() - levelStarted));
}

const source = moduleSource(bank);
await writeFile(OUTPUT, source);
console.log(
  `已写入 site/js/tuili-puzzles.js：${bank.length} 题，${(Buffer.byteLength(source) / 1024).toFixed(
    1,
  )} KB，总用时 ${((performance.now() - started) / 1000).toFixed(1)} 秒`,
);
