import * as xiangqi from "./xiangqi.js";
import {
  LEVEL_NAMES,
  bindChoiceGroup,
  bindSheets,
  bindGridKeyboard,
  createAiClient,
  createAnnouncer,
  createConfirmButton,
  delay,
  focusCell,
  isCancelled,
  loadSession,
  renderMoveRecord,
  saveSession,
  slideFrom,
} from "./game-kit.js";
import { registerServiceWorker } from "./pwa.js";

const {
  applyMove,
  createInitialPosition,
  getGameStatus,
  isInCheck,
  legalMovesFrom,
  moveToNotation,
  positionKey,
} = xiangqi;

const SAVE_KEY = "yike-xiangqi:v1";
const COLUMNS = 9;
const ROWS = 10;
const MIN_THINK_MS = 450;
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
const SIDE_NAMES = Object.freeze({ r: "红方", b: "黑方" });
const RED_FILES = Object.freeze(["九", "八", "七", "六", "五", "四", "三", "二", "一"]);
const BLACK_FILES = Object.freeze(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const INITIAL_COUNTS = Object.freeze({ R: 2, N: 2, C: 2, B: 2, A: 2, P: 5, K: 1 });
const DRAW_REASONS = Object.freeze({
  repetition: "同一局面出现了三次",
  "move-limit": "双方 60 回合都没有吃子",
  material: "双方都没有能过河进攻的棋子了",
});

const boardElement = document.querySelector("#board");
const filesTop = document.querySelector("#files-top");
const filesBottom = document.querySelector("#files-bottom");
const modeLabel = document.querySelector("#mode-label");
const moveRecord = document.querySelector("#move-record");
const moveCount = document.querySelector("#move-count");
const resultPanel = document.querySelector("#result-panel");
const strips = {
  top: document.querySelector("#player-top"),
  bottom: document.querySelector("#player-bottom"),
};
const undoButton = document.querySelector('[data-action="undo"]');
const hintButton = document.querySelector('[data-action="hint"]');
const flipButton = document.querySelector('[data-action="flip"]');
const resignButton = document.querySelector('[data-action="resign"]');
const announce = createAnnouncer(document.querySelector("#status-message"));
const ai = createAiClient("xiangqi", xiangqi);

let settings = { opponent: "ai", level: 1, side: "r", flipped: false };
let positions = [createInitialPosition()];
let moves = [];
let notations = [];
let selected = null;
let targets = [];
let hint = null;
let result = null;
let thinking = false;
let thinkingToken = 0;
let hintsUsed = 0;

const cells = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "board-cell";
  cell.setAttribute("role", "gridcell");
  cell.tabIndex = index === 85 ? 0 : -1;
  cell.addEventListener("click", () => activateCell(index));
  return cell;
});

boardElement.append(
  ...Array.from({ length: ROWS }, (_, row) => {
    const element = document.createElement("div");
    element.className = "board-row";
    element.setAttribute("role", "row");
    element.append(...cells.slice(row * COLUMNS, (row + 1) * COLUMNS));
    return element;
  }),
);

function other(side) {
  return side === "r" ? "b" : "r";
}

function current() {
  return positions.at(-1);
}

function sideOf(piece) {
  return piece === piece.toUpperCase() ? "r" : "b";
}

function isAiTurn() {
  return settings.opponent === "ai" && result === null && current().turn !== settings.side;
}

function bottomSide() {
  const base = settings.opponent === "ai" ? settings.side : "r";
  return settings.flipped ? other(base) : base;
}

function squareAt(cellIndex) {
  return bottomSide() === "r" ? cellIndex : COLUMNS * ROWS - 1 - cellIndex;
}

function cellOf(square) {
  return bottomSide() === "r" ? square : COLUMNS * ROWS - 1 - square;
}

function checkedGeneral(position) {
  if (!isInCheck(position)) {
    return null;
  }
  return position.board.indexOf(position.turn === "r" ? "K" : "k");
}

function syncPiece(cell, piece) {
  const key = piece ?? "";
  if (cell.dataset.piece === key) {
    return;
  }

  cell.dataset.piece = key;
  if (piece === null) {
    cell.replaceChildren();
    return;
  }

  const element = document.createElement("span");
  element.className = `xq-piece xq-piece--${sideOf(piece) === "r" ? "red" : "black"}`;
  element.textContent = PIECE_NAMES[piece];
  element.setAttribute("aria-hidden", "true");
  cell.replaceChildren(element);
}

