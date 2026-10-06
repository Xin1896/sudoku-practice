import {
  cellName,
  clueInvolvement,
  describeClue,
  evaluateClue,
  explainReasons,
  isSolved,
  nextDeduction,
  tileColor,
  tileName,
  tileShape,
} from "./tuili.js";
import { choosePuzzle, dailyPuzzle, findPuzzle } from "./tuili-puzzles.js";
import {
  bindChoiceGroup,
  bindGridKeyboard,
  bindSheets,
  createAnnouncer,
  dropIn,
  focusCell,
  loadSession,
  saveSession,
} from "./game-kit.js";
import { registerServiceWorker } from "./pwa.js";

const SAVE_KEY = "yike-tuili:v1";
const SVG_NS = "http://www.w3.org/2000/svg";
const LEVEL_NAMES = Object.freeze({ 1: "启蒙", 2: "入门", 3: "进阶", 4: "挑战" });
const MODE_NAMES = Object.freeze({ daily: "今日推理", practice: "练习" });
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
const MAX_HISTORY = 80;

const boardElement = document.querySelector("#board");
const trayElement = document.querySelector("#tray");
const clueList = document.querySelector("#clue-list");
const clueCount = document.querySelector("#clue-count");
const metaLine = document.querySelector("#puzzle-meta");
const hintSteps = document.querySelector("#hint-steps");
const noteButton = document.querySelector('[data-action="note"]');
const eraseButton = document.querySelector('[data-action="erase"]');
const undoButton = document.querySelector('[data-action="undo"]');
const hintButton = document.querySelector('[data-action="hint"]');
const reasonButton = document.querySelector('[data-action="reason"]');
const reasonPanel = document.querySelector("#reason-panel");
const reasonChips = document.querySelector("#reason-chips");
const reasonQuestion = document.querySelector("#reason-question");
const reasonResult = document.querySelector("#reason-result");
const resultPanel = document.querySelector("#result-panel");
const announce = createAnnouncer(document.querySelector("#status-message"));

let puzzle = null;
let size = 3;
let mode = "daily";
let placements = [];
let notes = [];
let history = [];
let selected = 0;
let notesMode = false;
let focusClue = null;
let hint = null;
let lastPlacement = null;
let completed = false;
let completedIds = [];
let stats = { hintSteps: 0, answersShown: 0, reasonsGood: 0, mistakes: 0 };
let elapsedBase = 0;
let activeSince = Date.now();
let cells = [];
let trayButtons = [];
let clueButtons = [];
let previousStates = [];
let pendingLevel = 1;
let pendingMode = "daily";

function numbers(indexes) {
  return [...indexes]
    .sort((left, right) => left - right)
    .map((index) => CIRCLED[index] ?? String(index + 1))
    .join("、");
}

function clueStates() {
  return puzzle.clues.map((clue) => evaluateClue(size, clue, placements));
}

function placedCount() {
  return placements.filter((tile) => tile !== null).length;
}

