import * as chess from "./chess.js";
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
  generateLegalMoves,
  getGameStatus,
  isInCheck,
  legalMovesFrom,
  moveToSan,
  positionKey,
} = chess;

const SAVE_KEY = "yike-chess:v1";
const SIZE = 8;
const MIN_THINK_MS = 450;
const SVG_NS = "http://www.w3.org/2000/svg";
const FILES = "abcdefgh";
const SIDE_NAMES = Object.freeze({ w: "白方", b: "黑方" });
const PIECE_NAMES = Object.freeze({ k: "王", q: "后", r: "车", b: "象", n: "马", p: "兵" });
const CAPTURE_ORDER = "qrbnp";
const DRAW_REASONS = Object.freeze({
  stalemate: "逼和——轮到的一方无子可动，又没有被将军",
  repetition: "同一局面出现了三次",
  "fifty-move": "50 回合没有吃子，也没有动兵",
  material: "双方剩下的子力都不足以将死对方",
});

const boardElement = document.querySelector("#board");
const modeLabel = document.querySelector("#mode-label");
const moveRecord = document.querySelector("#move-record");
const moveCount = document.querySelector("#move-count");
const resultPanel = document.querySelector("#result-panel");
const promotionPanel = document.querySelector("#promotion-panel");
const strips = {
  top: document.querySelector("#player-top"),
  bottom: document.querySelector("#player-bottom"),
};
const undoButton = document.querySelector('[data-action="undo"]');
const hintButton = document.querySelector('[data-action="hint"]');
const flipButton = document.querySelector('[data-action="flip"]');
const resignButton = document.querySelector('[data-action="resign"]');
const announce = createAnnouncer(document.querySelector("#status-message"));
const ai = createAiClient("chess", chess);

let settings = { opponent: "ai", level: 1, side: "w", flipped: false };
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
let promotionChoice = null;

const cells = Array.from({ length: SIZE * SIZE }, (_, index) => {
  const cell = document.createElement("button");
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  cell.type = "button";
  cell.className = "board-cell";
  cell.classList.toggle("is-dark", (row + column) % 2 === 1);
  cell.setAttribute("role", "gridcell");
  cell.tabIndex = index === 52 ? 0 : -1;
  cell.addEventListener("click", () => activateCell(index));
  return cell;
});

boardElement.append(
  ...Array.from({ length: SIZE }, (_, row) => {
    const element = document.createElement("div");
    element.className = "board-row";
    element.setAttribute("role", "row");
    element.append(...cells.slice(row * SIZE, (row + 1) * SIZE));
    return element;
  }),
);

function other(side) {
  return side === "w" ? "b" : "w";
}

function current() {
  return positions.at(-1);
}

function colorOf(piece) {
  return piece === piece.toUpperCase() ? "w" : "b";
}

function isAiTurn() {
  return settings.opponent === "ai" && result === null && current().turn !== settings.side;
}

function bottomSide() {
  const base = settings.opponent === "ai" ? settings.side : "w";
  return settings.flipped ? other(base) : base;
}

function squareAt(cellIndex) {
  return bottomSide() === "w" ? cellIndex : SIZE * SIZE - 1 - cellIndex;
}

function cellOf(square) {
  return bottomSide() === "w" ? square : SIZE * SIZE - 1 - square;
}

function squareName(square) {
  return `${FILES[square % SIZE]}${SIZE - Math.floor(square / SIZE)}`;
}

function pieceLabel(piece) {
  return `${SIDE_NAMES[colorOf(piece)]}${PIECE_NAMES[piece.toLowerCase()]}`;
}

function createPieceIcon(piece, className = "chess-piece") {
  const svg = document.createElementNS(SVG_NS, "svg");
  const use = document.createElementNS(SVG_NS, "use");
  svg.setAttribute("class", `${className} chess-piece--${colorOf(piece)}`);
  svg.setAttribute("viewBox", "5 4 90 92");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", `#piece-${piece.toLowerCase()}`);
  svg.append(use);
  return svg;
}

function syncCell(cell, index, piece) {
  const square = squareAt(index);
  const key = `${piece ?? ""}|${square}`;
  if (cell.dataset.key === key) {
    return;
  }

  cell.dataset.key = key;
  const children = [];
  if (piece !== null) {
    children.push(createPieceIcon(piece));
  }

  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  if (row === SIZE - 1) {
    const file = document.createElement("span");
    file.className = "coord coord--file";
    file.textContent = FILES[square % SIZE];
    file.setAttribute("aria-hidden", "true");
    children.push(file);
  }
  if (column === 0) {
    const rank = document.createElement("span");
    rank.className = "coord coord--rank";
    rank.textContent = String(SIZE - Math.floor(square / SIZE));
    rank.setAttribute("aria-hidden", "true");
    children.push(rank);
  }
  cell.replaceChildren(...children);
}