function describeCell(index, square, piece, target) {
  const parts = [`第 ${Math.floor(index / COLUMNS) + 1} 行第 ${(index % COLUMNS) + 1} 列`];
  parts.push(piece === null ? "空" : `${SIDE_NAMES[sideOf(piece)]}${PIECE_NAMES[piece]}`);
  if (square === selected) {
    parts.push("已选中");
  }
  if (target !== undefined) {
    parts.push(target.captured ? "可以吃掉" : "可以走到这里");
  }
  return parts.join("，");
}

function renderBoard() {
  const position = current();
  const lastMove = moves.at(-1) ?? null;
  const checked = result === null || result.state === "checkmate" ? checkedGeneral(position) : null;
  const targetMoves = new Map(targets.map((move) => [move.to, move]));

  cells.forEach((cell, index) => {
    const square = squareAt(index);
    const piece = position.board[square];
    const target = targetMoves.get(square);

    syncPiece(cell, piece);
    cell.classList.toggle("is-selected", square === selected);
    cell.classList.toggle("is-target", target !== undefined && !target.captured);
    cell.classList.toggle("is-capture", target !== undefined && Boolean(target.captured));
    cell.classList.toggle("is-last-from", lastMove?.from === square);
    cell.classList.toggle("is-last-to", lastMove?.to === square);
    cell.classList.toggle("is-checked", square === checked);
    cell.classList.toggle("is-hint-from", hint?.from === square);
    cell.classList.toggle("is-hint-to", hint?.to === square);
    cell.setAttribute("aria-selected", String(square === selected));
    cell.setAttribute("aria-label", describeCell(index, square, piece, target));
  });
}

function fillLabels(container, labels) {
  container.replaceChildren(
    ...labels.map((label) => {
      const span = document.createElement("span");
      span.textContent = label;
      return span;
    }),
  );
}

function renderFiles() {
  const redAtBottom = bottomSide() === "r";
  fillLabels(filesBottom, redAtBottom ? RED_FILES : [...BLACK_FILES].reverse());
  fillLabels(filesTop, redAtBottom ? BLACK_FILES : [...RED_FILES].reverse());
}

function capturedBy(side, position) {
  const counts = new Map();
  for (const piece of position.board) {
    if (piece !== null) {
      counts.set(piece, (counts.get(piece) ?? 0) + 1);
    }
  }

  const captured = [];
  for (const [type, initial] of Object.entries(INITIAL_COUNTS)) {
    const letter = side === "r" ? type.toLowerCase() : type;
    for (let lost = initial - (counts.get(letter) ?? 0); lost > 0; lost -= 1) {
      captured.push(letter);
    }
  }
  return captured;
}

function whoLabel(side) {
  if (settings.opponent === "human") {
    return "玩家";
  }
  return side === settings.side ? "你" : `电脑 · ${LEVEL_NAMES[settings.level]}`;
}

function renderStrip(strip, side, position) {
  const active = result === null && position.turn === side;
  strip.querySelector(".player-strip__mark").dataset.side = side === "r" ? "red" : "black";
  strip.querySelector("strong").textContent = SIDE_NAMES[side];
  strip.querySelector(".player-strip__who").textContent = whoLabel(side);
  strip.classList.toggle("is-active", active);
  strip.classList.toggle("is-thinking", active && thinking);

  const captures = strip.querySelector(".player-strip__captures");
  captures.setAttribute("aria-label", `${SIDE_NAMES[side]}吃掉的棋子`);
  captures.replaceChildren(
    ...capturedBy(side, position).map((piece) => {
      const chip = document.createElement("span");
      chip.className = `capture-chip capture-chip--${sideOf(piece) === "r" ? "red" : "black"}`;
      chip.textContent = PIECE_NAMES[piece];
      return chip;
    }),
  );
}

function renderPlayers() {
  const position = current();
  const bottom = bottomSide();
  renderStrip(strips.bottom, bottom, position);
  renderStrip(strips.top, other(bottom), position);
}

