import {
  findConflicts,
  isSolved,
  parseGrid,
  setValue,
  toggleNote,
} from "./sudoku.js";
import { PUZZLES, choosePuzzle } from "./puzzles.js";
import { registerServiceWorker } from "./pwa.js";
import {
  clearProgress,
  loadCompletedPuzzleIds,
  loadProgress,
  saveCompletedPuzzleIds,
  saveProgress,
} from "./storage.js";

const DIFFICULTY_LABELS = Object.freeze({
  easy: "入门",
  medium: "进阶",
  hard: "挑战",
});
const MAX_HINTS = 3;

const grid = document.querySelector("#sudoku-grid");
const timer = document.querySelector("#timer");
const mistakeCount = document.querySelector("#mistake-count");
const hintCount = document.querySelector("#hint-count");
const hintButtonCount = document.querySelector("#hint-button-count");
const currentDifficulty = document.querySelector("#current-difficulty");
const puzzleNumber = document.querySelector("#puzzle-number");
const statusLine = document.querySelector("#status-message");
const statusText = document.querySelector("#status-text");
const statusMark = statusLine.querySelector(".status-line__mark");
const completionPanel = document.querySelector("#completion-panel");
const difficultyButtons = [...document.querySelectorAll("[data-difficulty]")];
const numberButtons = [...document.querySelectorAll("[data-number]")];
const noteButton = document.querySelector('[data-action="note"]');
const hintButton = document.querySelector('[data-action="hint"]');
const undoButton = document.querySelector('[data-action="undo"]');
const continueButton = document.querySelector('[data-action="continue"]');

let game = null;
let selectedDifficulty = "easy";
let completed = false;
let elapsedBase = 0;
let activeSince = Date.now();

const cellButtons = Array.from({ length: 81 }, (_, index) => {
  const button = document.createElement("button");
  const value = document.createElement("span");
  const notes = document.createElement("span");

  button.type = "button";
  button.className = "sudoku-cell";
  button.dataset.index = String(index);
  button.setAttribute("role", "gridcell");
  button.setAttribute("aria-rowindex", String(Math.floor(index / 9) + 1));
  button.setAttribute("aria-colindex", String((index % 9) + 1));
  button.tabIndex = index === 0 ? 0 : -1;

  value.className = "cell-value";
  value.setAttribute("aria-hidden", "true");
  notes.className = "cell-notes";
  notes.setAttribute("aria-hidden", "true");

  for (let note = 1; note <= 9; note += 1) {
    notes.append(document.createElement("span"));
  }

  button.append(value, notes);
  button.addEventListener("click", () => selectCell(index));
  return button;
});

const gridRows = Array.from({ length: 9 }, (_, rowIndex) => {
  const row = document.createElement("div");
  const firstCell = rowIndex * 9;

  row.className = "sudoku-row";
  row.setAttribute("role", "row");
  row.setAttribute("aria-rowindex", String(rowIndex + 1));
  row.append(...cellButtons.slice(firstCell, firstCell + 9));
  return row;
});

grid.append(...gridRows);

function emptyNotes() {
  return Array.from({ length: 81 }, () => []);
}

function firstEditableCell(givens) {
  const index = givens.findIndex((given) => !given);
  return index === -1 ? 0 : index;
}