function checkedKing(position) {
  if (!isInCheck(position)) {
    return null;
  }
  return position.board.indexOf(position.turn === "w" ? "K" : "k");
}

function describeCell(square, piece, target) {
  const parts = [squareName(square), piece === null ? "空" : pieceLabel(piece)];
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
  const checked = result === null || result.state === "checkmate" ? checkedKing(position) : null;
  const targetMoves = new Map(targets.map((move) => [move.to, move]));

  cells.forEach((cell, index) => {
    const square = squareAt(index);
    const piece = position.board[square];
    const target = targetMoves.get(square);

    syncCell(cell, index, piece);
    cell.classList.toggle("is-selected", square === selected);
    cell.classList.toggle("is-target", target !== undefined && !target.captured);
    cell.classList.toggle("is-capture", target !== undefined && Boolean(target.captured));
    cell.classList.toggle("is-last-from", lastMove?.from === square);
    cell.classList.toggle("is-last-to", lastMove?.to === square);
    cell.classList.toggle("is-checked", square === checked);
    cell.classList.toggle("is-hint-from", hint?.from === square);
    cell.classList.toggle("is-hint-to", hint?.to === square);
    cell.setAttribute("aria-selected", String(square === selected));
    cell.setAttribute("aria-label", describeCell(square, piece, target));
  });
}

function capturedBy(side) {
  return moves
    .filter((move) => colorOf(move.piece) === side && move.captured)
    .map((move) => move.captured)
    .sort((left, right) =>
      CAPTURE_ORDER.indexOf(left.toLowerCase()) - CAPTURE_ORDER.indexOf(right.toLowerCase()),
    );
}

function whoLabel(side) {
  if (settings.opponent === "human") {
    return "玩家";
  }
  return side === settings.side ? "你" : `电脑 · ${LEVEL_NAMES[settings.level]}`;
}