function elapsedSeconds() {
  if (completed) {
    return elapsedBase;
  }
  return elapsedBase + Math.max(0, Math.floor((Date.now() - activeSince) / 1000));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function svgUse(shape, className) {
  const svg = document.createElementNS(SVG_NS, "svg");
  const use = document.createElementNS(SVG_NS, "use");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", `#shape-${shape}`);
  svg.append(use);
  return svg;
}

function createTile(tile, className = "tl-tile") {
  const element = document.createElement("span");
  element.className = className;
  element.append(svgUse(tileShape(size, tile), `tl-shape tl-color-${tileColor(size, tile)}`));
  return element;
}

function createAttribute(color, shape, crossed = false) {
  const element = document.createElement("span");
  element.className = "tl-attr";
  element.classList.toggle("is-crossed", crossed);
  if (color !== null && shape !== null) {
    element.append(svgUse(shape, `tl-shape tl-color-${color}`));
  } else if (color !== null) {
    const swatch = document.createElement("span");
    swatch.className = `tl-swatch tl-bg-${color}`;
    element.append(swatch);
  } else {
    element.append(svgUse(shape, "tl-shape tl-outline"));
  }
  return element;
}

function createMiniBoard(content) {
  const grid = document.createElement("span");
  grid.className = `tl-mini-grid tl-mini-grid--${size}`;
  for (let cell = 0; cell < size * size; cell += 1) {
    const slot = document.createElement("i");
    const item = content.get(cell);
    if (item !== undefined) {
      slot.classList.add("on");
      if (item !== null) {
        slot.append(item);
      }
    }
    grid.append(slot);
  }
  return grid;
}

function createClueArt(clue) {
  const art = document.createElement("span");
  art.className = "clue__art";
  art.setAttribute("aria-hidden", "true");
  const involved = clueInvolvement(size, clue);

  switch (clue.type) {
    case "at":
      art.append(createMiniBoard(new Map([[clue.cell, createAttribute(clue.color, clue.shape)]])));
      break;
    case "notIn":
    case "corners":
      art.append(
        createMiniBoard(
          new Map(involved.cells.map((cell) => [cell, createAttribute(clue.color, clue.shape, true)])),
        ),
      );
      break;
    case "distinct": {
      const label = document.createElement("span");
      label.className = "tl-art-label";
      label.textContent = clue.attr === "color" ? "颜色各一" : "形状各一";
      art.append(createMiniBoard(new Map(involved.cells.map((cell) => [cell, null]))), label);
      break;
    }
    case "adjacent": {
      const pair = document.createElement("span");
      pair.className = `tl-mini-pair tl-mini-pair--${clue.dir === "right" ? "h" : "v"}`;
      pair.append(createTile(clue.a, "tl-tile tl-tile--mini"), createTile(clue.b, "tl-tile tl-tile--mini"));
      art.append(pair);
      break;
    }
    case "sameLine": {
      const pair = document.createElement("span");
      const label = document.createElement("span");
      pair.className = "tl-mini-pair tl-mini-pair--h tl-mini-pair--loose";
      label.className = "tl-art-label";
      label.textContent = clue.axis === "row" ? "同行" : "同列";
      pair.append(createTile(clue.a, "tl-tile tl-tile--mini"), label, createTile(clue.b, "tl-tile tl-tile--mini"));
      art.append(pair);
      break;
    }
    default:
      break;
  }
  return art;
}

function tileHasAttribute(tile, color, shape) {
  return (
    tile !== null &&
    (color === null || color === undefined || tileColor(size, tile) === color) &&
    (shape === null || shape === undefined || tileShape(size, tile) === shape)
  );
}

function offendingCells(clue) {
  const involved = clueInvolvement(size, clue);
  if (clue.type === "notIn" || clue.type === "corners") {
    return involved.cells.filter((cell) => tileHasAttribute(placements[cell], clue.color, clue.shape));
  }
  if (clue.type === "distinct") {
    const seen = new Map();
    for (const cell of involved.cells) {
      const tile = placements[cell];
      if (tile === null) {
        continue;
      }
      const value = clue.attr === "color" ? tileColor(size, tile) : tileShape(size, tile);
      seen.set(value, [...(seen.get(value) ?? []), cell]);
    }
    return [...seen.values()].filter((group) => group.length > 1).flat();
  }
  if (clue.type === "adjacent" || clue.type === "sameLine") {
    return involved.tiles.map((tile) => placements.indexOf(tile)).filter((cell) => cell !== -1);
  }
  return involved.cells;
}

function focusCells() {
  if (focusClue === null) {
    return new Set();
  }
  const involved = clueInvolvement(size, puzzle.clues[focusClue]);
  return new Set([
    ...involved.cells,
    ...involved.tiles.map((tile) => placements.indexOf(tile)).filter((cell) => cell !== -1),
  ]);
}

function buildPuzzleView() {
  boardElement.dataset.size = String(size);
  cells = Array.from({ length: size * size }, (_, cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tl-cell";
    button.setAttribute("role", "gridcell");
    button.tabIndex = cell === selected ? 0 : -1;
    button.addEventListener("click", () => selectCell(cell));
    button.addEventListener("focus", () => {
      if (selected !== cell) {
        selectCell(cell, false);
      }
    });
    return button;
  });
  boardElement.replaceChildren(
    ...Array.from({ length: size }, (_, row) => {
      const element = document.createElement("div");
      element.className = "board-row";
      element.setAttribute("role", "row");
      element.append(...cells.slice(row * size, (row + 1) * size));
      return element;
    }),
  );

  trayElement.dataset.size = String(size);
  trayButtons = Array.from({ length: size * size }, (_, tile) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tl-tray__tile";
    button.append(createTile(tile));
    button.addEventListener("click", () => chooseTile(tile));
    return button;
  });
  trayElement.replaceChildren(...trayButtons);

  clueButtons = puzzle.clues.map((clue, index) => {
    const button = document.createElement("button");
    const number = document.createElement("span");
    const text = document.createElement("span");
    const badge = document.createElement("span");
    button.type = "button";
    button.className = "clue";
    number.className = "clue__num";
    number.textContent = CIRCLED[index] ?? String(index + 1);
    text.className = "clue__text";
    text.textContent = describeClue(size, clue);
    badge.className = "clue__badge";
    badge.setAttribute("aria-hidden", "true");
    button.append(number, createClueArt(clue), text, badge);
    button.addEventListener("click", () => {
      focusClue = focusClue === index ? null : index;
      renderBoard();
      renderClues();
    });
    return button;
  });
  clueList.replaceChildren(
    ...clueButtons.map((button) => {
      const item = document.createElement("li");
      item.append(button);
      return item;
    }),
  );
}