function currentElapsedSeconds() {
  if (game === null || completed) {
    return elapsedBase;
  }

  return elapsedBase + Math.max(0, Math.floor((Date.now() - activeSince) / 1000));
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function announce(message, kind = "neutral") {
  statusText.textContent = message;
  statusMark.textContent = kind === "error" ? "×" : kind === "success" ? "✓" : "·";
}

function closeCompletionPanel() {
  if (!completionPanel.open) {
    return;
  }

  completionPanel.close();
}

function makeProgress() {
  return {
    puzzleId: game.puzzle.id,
    difficulty: game.puzzle.difficulty,
    board: [...game.board],
    notes: game.notes.map((notes) => [...notes]),
    history: game.history.map((snapshot) => ({
      board: [...snapshot.board],
      notes: snapshot.notes.map((notes) => [...notes]),
    })),
    selected: game.selected,
    noteMode: game.noteMode,
    elapsedSeconds: currentElapsedSeconds(),
    mistakes: game.mistakes,
    hints: game.hints,
    startedAt: game.startedAt,
  };
}

function saveCurrentGame() {
  if (game === null || completed) {
    return false;
  }

  return saveProgress(makeProgress());
}

function createFreshGame(puzzle) {
  const originalBoard = parseGrid(puzzle.puzzle);

  return {
    puzzle,
    solution: parseGrid(puzzle.solution),
    givens: originalBoard.map(Boolean),
    board: [...originalBoard],
    notes: emptyNotes(),
    history: [],
    selected: firstEditableCell(originalBoard.map(Boolean)),
    noteMode: false,
    mistakes: 0,
    hints: 0,
    startedAt: Date.now(),
  };
}

function restoreSavedGame(progress) {
  closeCompletionPanel();
  const puzzle = PUZZLES.find(
    (entry) => entry.id === progress.puzzleId && entry.difficulty === progress.difficulty,
  );

  if (puzzle === undefined) {
    return false;
  }

  const originalBoard = parseGrid(puzzle.puzzle);
  const givens = originalBoard.map(Boolean);
  const keepsGivens = (board) =>
    givens.every((given, index) => !given || board[index] === originalBoard[index]);

  if (!keepsGivens(progress.board) || !progress.history.every(({ board }) => keepsGivens(board))) {
    return false;
  }

  game = {
    puzzle,
    solution: parseGrid(puzzle.solution),
    givens,
    board: [...progress.board],
    notes: progress.notes.map((notes) => [...notes]),
    history: progress.history.map((snapshot) => ({
      board: [...snapshot.board],
      notes: snapshot.notes.map((notes) => [...notes]),
    })),
    selected: progress.selected ?? firstEditableCell(givens),
    noteMode: progress.noteMode,
    mistakes: progress.mistakes,
    hints: Math.min(progress.hints, MAX_HINTS),
    startedAt: progress.startedAt,
  };
  selectedDifficulty = progress.difficulty;
  elapsedBase = progress.elapsedSeconds;
  activeSince = Date.now();
  completed = false;
  renderAll();
  return true;
}

function startNewGame(difficulty = selectedDifficulty, focusBoard = false) {
  closeCompletionPanel();
  const puzzle = choosePuzzle(difficulty, loadCompletedPuzzleIds());
  if (puzzle === null) {
    announce("暂时没有这一档题目。", "error");
    return;
  }

  selectedDifficulty = difficulty;
  game = createFreshGame(puzzle);
  elapsedBase = 0;
  activeSince = Date.now();
  completed = false;
  renderAll();
  saveCurrentGame();
  announce(`已铺开一局${DIFFICULTY_LABELS[difficulty]}题。`);

  if (focusBoard) {
    cellButtons[game.selected].focus({ preventScroll: true });
  }
}

function resumeGame(focusBoard = true) {
  const progress = loadProgress();
  if (progress === null || !restoreSavedGame(progress)) {
    clearProgress();
    startNewGame(selectedDifficulty, focusBoard);
    announce("没有可继续的旧局，已为你打开新题。", "neutral");
    return;
  }

  announce("已接上次的进度。", "success");
  if (focusBoard) {
    cellButtons[game.selected].focus({ preventScroll: true });
  }
}

function isRelated(left, right) {
  const leftRow = Math.floor(left / 9);
  const leftColumn = left % 9;
  const rightRow = Math.floor(right / 9);
  const rightColumn = right % 9;

  return (
    leftRow === rightRow ||
    leftColumn === rightColumn ||
    (Math.floor(leftRow / 3) === Math.floor(rightRow / 3) &&
      Math.floor(leftColumn / 3) === Math.floor(rightColumn / 3))
  );
}

function cellLabel(index, conflicts, errors) {
  const row = Math.floor(index / 9) + 1;
  const column = (index % 9) + 1;
  const value = game.board[index];
  const notes = game.notes[index];
  const parts = [`第 ${row} 行，第 ${column} 列`];

  if (game.givens[index]) {
    parts.push(`题目给定数字 ${value}`);
  } else if (value !== 0) {
    parts.push(`填写数字 ${value}`);
  } else if (notes.length > 0) {
    parts.push(`空格，候选 ${notes.join("、")}`);
  } else {
    parts.push("空格");
  }

  if (conflicts.has(index)) {
    parts.push("存在同行、同列或同宫重复冲突");
  } else if (errors.has(index)) {
    parts.push("当前填写错误");
  }

  return parts.join("，");
}

function renderBoard() {
  const conflicts = findConflicts(game.board);
  const errors = new Set(
    game.board.flatMap((value, index) =>
      !game.givens[index] && value !== 0 && value !== game.solution[index] ? [index] : [],
    ),
  );
  const selectedValue = game.board[game.selected];

  for (const [index, button] of cellButtons.entries()) {
    const value = game.board[index];
    const related = index !== game.selected && isRelated(index, game.selected);
    const sameValue = selectedValue !== 0 && value === selectedValue && index !== game.selected;
    const valueElement = button.querySelector(".cell-value");
    const noteElements = button.querySelectorAll(".cell-notes span");

    button.classList.toggle("is-given", game.givens[index]);
    button.classList.toggle("is-selected", index === game.selected);
    button.classList.toggle("is-related", related);
    button.classList.toggle("is-same-value", sameValue);
    button.classList.toggle("is-conflict", conflicts.has(index));
    button.classList.toggle("is-error", errors.has(index));
    button.tabIndex = index === game.selected ? 0 : -1;
    button.disabled = completed;
    button.setAttribute("aria-selected", String(index === game.selected));
    button.setAttribute("aria-readonly", String(game.givens[index]));
    button.setAttribute("aria-label", cellLabel(index, conflicts, errors));

    if (conflicts.has(index) || errors.has(index)) {
      button.setAttribute("aria-invalid", "true");
    } else {
      button.removeAttribute("aria-invalid");
    }

    valueElement.textContent = value === 0 ? "" : String(value);
    noteElements.forEach((noteElement, noteIndex) => {
      const note = noteIndex + 1;
      noteElement.textContent = game.notes[index].includes(note) ? String(note) : "";
    });
  }
}

function renderTimer() {
  const seconds = currentElapsedSeconds();
  timer.textContent = formatTime(seconds);
  timer.setAttribute(
    "aria-label",
    `用时 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`,
  );
}

function renderControls() {
  difficultyButtons.forEach((button) => {
    const isSelected = button.dataset.difficulty === selectedDifficulty;
    button.setAttribute("aria-checked", String(isSelected));
    button.tabIndex = isSelected ? 0 : -1;
  });

  noteButton.setAttribute("aria-pressed", String(game.noteMode));
  undoButton.disabled = game.history.length === 0 || completed;
  hintButton.disabled = game.hints >= MAX_HINTS || completed;
  continueButton.disabled = loadProgress() === null;
  hintButtonCount.textContent = `${Math.max(0, MAX_HINTS - game.hints)} 次`;
  mistakeCount.textContent = String(game.mistakes);
  hintCount.textContent = String(game.hints);
  currentDifficulty.textContent = DIFFICULTY_LABELS[game.puzzle.difficulty];
  puzzleNumber.textContent = `第 ${game.puzzle.id.split("-")[1]} 题`;

  const counts = Array(10).fill(0);
  game.board.forEach((value) => {
    counts[value] += 1;
  });
  numberButtons.forEach((button) => {
    button.classList.toggle("is-used", counts[Number(button.dataset.number)] >= 9);
  });
}

function renderAll() {
  renderBoard();
  renderTimer();
  renderControls();
}

function selectCell(index, focus = false) {
  if (game === null || completed) {
    return;
  }

  game.selected = index;
  renderBoard();
  saveCurrentGame();

  if (focus) {
    cellButtons[index].focus({ preventScroll: true });
  }
}

function finishMove() {
  renderAll();

  const matchesSolution = game.board.every((value, index) => value === game.solution[index]);
  if (matchesSolution && isSolved(game.board)) {
    finishGame();
  } else {
    saveCurrentGame();
  }
}

function inputNumber(number) {
  const index = game?.selected;
  if (index === null || index === undefined || completed) {
    return;
  }
  if (game.givens[index]) {
    announce("这是题目给定的数字，不能修改。", "error");
    return;
  }

  const previous = game;
  if (game.noteMode) {
    game = toggleNote(game, index, number);
    if (game !== previous) {
      announce(`已${game.notes[index].includes(number) ? "记下" : "划去"}候选 ${number}。`);
      finishMove();
    }
    return;
  }

  game = setValue(game, index, number);
  if (game === previous) {
    return;
  }

  if (number !== game.solution[index]) {
    game.mistakes += 1;
    const conflicts = findConflicts(game.board);
    announce(
      conflicts.has(index)
        ? `数字 ${number} 与同行、同列或同宫重复，已用边框和 × 标出。`
        : `数字 ${number} 不合此格，已用边框和 × 标出。`,
      "error",
    );
  } else {
    announce(`第 ${Math.floor(index / 9) + 1} 行已落下数字 ${number}。`, "success");
  }
  finishMove();
}

function eraseSelected() {
  const index = game?.selected;
  if (index === null || index === undefined || completed) {
    return;
  }
  if (game.givens[index]) {
    announce("题目给定的数字不能擦除。", "error");
    return;
  }

  const previous = game;
  game = setValue(game, index, 0);
  if (game === previous) {
    announce("这一格还没有落子。", "neutral");
    return;
  }

  announce("已擦净这一格。", "neutral");
  finishMove();
}

function undoMove() {
  if (game === null || game.history.length === 0 || completed) {
    announce("还没有可以撤销的一步。", "neutral");
    return;
  }

  const snapshot = game.history.at(-1);
  game = {
    ...game,
    board: [...snapshot.board],
    notes: snapshot.notes.map((notes) => [...notes]),
    history: game.history.slice(0, -1),
  };
  announce("已退回一步。", "neutral");
  renderAll();
  saveCurrentGame();
}

function useHint() {
  if (game === null || completed) {
    return;
  }
  if (game.hints >= MAX_HINTS) {
    announce("这一局的三次提示已经用完。", "neutral");
    return;
  }

  let index = game.selected;
  if (game.givens[index] || game.board[index] === game.solution[index]) {
    index = game.board.findIndex(
      (value, candidate) => !game.givens[candidate] && value !== game.solution[candidate],
    );
  }
  if (index === -1) {
    return;
  }

  game.selected = index;
  game = setValue(game, index, game.solution[index]);
  game.hints += 1;
  announce(`提示：第 ${Math.floor(index / 9) + 1} 行第 ${(index % 9) + 1} 列是 ${game.solution[index]}。`, "success");
  finishMove();
}

function toggleNoteMode() {
  if (game === null || completed) {
    return;
  }

  game.noteMode = !game.noteMode;
  renderControls();
  saveCurrentGame();
  announce(`候选模式已${game.noteMode ? "开启" : "关闭"}。`, "neutral");
}

function restartGame() {
  if (game === null) {
    return;
  }

  closeCompletionPanel();
  const puzzle = game.puzzle;
  game = createFreshGame(puzzle);
  selectedDifficulty = puzzle.difficulty;
  elapsedBase = 0;
  activeSince = Date.now();
  completed = false;
  renderAll();
  saveCurrentGame();
  announce("已把这一局恢复到最初。", "neutral");
  cellButtons[game.selected].focus({ preventScroll: true });
}

function finishGame() {
  if (completed) {
    return;
  }

  elapsedBase = currentElapsedSeconds();
  activeSince = Date.now();
  completed = true;

  const completedIds = loadCompletedPuzzleIds();
  saveCompletedPuzzleIds([...completedIds, game.puzzle.id]);
  clearProgress();

  renderAll();
  document.querySelector("#final-time").textContent = formatTime(elapsedBase);
  document.querySelector("#final-mistakes").textContent = `${game.mistakes} 次`;
  document.querySelector("#final-hints").textContent = `${game.hints} 次`;
  document.querySelector("#completion-summary").textContent =
    `你完成了一局${DIFFICULTY_LABELS[game.puzzle.difficulty]}题，进度已在本机收好。`;
  completionPanel.showModal();
  announce("整盘完成，恭喜收笔。", "success");

  requestAnimationFrame(() => {
    completionPanel.querySelector("button").focus();
  });
}

function moveSelection(key) {
  const row = Math.floor(game.selected / 9);
  const column = game.selected % 9;
  let next = game.selected;

  if (key === "ArrowLeft" && column > 0) next -= 1;
  if (key === "ArrowRight" && column < 8) next += 1;
  if (key === "ArrowUp" && row > 0) next -= 9;
  if (key === "ArrowDown" && row < 8) next += 9;

  selectCell(next, true);
}

function selectDifficulty(difficulty, focus = false) {
  selectedDifficulty = difficulty;
  renderControls();
  announce(`下一局将使用${DIFFICULTY_LABELS[selectedDifficulty]}难度。`, "neutral");

  if (focus) {
    difficultyButtons.find((button) => button.dataset.difficulty === difficulty)?.focus();
  }
}

function handleDifficultyKeydown(event) {
  const currentIndex = difficultyButtons.indexOf(event.currentTarget);
  let nextIndex = null;

  switch (event.key) {
    case "ArrowLeft":
    case "ArrowUp":
      nextIndex = (currentIndex - 1 + difficultyButtons.length) % difficultyButtons.length;
      break;
    case "ArrowRight":
    case "ArrowDown":
      nextIndex = (currentIndex + 1) % difficultyButtons.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = difficultyButtons.length - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  selectDifficulty(difficultyButtons[nextIndex].dataset.difficulty, true);
}

grid.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || game === null || completed) {
    return;
  }

  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    moveSelection(event.key);
    return;
  }
  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    inputNumber(Number(event.key));
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    eraseSelected();
    return;
  }
  if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    toggleNoteMode();
    return;
  }
  if (event.key.toLowerCase() === "u") {
    event.preventDefault();
    undoMove();
  }
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => selectDifficulty(button.dataset.difficulty));
  button.addEventListener("keydown", handleDifficultyKeydown);
});