const choiceGroups = new Map(
  [...document.querySelectorAll("[data-setting]")].map((group) => [
    group.dataset.setting,
    bindChoiceGroup(group, (value) => changeSetting(group.dataset.setting, value)),
  ]),
);

function renderControls() {
  modeLabel.textContent =
    settings.opponent === "ai"
      ? `人机 · ${LEVEL_NAMES[settings.level]} · 执${settings.side === "r" ? "红" : "黑"}`
      : "两人同屏";
  undoButton.disabled = moves.length === 0 && result?.state !== "resign";
  hintButton.disabled = result !== null || thinking || isAiTurn();
  resignButton.disabled = result !== null || moves.length === 0;
  flipButton.setAttribute("aria-pressed", String(settings.flipped));
  moveCount.textContent = moves.length === 0 ? "还没走" : `共 ${moves.length} 步`;

  for (const [name, group] of choiceGroups) {
    group.set(settings[name]);
  }
}

function renderAll() {
  renderBoard();
  renderFiles();
  renderPlayers();
  renderControls();
  renderMoveRecord(moveRecord, notations, { emptyText: "还没有走棋。红方先走。" });
}

function save() {
  saveSession(SAVE_KEY, {
    settings,
    moves,
    finished: result !== null,
    result,
    hintsUsed,
  });
}

function clearSelection() {
  selected = null;
  targets = [];
}

function stopThinking() {
  thinkingToken += 1;
  thinking = false;
  ai.cancel();
}

function closeResult() {
  if (resultPanel.open) {
    resultPanel.close();
  }
}

function describeResult({ state, winner, reason }) {
  const humanSide = settings.opponent === "ai" ? settings.side : null;
  let outcome = "neutral";
  if (winner === null) {
    outcome = "draw";
  } else if (humanSide !== null) {
    outcome = winner === humanSide ? "win" : "loss";
  }

  let title;
  switch (state) {
    case "checkmate":
      title = `将死！${SIDE_NAMES[winner]}胜`;
      break;
    case "stalemate":
      title = `困毙！${SIDE_NAMES[other(winner)]}无棋可走，${SIDE_NAMES[winner]}胜`;
      break;
    case "resign":
      title = `${SIDE_NAMES[other(winner)]}认输，${SIDE_NAMES[winner]}胜`;
      break;
    default:
      title = `和棋：${DRAW_REASONS[reason] ?? "双方握手言和"}`;
  }

  const steps = `共走了 ${moves.length} 步${hintsUsed > 0 ? `，用了 ${hintsUsed} 次提示` : ""}。`;
  const advice = {
    win: "想一想，哪一步最关键？",
    loss: "可以悔棋回去换一种走法，或者把电脑调低一档再试。",
    draw: "势均力敌，再来一局分个高下？",
    neutral: "复盘一下，看看转折点在哪里。",
  }[outcome];
  const seal = { win: "胜", loss: "负", draw: "和", neutral: "终局" }[outcome];

  return { title, summary: `${steps}${advice}`, seal };
}

function finish(status) {
  result = { state: status.state, winner: status.winner ?? null, reason: status.reason ?? null };
  clearSelection();
  hint = null;
  renderAll();

  const { title, summary, seal } = describeResult(result);
  document.querySelector("#result-title").textContent = title;
  document.querySelector("#result-summary").textContent = summary;
  document.querySelector("#result-seal").textContent = seal;
  announce(title, "success");
  save();

  if (!resultPanel.open) {
    resultPanel.showModal();
    requestAnimationFrame(() => resultPanel.querySelector("button").focus());
  }
}

function playMove(move) {
  const position = current();
  const fromRect =
    cells[cellOf(move.from)].querySelector(".xq-piece")?.getBoundingClientRect() ?? null;
  const next = applyMove(position, move);
  const notation = moveToNotation(position, move);

  positions.push(next);
  moves.push({ from: move.from, to: move.to });
  notations.push(notation);
  clearSelection();
  hint = null;
  renderAll();
  slideFrom(cells[cellOf(move.to)].querySelector(".xq-piece"), fromRect);

  const status = getGameStatus(next, positions.map(positionKey));
  if (status.state !== "playing") {
    finish(status);
    return;
  }

  announce(
    `${SIDE_NAMES[position.turn]}：${notation}${status.inCheck ? "。将军！" : "。"}`,
    status.inCheck ? "alert" : "neutral",
  );
  save();

  if (isAiTurn()) {
    requestAiMove();
  }
}