function renderBoard() {
  const states = clueStates();
  const bad = new Set(
    puzzle.clues.flatMap((clue, index) => (states[index] === "violated" ? offendingCells(clue) : [])),
  );
  const focused = focusCells();
  const hintCell = hint !== null && hint.stage >= 3 && hint.step.kind === "place" ? hint.step.cell : null;
  const wrongCells =
    hint !== null && hint.stage >= 2 && hint.step.kind === "conflict" ? new Set(hint.step.wrongCells) : new Set();

  cells.forEach((button, cell) => {
    const tile = placements[cell];
    const key = `${tile ?? ""}|${notes[cell].join(",")}`;
    if (button.dataset.key !== key) {
      button.dataset.key = key;
      if (tile !== null) {
        button.replaceChildren(createTile(tile));
      } else if (notes[cell].length > 0) {
        const grid = document.createElement("span");
        grid.className = `tl-notes tl-notes--${size}`;
        for (let candidate = 0; candidate < size * size; candidate += 1) {
          const slot = document.createElement("span");
          if (notes[cell].includes(candidate)) {
            slot.append(svgUse(tileShape(size, candidate), `tl-shape tl-color-${tileColor(size, candidate)}`));
          }
          grid.append(slot);
        }
        button.replaceChildren(grid);
      } else {
        button.replaceChildren();
      }
    }

    button.classList.toggle("is-selected", cell === selected);
    button.classList.toggle("is-bad", bad.has(cell));
    button.classList.toggle("is-focus", focused.has(cell));
    button.classList.toggle("is-hint", cell === hintCell);
    button.classList.toggle("is-wrong", wrongCells.has(cell));
    button.tabIndex = cell === selected ? 0 : -1;
    button.setAttribute("aria-selected", String(cell === selected));

    let label = `${cellName(size, cell)}，`;
    if (tile !== null) {
      label += tileName(size, tile);
    } else if (notes[cell].length > 0) {
      label += `空，候选 ${notes[cell].map((candidate) => tileName(size, candidate)).join("、")}`;
    } else {
      label += "空";
    }
    if (bad.has(cell)) {
      label += "，和线索冲突";
    }
    button.setAttribute("aria-label", label);
  });
}

function renderTray() {
  const current = placements[selected];
  trayButtons.forEach((button, tile) => {
    const at = placements.indexOf(tile);
    const noted = notes[selected].includes(tile);
    button.classList.toggle("is-used", at !== -1 && at !== selected);
    button.classList.toggle("is-current", current === tile);
    button.classList.toggle("is-noted", notesMode && noted);
    button.classList.toggle("is-focus", focusClue !== null && clueInvolvement(size, puzzle.clues[focusClue]).tiles.includes(tile));
    button.disabled = completed;
    if (notesMode) {
      button.setAttribute("aria-pressed", String(noted));
    } else {
      button.removeAttribute("aria-pressed");
    }
    button.setAttribute(
      "aria-label",
      at === -1 ? tileName(size, tile) : `${tileName(size, tile)}，已放在${cellName(size, at)}`,
    );
  });
}