numberButtons.forEach((button) => {
  button.addEventListener("click", () => inputNumber(Number(button.dataset.number)));
});

document.querySelector('[data-action="new-game"]').addEventListener("click", () => {
  startNewGame(selectedDifficulty, true);
});
continueButton.addEventListener("click", () => resumeGame(true));
document.querySelector('[data-action="restart"]').addEventListener("click", restartGame);
noteButton.addEventListener("click", toggleNoteMode);
document.querySelector('[data-action="erase"]').addEventListener("click", eraseSelected);
undoButton.addEventListener("click", undoMove);
hintButton.addEventListener("click", useHint);
document.querySelector('[data-action="same-difficulty"]').addEventListener("click", () => {
  startNewGame(game.puzzle.difficulty, true);
});
completionPanel.addEventListener("cancel", (event) => {
  event.preventDefault();
  announce("本局已经完成，请选择同难度再来一局。", "neutral");
});

window.addEventListener("beforeunload", saveCurrentGame);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveCurrentGame();
  }
});

const savedProgress = loadProgress();
if (savedProgress !== null && restoreSavedGame(savedProgress)) {
  announce("上次的练习已经接好，可以继续落子。", "success");
} else {
  if (savedProgress !== null) {
    clearProgress();
  }
  startNewGame("easy");
}

setInterval(() => {
  if (!completed) {
    renderTimer();
    saveCurrentGame();
  }
}, 1000);

registerServiceWorker();