async function requestAiMove() {
  const token = ++thinkingToken;
  const started = performance.now();
  thinking = true;
  renderPlayers();
  renderControls();

  try {
    const move = await ai.request(current(), {
      level: settings.level,
      history: positions.map(positionKey),
    });
    const remaining = MIN_THINK_MS - (performance.now() - started);
    if (remaining > 0) {
      await delay(remaining);
    }
    if (token !== thinkingToken) {
      return;
    }

    thinking = false;
    if (move === null) {
      renderAll();
      return;
    }
    playMove(move);
  } catch (error) {
    if (token !== thinkingToken || isCancelled(error)) {
      return;
    }
    thinking = false;
    renderAll();
    announce("电脑这一步没有想出来，可以悔棋或新开一局。", "error");
  }
}

async function showHint() {
  if (result !== null || thinking || isAiTurn()) {
    return;
  }

  const position = current();
  hintButton.disabled = true;
  announce("帮你想一想……");

  try {
    const move = await ai.request(position, {
      level: 3,
      timeLimitMs: 900,
      history: positions.map(positionKey),
    });
    if (current() !== position || move === null) {
      return;
    }

    hint = { from: move.from, to: move.to };
    hintsUsed += 1;
    clearSelection();
    renderAll();
    announce(`提示：${moveToNotation(position, move)}。虚线圈标出了起点和落点。`, "success");
    save();
  } catch (error) {
    if (!isCancelled(error) && current() === position) {
      announce("这次没想出好的提示。", "error");
    }
  } finally {
    renderControls();
  }
}

function activateCell(index) {
  focusCell(cells, index);

  if (result !== null) {
    announce("这一局已经结束。可以悔棋，也可以新开一局。");
    return;
  }
  if (thinking || isAiTurn()) {
    announce("电脑正在想，稍等一下。");
    return;
  }

  const position = current();
  const square = squareAt(index);
  const piece = position.board[square];
  const move = targets.find((candidate) => candidate.to === square);

  if (selected !== null && move !== undefined) {
    playMove(move);
    return;
  }

  if (piece !== null && sideOf(piece) === position.turn) {
    if (selected === square) {
      clearSelection();
      renderBoard();
      announce("放下了这个棋子。");
      return;
    }

    selected = square;
    targets = legalMovesFrom(position, square);
    renderBoard();
    if (targets.length === 0) {
      announce(
        isInCheck(position)
          ? `正在被将军，这个${PIECE_NAMES[piece]}解不了将，换一个棋子。`
          : `这个${PIECE_NAMES[piece]}现在走不了。`,
        "error",
      );
    } else {
      announce(`选中了${PIECE_NAMES[piece]}。红点是能走的地方，红圈是能吃的子。`);
    }
    return;
  }

  if (selected !== null) {
    clearSelection();
    renderBoard();
    announce(isInCheck(position) ? "正在被将军，要先解将。" : "那里走不到，再看看红点。", "error");
    return;
  }

  if (piece !== null) {
    announce(`现在轮到${SIDE_NAMES[position.turn]}走。`);
  }
}

function popMove() {
  positions.pop();
  moves.pop();
  notations.pop();
}

function undo() {
  if (result?.state === "resign") {
    stopThinking();
    closeResult();
    result = null;
    renderAll();
    announce("收回认输，接着下。");
    save();
    if (isAiTurn()) {
      requestAiMove();
    }
    return;
  }
  if (moves.length === 0) {
    announce("还没有可以悔的棋。");
    return;
  }

  stopThinking();
  closeResult();
  result = null;
  popMove();
  if (settings.opponent === "ai" && moves.length > 0 && current().turn !== settings.side) {
    popMove();
  }
  clearSelection();
  hint = null;
  renderAll();
  announce("悔了一步，想好再走。");
  save();

  if (isAiTurn()) {
    requestAiMove();
  }
}