function renderClues() {
  const states = clueStates();
  const hinted =
    hint !== null && hint.step.kind === "place" && hint.stage >= 1 ? new Set(hint.step.clues) : new Set();

  clueButtons.forEach((button, index) => {
    const state = states[index];
    button.classList.toggle("is-ok", state === "satisfied");
    button.classList.toggle("is-bad", state === "violated");
    button.classList.toggle("is-focus", focusClue === index);
    button.classList.toggle("is-hint", hinted.has(index));
    button.setAttribute("aria-pressed", String(focusClue === index));
    button.querySelector(".clue__badge").textContent =
      state === "satisfied" ? "✓" : state === "violated" ? "✕" : "·";
    button.setAttribute(
      "aria-label",
      `第 ${index + 1} 条：${describeClue(size, puzzle.clues[index])}，${
        state === "satisfied" ? "已成立" : state === "violated" ? "被打破" : "还没确定"
      }`,
    );
  });

  const satisfied = states.filter((state) => state === "satisfied").length;
  clueCount.textContent = `${satisfied} / ${states.length} 成立`;
}

function renderMeta() {
  metaLine.textContent = `线索九宫格 · ${LEVEL_NAMES[puzzle.level]} · ${MODE_NAMES[mode]} · 已放 ${placedCount()}/${size * size}`;
}

function renderTools() {
  noteButton.setAttribute("aria-pressed", String(notesMode));
  undoButton.disabled = history.length === 0 || completed;
  eraseButton.disabled = completed || (placements[selected] === null && notes[selected].length === 0);
  hintButton.disabled = completed;
  reasonButton.disabled = lastPlacement === null || completed;

  hintSteps.hidden = hint === null;
  [...hintSteps.children].forEach((step, index) => {
    step.classList.toggle("done", hint !== null && index < hint.stage);
  });
}

function renderAll() {
  renderBoard();
  renderTray();
  renderClues();
  renderMeta();
  renderTools();
}

function save() {
  saveSession(SAVE_KEY, {
    puzzleId: puzzle.id,
    mode,
    placements,
    notes,
    history: history.slice(-MAX_HISTORY),
    selected,
    stats,
    elapsedSeconds: elapsedSeconds(),
    completedIds,
    finished: completed,
  });
}

function snapshot() {
  return { placements: [...placements], notes: notes.map((list) => [...list]) };
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
}

function resetHint() {
  hint = null;
}

function nextEmptyCell(from) {
  for (let offset = 1; offset <= size * size; offset += 1) {
    const cell = (from + offset) % (size * size);
    if (placements[cell] === null) {
      return cell;
    }
  }
  return from;
}

function selectCell(cell, focus = true) {
  selected = cell;
  if (focus) {
    focusCell(cells, cell);
  }
  renderBoard();
  renderTray();
  renderTools();
}

function chooseTile(tile) {
  if (completed) {
    return;
  }
  if (notesMode) {
    toggleNote(tile);
  } else {
    placeTile(tile);
  }
}

function toggleNote(tile) {
  if (placements[selected] !== null) {
    announce("这一格已经放了棋子，先擦掉才能记候选。");
    return;
  }
  pushHistory();
  const list = notes[selected];
  notes[selected] = list.includes(tile) ? list.filter((item) => item !== tile) : [...list, tile].sort((a, b) => a - b);
  resetHint();
  renderAll();
  announce(`${cellName(size, selected)}：${notes[selected].includes(tile) ? "记下" : "划掉"}候选${tileName(size, tile)}。`);
  save();
}

function placeTile(tile, { fromHint = false } = {}) {
  const cell = selected;
  if (placements[cell] === tile) {
    announce(`${cellName(size, cell)}已经是${tileName(size, tile)}了。`);
    return;
  }

  pushHistory();
  const before = [...placements];
  const moved = placements.indexOf(tile);
  if (moved !== -1) {
    placements[moved] = null;
    before[moved] = null;
  }
  before[cell] = null;
  placements[cell] = tile;
  notes = notes.map((list, index) => (index === cell ? [] : list.filter((item) => item !== tile)));
  lastPlacement = { cell, tile, before, reasoned: false };
  resetHint();

  const states = clueStates();
  const broken = states.flatMap((state, index) =>
    state === "violated" && previousStates[index] !== "violated" ? [index] : [],
  );
  const fixed = states.flatMap((state, index) =>
    state === "satisfied" && previousStates[index] !== "satisfied" ? [index] : [],
  );
  previousStates = states;

  const where = `${cellName(size, cell)}放${tileName(size, tile)}`;
  if (placedCount() === size * size && isSolved(puzzle, placements)) {
    renderAll();
    dropIn(cells[cell].querySelector(".tl-tile"));
    finish();
    return;
  }

  if (placements[cell] === tile && placedCount() < size * size) {
    selected = placements[nextEmptyCell(cell)] === null ? nextEmptyCell(cell) : cell;
  }
  renderAll();
  dropIn(cells[cell].querySelector(".tl-tile"));
  focusCell(cells, selected);

  if (broken.length > 0) {
    if (!fromHint) {
      stats.mistakes += 1;
    }
    announce(`${where}：第${numbers(broken)}条被打破了——${describeClue(size, puzzle.clues[broken[0]])}。`, "error");
  } else if (fromHint) {
    announce(`提示 4/4：${where}。`, "success");
  } else if (fixed.length > 0) {
    announce(`${where}。第${numbers(fixed)}条成立了。`, "success");
  } else {
    announce(`${where}。`);
  }
  save();
}