function renderStrip(strip, side, position) {
  const active = result === null && position.turn === side;
  strip.querySelector(".player-strip__mark").dataset.side = side === "w" ? "light" : "dark";
  strip.querySelector("strong").textContent = SIDE_NAMES[side];
  strip.querySelector(".player-strip__who").textContent = whoLabel(side);
  strip.classList.toggle("is-active", active);
  strip.classList.toggle("is-thinking", active && thinking);

  const captures = strip.querySelector(".player-strip__captures");
  captures.setAttribute("aria-label", `${SIDE_NAMES[side]}吃掉的棋子`);
  captures.replaceChildren(
    ...capturedBy(side).map((piece) => createPieceIcon(piece, "capture-piece")),
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
    settings.opponent === "ai" ? `人机 · ${LEVEL_NAMES[settings.level]}` : "两人同屏";
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
  renderPlayers();
  renderControls();
  renderMoveRecord(moveRecord, notations, { emptyText: "还没有走棋。白方先走。" });
}

function save() {
  saveSession(SAVE_KEY, {
    settings,
    moves: moves.map(({ from, to, promotion }) => ({ from, to, promotion: promotion ?? null })),
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
  if (state === "checkmate") {
    title = `将死！${SIDE_NAMES[winner]}胜`;
  } else if (state === "resign") {
    title = `${SIDE_NAMES[other(winner)]}认输，${SIDE_NAMES[winner]}胜`;
  } else {
    title = `和棋：${DRAW_REASONS[reason ?? state] ?? "双方握手言和"}`;
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
  result = {
    state: status.state,
    winner: status.winner ?? null,
    reason: status.reason ?? (status.state === "stalemate" ? "stalemate" : null),
  };
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
    cells[cellOf(move.from)].querySelector(".chess-piece")?.getBoundingClientRect() ?? null;
  const next = applyMove(position, move);
  const notation = moveToSan(position, move);

  positions.push(next);
  moves.push(move);
  notations.push(notation);
  clearSelection();
  hint = null;
  renderAll();
  slideFrom(cells[cellOf(move.to)].querySelector(".chess-piece"), fromRect);

  const status = getGameStatus(next, positions.map(positionKey));
  if (status.state !== "playing") {
    finish(status);
    return;
  }

  let note = "。";
  if (move.castle) {
    note = "。王车易位！";
  } else if (move.enPassant) {
    note = "。吃过路兵！";
  } else if (move.promotion) {
    note = `。兵升变成${PIECE_NAMES[move.promotion]}！`;
  }
  if (status.inCheck) {
    note += "将军！";
  }
  announce(`${SIDE_NAMES[position.turn]}：${notation}${note}`, status.inCheck ? "alert" : "neutral");
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
    playMove(findLegal(current(), move));
  } catch (error) {
    if (token !== thinkingToken || isCancelled(error)) {
      return;
    }
    thinking = false;
    renderAll();
    announce("电脑这一步没有想出来，可以悔棋或新开一局。", "error");
  }
}

function findLegal(position, move) {
  const legal = generateLegalMoves(position).find(
    (candidate) =>
      candidate.from === move.from &&
      candidate.to === move.to &&
      (candidate.promotion ?? null) === (move.promotion ?? null),
  );
  if (legal === undefined) {
    throw new Error("illegal move");
  }
  return legal;
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
    announce(`提示：${moveToSan(position, move)}。虚线框标出了起点和落点。`, "success");
    save();
  } catch (error) {
    if (!isCancelled(error) && current() === position) {
      announce("这次没想出好的提示。", "error");
    }
  } finally {
    renderControls();
  }
}

function choosePromotion(color) {
  for (const icon of promotionPanel.querySelectorAll(".chess-piece")) {
    icon.classList.toggle("chess-piece--w", color === "w");
    icon.classList.toggle("chess-piece--b", color === "b");
  }

  return new Promise((resolve) => {
    promotionChoice = resolve;
    promotionPanel.showModal();
    requestAnimationFrame(() => promotionPanel.querySelector("button").focus());
  });
}

async function activateCell(index) {
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
  const candidates = targets.filter((candidate) => candidate.to === square);

  if (selected !== null && candidates.length > 0) {
    let move = candidates[0];
    if (candidates.length > 1) {
      const promotion = await choosePromotion(position.turn);
      if (promotion === null || current() !== position) {
        announce("没有升变，兵先留在原地。");
        return;
      }
      move = candidates.find((candidate) => candidate.promotion === promotion) ?? move;
    }
    playMove(move);
    return;
  }

  if (piece !== null && colorOf(piece) === position.turn) {
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
          ? `正在被将军，这个${PIECE_NAMES[piece.toLowerCase()]}解不了将，换一个棋子。`
          : `这个${PIECE_NAMES[piece.toLowerCase()]}现在走不了。`,
        "error",
      );
    } else {
      announce(`选中了${PIECE_NAMES[piece.toLowerCase()]}。圆点是能走的格子，圆环是能吃的子。`);
    }
    return;
  }

  if (selected !== null) {
    clearSelection();
    renderBoard();
    announce(isInCheck(position) ? "正在被将军，要先解将。" : "那里走不到，再看看圆点。", "error");
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
    announce("新局开始，白方先走。");
  } else {
    announce(settings.side === "w" ? "新局开始，你执白先走。" : "新局开始，电脑执白先走。");
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
    settings.side = value === "b" ? "b" : "w";
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
    side: raw?.side === "b" ? "b" : "w",
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

    for (const saved of session.moves) {
      const move = findLegal(position, saved);
      restoredNotations.push(moveToSan(position, move));
      position = applyMove(position, move);
      restoredMoves.push(move);
      restoredPositions.push(position);
    }

    settings = sanitizeSettings(session.settings);
    positions = restoredPositions;
    moves = restoredMoves;
    notations = restoredNotations;
    hintsUsed = Number.isInteger(session.hintsUsed) && session.hintsUsed >= 0 ? session.hintsUsed : 0;

    const status = getGameStatus(position, positions.map(positionKey));
    if (status.state !== "playing") {
      result = {
        state: status.state,
        winner: status.winner ?? null,
        reason: status.reason ?? (status.state === "stalemate" ? "stalemate" : null),
      };
    } else if (session.result?.state === "resign" && ["w", "b"].includes(session.result.winner)) {
      result = { state: "resign", winner: session.result.winner, reason: null };
    }
    return true;
  } catch {
    return false;
  }
}

bindGridKeyboard(boardElement, cells, SIZE, () => {
  clearSelection();
  renderBoard();
  announce("取消了选择。");
});

for (const button of promotionPanel.querySelectorAll("[data-promotion]")) {
  button.addEventListener("click", () => {
    const resolve = promotionChoice;
    promotionChoice = null;
    promotionPanel.close();
    resolve?.(button.dataset.promotion);
  });
}
promotionPanel.addEventListener("close", () => {
  const resolve = promotionChoice;
  promotionChoice = null;
  resolve?.(null);
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
  announce(isAiTurn() ? "电脑执白先走。" : "白方先走。点一下棋子，看看它能走到哪里。");
} else if (result !== null) {
  announce("上一局已经下完了。点「新开一局」再来，或者悔棋复盘。");
} else {
  announce("已接上次的棋局，继续下吧。", "success");
}
if (isAiTurn()) {
  requestAiMove();
}

registerServiceWorker();