function newGame() {
  stopThinking();
  closeResult();
  positions = [createInitialPosition()];
  moves = [];
  notations = [];
  clearSelection();
  hint = null;
  result = null;
  hintsUsed = 0;
  renderAll();

  if (settings.opponent === "human") {
    announce("新局开始，红方先走。");
  } else {
    announce(settings.side === "r" ? "新局开始，你执红先走。" : "新局开始，电脑执红先走。");
  }
  save();

  if (isAiTurn()) {
    requestAiMove();
  }
}

function resign() {
  if (result !== null || moves.length === 0) {
    return;
  }
  stopThinking();
  const loser = settings.opponent === "ai" ? settings.side : current().turn;
  finish({ state: "resign", winner: other(loser), reason: null });
}

function changeSetting(name, value) {
  if (name === "level") {
    settings.level = Number(value);
    renderPlayers();
    renderControls();
    announce(`电脑难度改为「${LEVEL_NAMES[settings.level]}」。`);
    save();
    return;
  }

  stopThinking();
  if (name === "opponent") {
    settings.opponent = value === "human" ? "human" : "ai";
    announce(settings.opponent === "ai" ? "改为和电脑下。" : "改为两人同屏，轮流走棋。");
  } else if (name === "side") {
    settings.side = value === "b" ? "b" : "r";
    settings.flipped = false;
    announce(`你执${SIDE_NAMES[settings.side]}。`);
  }

  clearSelection();
  renderAll();
  save();
  if (isAiTurn()) {
    requestAiMove();
  }
}

function sanitizeSettings(raw) {
  return {
    opponent: raw?.opponent === "human" ? "human" : "ai",
    level: [1, 2, 3].includes(raw?.level) ? raw.level : 1,
    side: raw?.side === "b" ? "b" : "r",
    flipped: raw?.flipped === true,
  };
}

function restore() {
  const session = loadSession(SAVE_KEY);
  if (session === null || !Array.isArray(session.moves)) {
    return false;
  }

  try {
    let position = createInitialPosition();
    const restoredPositions = [position];
    const restoredMoves = [];
    const restoredNotations = [];

    for (const move of session.moves) {
      const next = applyMove(position, move);
      restoredNotations.push(moveToNotation(position, move));
      restoredMoves.push({ from: move.from, to: move.to });
      restoredPositions.push(next);
      position = next;
    }

    settings = sanitizeSettings(session.settings);
    positions = restoredPositions;
    moves = restoredMoves;
    notations = restoredNotations;
    hintsUsed = Number.isInteger(session.hintsUsed) && session.hintsUsed >= 0 ? session.hintsUsed : 0;

    const status = getGameStatus(position, positions.map(positionKey));
    if (status.state !== "playing") {
      result = { state: status.state, winner: status.winner ?? null, reason: status.reason ?? null };
    } else if (session.result?.state === "resign" && ["r", "b"].includes(session.result.winner)) {
      result = { state: "resign", winner: session.result.winner, reason: null };
    }
    return true;
  } catch {
    return false;
  }
}

bindGridKeyboard(boardElement, cells, COLUMNS, () => {
  clearSelection();
  renderBoard();
  announce("取消了选择。");
});

for (const button of document.querySelectorAll('[data-action="new-game"]')) {
  button.addEventListener("click", newGame);
}
undoButton.addEventListener("click", undo);
hintButton.addEventListener("click", showHint);
flipButton.addEventListener("click", () => {
  settings.flipped = !settings.flipped;
  clearSelection();
  renderAll();
  save();
  announce("棋盘翻转过来了。");
});
createConfirmButton(resignButton, "认输", "确认？", resign);
resultPanel.querySelector('[data-action="again"]').addEventListener("click", newGame);
resultPanel.querySelector('[data-action="review"]').addEventListener("click", closeResult);

bindSheets();

const restored = restore();
renderAll();
if (!restored || moves.length === 0) {
  announce(
    isAiTurn() ? "电脑执红先走。" : "红方先走。点一下棋子，看看它能走到哪里。",
  );
} else if (result !== null) {
  announce("上一局已经下完了。点「新开一局」再来，或者悔棋复盘。");
} else {
  announce("已接上次的棋局，继续下吧。", "success");
}
if (isAiTurn()) {
  requestAiMove();
}

registerServiceWorker();