function erase() {
  if (completed) {
    return;
  }
  if (placements[selected] === null && notes[selected].length === 0) {
    announce("这一格是空的。");
    return;
  }
  pushHistory();
  const tile = placements[selected];
  placements[selected] = null;
  notes[selected] = [];
  lastPlacement = null;
  resetHint();
  previousStates = clueStates();
  renderAll();
  announce(tile === null ? "擦掉了这一格的候选。" : `把${tileName(size, tile)}拿回了托盘。`);
  save();
}

function undo() {
  if (history.length === 0 || completed) {
    announce("还没有可以撤销的一步。");
    return;
  }
  const previous = history.pop();
  placements = previous.placements;
  notes = previous.notes;
  lastPlacement = null;
  resetHint();
  previousStates = clueStates();
  renderAll();
  announce("退回了一步。");
  save();
}

function applyHint() {
  const { step, stage } = hint;
  stats.hintSteps += 1;

  if (step.kind === "conflict") {
    if (stage === 1) {
      announce(`提示 1/4：${step.explanation}`, "alert");
    } else if (stage < 4) {
      announce(`提示 ${stage}/4：亮红框的格子放错了，试试擦掉重新想。`, "alert");
    } else {
      pushHistory();
      for (const cell of step.wrongCells) {
        placements[cell] = null;
      }
      lastPlacement = null;
      hint = null;
      previousStates = clueStates();
      announce("提示 4/4：已经把放错的棋子拿回托盘。", "success");
      save();
    }
    renderAll();
    return;
  }

  if (stage === 1) {
    announce(
      step.clues.length > 0
        ? `提示 1/4：先看第${numbers(step.clues)}条线索。`
        : "提示 1/4：数一数，棋盘上还剩几个空格？",
    );
  } else if (stage === 2) {
    announce(`提示 2/4：${step.explanation}`);
  } else if (stage === 3) {
    selected = step.cell;
    focusCell(cells, selected);
    announce(`提示 3/4：答案在${cellName(size, step.cell)}这一格，想想放哪一块？`);
  } else {
    selected = step.cell;
    stats.answersShown += 1;
    placeTile(step.tile, { fromHint: true });
    return;
  }
  renderAll();
  save();
}

function showHint() {
  if (completed) {
    return;
  }
  if (hint === null) {
    const step = nextDeduction(puzzle, placements);
    if (step.kind === "done") {
      announce("每一块都放好了。");
      return;
    }
    hint = { step, stage: 0 };
  }
  hint.stage = Math.min(4, hint.stage + 1);
  applyHint();
}

function openReasons() {
  if (lastPlacement === null) {
    announce("先放一块棋子，再来说理由。");
    return;
  }
  const { cell, tile } = lastPlacement;
  reasonQuestion.textContent = `你是根据哪几条线索，把${tileName(size, tile)}放在${cellName(size, cell)}的？`;
  reasonResult.textContent = "";
  reasonResult.className = "reason-result";
  reasonChips.replaceChildren(
    ...puzzle.clues.map((clue, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "reason-chip";
      chip.dataset.index = String(index);
      chip.setAttribute("aria-pressed", "false");
      chip.textContent = `${CIRCLED[index] ?? index + 1} ${describeClue(size, clue)}`;
      chip.addEventListener("click", () => {
        chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
      });
      return chip;
    }),
  );
  reasonPanel.showModal();
}

function checkReasons() {
  const chosen = [...reasonChips.querySelectorAll('[aria-pressed="true"]')].map((chip) =>
    Number(chip.dataset.index),
  );
  if (chosen.length === 0) {
    reasonResult.textContent = "先点选你用到的线索，可以选好几条。";
    return;
  }

  const { cell, tile, before } = lastPlacement;
  let message;
  let good = false;
  if (puzzle.solution[cell] !== tile) {
    message = "这几条线索推不出这一格。回头看看，这块是不是放得不太对？";
  } else {
    const result = explainReasons(puzzle, before, cell, tile, chosen);
    if (result.sufficient) {
      good = true;
      const shorter = result.minimal !== null && result.minimal.length < chosen.length;
      if (result.minimal !== null && result.minimal.length === 0) {
        message = "✓ 理由成立！其实这时只剩这一格、这一块，不看线索也能放。";
      } else if (shorter) {
        message = `✓ 理由成立！其实只用第${numbers(result.minimal)}条就够了。`;
      } else {
        message = "✓ 理由成立！就是这几条线索推出来的。";
      }
    } else {
      const other =
        result.counterexampleCell !== null && result.counterexampleCell !== cell
          ? `只看这几条，${tileName(size, tile)}也可能放在${cellName(size, result.counterexampleCell)}。`
          : "只看这几条，这一格还可能放别的棋子。";
      const missing = (result.suggestion ?? []).filter((index) => !chosen.includes(index));
      message = `还不够：${other}${missing.length > 0 ? `再想想第${numbers(missing)}条？` : ""}`;
    }
  }

  reasonResult.textContent = message;
  reasonResult.className = `reason-result ${good ? "is-good" : "is-open"}`;
  if (good && !lastPlacement.reasoned) {
    lastPlacement.reasoned = true;
    stats.reasonsGood += 1;
    save();
  }
  announce(message, good ? "success" : "neutral");
}

function finish() {
  elapsedBase = elapsedSeconds();
  completed = true;
  completedIds = [...new Set([...completedIds, puzzle.id])];
  hint = null;
  renderAll();

  const praise =
    stats.reasonsGood > 0
      ? "能把理由说清楚，比做对更难得。"
      : stats.answersShown === 0
        ? "全靠自己推出来的，每一步都站得住。"
        : "下次试着在“哪一格”那一步就停下来，自己想答案。";
  document.querySelector("#result-summary").textContent =
    `用时 ${formatTime(elapsedBase)}，提示 ${stats.hintSteps} 步` +
    `${stats.answersShown > 0 ? `（看了 ${stats.answersShown} 次答案）` : ""}，` +
    `说对理由 ${stats.reasonsGood} 次。${praise}`;
  announce("每一条线索都成立了，推理完成！", "success");
  save();
  resultPanel.showModal();
  requestAnimationFrame(() => resultPanel.querySelector("button").focus());
}

function loadPuzzle(next, nextMode, restored = null) {
  puzzle = next;
  size = next.size;
  mode = nextMode;
  document.body.dataset.size = String(size);
  pendingLevel = next.level;
  pendingMode = nextMode;
  placements = restored?.placements ?? Array(size * size).fill(null);
  notes = restored?.notes ?? Array.from({ length: size * size }, () => []);
  history = restored?.history ?? [];
  selected = restored?.selected ?? 0;
  stats = restored?.stats ?? { hintSteps: 0, answersShown: 0, reasonsGood: 0, mistakes: 0 };
  elapsedBase = restored?.elapsedSeconds ?? 0;
  activeSince = Date.now();
  completed = restored?.finished ?? false;
  notesMode = false;
  focusClue = null;
  hint = null;
  lastPlacement = null;
  previousStates = clueStates();
  buildPuzzleView();
  levelGroup.set(pendingLevel);
  modeGroup.set(pendingMode);
  renderAll();
}

function startPuzzle(level, nextMode) {
  if (resultPanel.open) {
    resultPanel.close();
  }
  const next =
    nextMode === "daily" ? dailyPuzzle(level, new Date()) : choosePuzzle(level, completedIds);
  loadPuzzle(next, nextMode);
  announce(
    nextMode === "daily" && completedIds.includes(next.id)
      ? "今天这道已经解开过了，可以再做一遍，或者在“新题”里选“练习”。"
      : `${MODE_NAMES[nextMode]}·${LEVEL_NAMES[level]}：共 ${next.clues.length} 条线索。先读线索，再动手。`,
  );
  save();
}

function restartPuzzle() {
  loadPuzzle(puzzle, mode);
  announce("这道题从头再来。");
  save();
}

function isTileList(value, total) {
  return Array.isArray(value) && value.every((tile) => Number.isInteger(tile) && tile >= 0 && tile < total);
}

function isBoard(value, total) {
  if (!Array.isArray(value) || value.length !== total) {
    return false;
  }
  const placed = value.filter((tile) => tile !== null);
  return isTileList(placed, total) && new Set(placed).size === placed.length;
}

function isNotes(value, total) {
  return Array.isArray(value) && value.length === total && value.every((list) => isTileList(list, total));
}

function restore() {
  const session = loadSession(SAVE_KEY);
  const saved = session === null ? null : findPuzzle(session.puzzleId);
  if (saved === null) {
    return false;
  }

  const total = saved.size * saved.size;
  const history = Array.isArray(session.history)
    ? session.history.filter((entry) => isBoard(entry?.placements, total) && isNotes(entry?.notes, total))
    : [];
  if (!isBoard(session.placements, total) || !isNotes(session.notes, total)) {
    return false;
  }

  completedIds = Array.isArray(session.completedIds)
    ? session.completedIds.filter((id) => typeof id === "string")
    : [];
  const counter = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);
  loadPuzzle(saved, session.mode === "practice" ? "practice" : "daily", {
    placements: session.placements,
    notes: session.notes,
    history,
    selected: Number.isInteger(session.selected) && session.selected >= 0 && session.selected < total ? session.selected : 0,
    stats: {
      hintSteps: counter(session.stats?.hintSteps),
      answersShown: counter(session.stats?.answersShown),
      reasonsGood: counter(session.stats?.reasonsGood),
      mistakes: counter(session.stats?.mistakes),
    },
    elapsedSeconds: counter(session.elapsedSeconds),
    finished: session.finished === true && isSolved(saved, session.placements),
  });
  return true;
}

const levelGroup = bindChoiceGroup(document.querySelector('[data-setting="level"]'), (value) => {
  pendingLevel = Number(value);
});
const modeGroup = bindChoiceGroup(document.querySelector('[data-setting="mode"]'), (value) => {
  pendingMode = value === "practice" ? "practice" : "daily";
});

bindGridKeyboard(boardElement, () => cells, () => size, () => {
  focusClue = null;
  renderAll();
});

boardElement.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }
  const key = event.key.toLowerCase();
  if (/^[1-9]$/.test(key) && Number(key) <= size * size) {
    event.preventDefault();
    chooseTile(Number(key) - 1);
  } else if (key === "delete" || key === "backspace") {
    event.preventDefault();
    erase();
  } else if (key === "n") {
    event.preventDefault();
    noteButton.click();
  } else if (key === "u") {
    event.preventDefault();
    undo();
  } else if (key === "h") {
    event.preventDefault();
    showHint();
  }
});

noteButton.addEventListener("click", () => {
  notesMode = !notesMode;
  renderTray();
  renderTools();
  announce(notesMode ? "候选模式：点棋子是在格子里记笔记。" : "放子模式：点棋子就放进格子。");
});
eraseButton.addEventListener("click", erase);
undoButton.addEventListener("click", undo);
hintButton.addEventListener("click", showHint);
reasonButton.addEventListener("click", openReasons);
document.querySelector('[data-action="check-reason"]').addEventListener("click", checkReasons);
document.querySelector('[data-action="new-puzzle"]').addEventListener("click", () => {
  startPuzzle(pendingLevel, pendingMode);
});
document.querySelector('[data-action="restart"]').addEventListener("click", restartPuzzle);
resultPanel.querySelector('[data-action="next-puzzle"]').addEventListener("click", () => {
  startPuzzle(puzzle.level, "practice");
});
resultPanel.querySelector('[data-action="review"]').addEventListener("click", () => resultPanel.close());

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    elapsedBase = elapsedSeconds();
    activeSince = Date.now();
    save();
  } else {
    activeSince = Date.now();
  }
});

bindSheets();

if (restore()) {
  announce(
    completed ? "这道题已经解开了。点“新题”换一道。" : "接着上次的推理，继续吧。",
    completed ? "neutral" : "success",
  );
} else {
  startPuzzle(1, "daily");
}

registerServiceWorker();
