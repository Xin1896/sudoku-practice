import * as go from "./go.js";
import {
  LEVEL_NAMES,
  bindChoiceGroup,
  bindSheets,
  bindGridKeyboard,
  createAiClient,
  createAnnouncer,
  createConfirmButton,
  delay,
  dropIn,
  focusCell,
  isCancelled,
  loadSession,
  renderMoveRecord,
  saveSession,
} from "./game-kit.js";
import { registerServiceWorker } from "./pwa.js";

const {
  BLACK,
  EMPTY,
  SUPPORTED_SIZES,
  WHITE,
  createGame,
  estimateDeadStones,
  getGroup,
  isLegalMove,
  passTurn,
  playMove,
  scoreGame,
  starPoints,
} = go;

const SAVE_KEY = "yike-go:v1";
const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_THINK_MS = 400;
const COLUMN_LABELS = "ABCDEFGHJKLMNOPQRST";
const SIDE_NAMES = Object.freeze({ [BLACK]: "黑方", [WHITE]: "白方" });
const STONE_NAMES = Object.freeze({ [BLACK]: "黑", [WHITE]: "白" });
const ILLEGAL_REASONS = Object.freeze({
  occupied: "这里已经有子了。",
  suicide: "这里下进去一口气都没有，又提不掉对方的子，是禁着点。",
  ko: "打劫！刚被提走的子不能马上提回来，先在别处下一手。",
  "game-over": "这一局已经结束了。",
});

const boardContainer = document.querySelector("#go-board");
const linesElement = document.querySelector("#go-lines");
const cellsElement = document.querySelector("#board");
const modeLabel = document.querySelector("#mode-label");
const moveRecord = document.querySelector("#move-record");
const moveCount = document.querySelector("#move-count");
const resultPanel = document.querySelector("#result-panel");
const scorePanel = document.querySelector("#go-score");
const strips = {
  top: document.querySelector("#player-top"),
  bottom: document.querySelector("#player-bottom"),
};
const undoButton = document.querySelector('[data-action="undo"]');
const hintButton = document.querySelector('[data-action="hint"]');
const passButton = document.querySelector('[data-action="pass"]');
const confirmModeButton = document.querySelector('[data-action="confirm-mode"]');
const resignButton = document.querySelector('[data-action="resign"]');
const announce = createAnnouncer(document.querySelector("#status-message"));
const ai = createAiClient("go", go);

let settings = { opponent: "ai", level: 1, side: BLACK, size: 9, confirm: false };
let games = [createGame(9)];
let moves = [];
let notations = [];
let result = null;
let scoring = null;
let preview = null;
let hint = null;
let thinking = false;
let thinkingToken = 0;
let hintsUsed = 0;
let cells = [];
let boardSize = 0;

function current() {
  return games.at(-1);
}

function other(color) {
  return color === BLACK ? WHITE : BLACK;
}

function isAiTurn() {
  return (
    settings.opponent === "ai" &&
    result === null &&
    scoring === null &&
    !current().over &&
    current().turn !== settings.side
  );
}

function canHumanPlay() {
  return result === null && scoring === null && !thinking && !isAiTurn();
}

function coordinate(point, size = current().size) {
  const row = Math.floor(point / size);
  return `${COLUMN_LABELS[point % size]}${size - row}`;
}

function svgElement(name, attributes) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function buildBoard(size) {
  if (boardSize === size) {
    return;
  }
  boardSize = size;

  const extent = size * 100;
  const last = extent - 50;
  const path = [];
  for (let line = 1; line < size - 1; line += 1) {
    const offset = 50 + line * 100;
    path.push(`M50 ${offset}H${last}M${offset} 50V${last}`);
  }

  linesElement.setAttribute("viewBox", `0 0 ${extent} ${extent}`);
  linesElement.replaceChildren(
    svgElement("rect", { class: "frame", x: 50, y: 50, width: extent - 100, height: extent - 100 }),
    svgElement("path", { class: "grid", d: path.join("") }),
    ...starPoints(size).map((point) =>
      svgElement("circle", {
        class: "star",
        cx: 50 + (point % size) * 100,
        cy: 50 + Math.floor(point / size) * 100,
        r: size === 19 ? 10 : 12,
      }),
    ),
  );

  cells = Array.from({ length: size * size }, (_, point) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "board-cell";
    cell.setAttribute("role", "gridcell");
    cell.tabIndex = point === Math.floor((size * size) / 2) ? 0 : -1;
    cell.addEventListener("click", () => activatePoint(point));
    return cell;
  });

  cellsElement.dataset.size = String(size);
  cellsElement.setAttribute("aria-label", `围棋棋盘，${size} 路`);
  cellsElement.replaceChildren(
    ...Array.from({ length: size }, (_, row) => {
      const element = document.createElement("div");
      element.className = "board-row";
      element.setAttribute("role", "row");
      element.append(...cells.slice(row * size, (row + 1) * size));
      return element;
    }),
  );
}

function deadSet() {
  if (scoring !== null) {
    return scoring.dead;
  }
  return result?.state === "score" ? new Set(result.dead) : null;
}

function syncCell(cell, value, ghost, territory) {
  const key = `${value}|${ghost}|${territory}`;
  if (cell.dataset.key === key) {
    return;
  }

  cell.dataset.key = key;
  const children = [];
  if (value !== EMPTY || ghost !== EMPTY) {
    const stone = document.createElement("span");
    const color = value !== EMPTY ? value : ghost;
    stone.className = `go-stone go-stone--${color === BLACK ? "black" : "white"}`;
    stone.classList.toggle("go-stone--ghost", value === EMPTY);
    stone.setAttribute("aria-hidden", "true");
    children.push(stone);
  }
  if (territory !== EMPTY) {
    const mark = document.createElement("span");
    mark.className = `territory territory--${territory === BLACK ? "black" : "white"}`;
    mark.setAttribute("aria-hidden", "true");
    children.push(mark);
  }
  cell.replaceChildren(...children);
}

function describePoint(point, value, dead, territory) {
  const parts = [coordinate(point)];
  parts.push(value === EMPTY ? "空" : `${STONE_NAMES[value]}子`);
  if (dead) {
    parts.push("标为死子");
  }
  if (territory !== EMPTY) {
    parts.push(`${STONE_NAMES[territory]}方的地`);
  }
  if (point === hint) {
    parts.push("提示的落点");
  }
  return parts.join("，");
}

function renderBoard() {
  const game = current();
  buildBoard(game.size);

  const dead = deadSet();
  const territoryMap = dead === null ? null : scoreGame(game, [...dead]).territoryMap;
  const last = typeof game.lastMove === "number" ? game.lastMove : null;

  cells.forEach((cell, point) => {
    const value = game.board[point];
    const territory = territoryMap?.[point] ?? EMPTY;
    const ghost = point === preview && value === EMPTY ? game.turn : EMPTY;
    const isDead = dead?.has(point) ?? false;

    syncCell(cell, value, ghost, territory);
    cell.classList.toggle("is-empty", value === EMPTY);
    cell.classList.toggle("is-last-to", point === last && value !== EMPTY);
    cell.classList.toggle("is-dead", isDead);
    cell.classList.toggle("is-preview", point === preview);
    cell.classList.toggle("is-hint-to", point === hint);
    cell.setAttribute("aria-label", describePoint(point, value, isDead, territory));
  });

  boardContainer.dataset.turn = game.turn === BLACK ? "black" : "white";
  boardContainer.dataset.interactive = String(canHumanPlay());
}

function whoLabel(color) {
  if (settings.opponent === "human") {
    return "玩家";
  }
  return color === settings.side ? "你" : `电脑 · ${LEVEL_NAMES[settings.level]}`;
}

function renderStrip(strip, color, game) {
  const active = result === null && scoring === null && !game.over && game.turn === color;
  strip.querySelector(".player-strip__mark").dataset.side = color === BLACK ? "dark" : "light";
  strip.querySelector("strong").textContent = SIDE_NAMES[color];
  strip.querySelector(".player-strip__who").textContent = whoLabel(color);
  strip.classList.toggle("is-active", active);
  strip.classList.toggle("is-thinking", active && thinking);

  const prisoners = color === BLACK ? game.prisoners.black : game.prisoners.white;
  const captures = strip.querySelector(".player-strip__captures");
  captures.setAttribute("aria-label", `${SIDE_NAMES[color]}提子数`);
  if (prisoners === 0) {
    captures.replaceChildren();
    return;
  }

  const count = document.createElement("span");
  count.className = "capture-count";
  count.textContent = `提 ${prisoners} 子`;
  captures.replaceChildren(count);
}

function renderPlayers() {
  const game = current();
  const bottom = settings.opponent === "ai" ? settings.side : BLACK;
  renderStrip(strips.bottom, bottom, game);
  renderStrip(strips.top, other(bottom), game);
}

const choiceGroups = new Map(
  [...document.querySelectorAll("[data-setting]")].map((group) => [
    group.dataset.setting,
    bindChoiceGroup(group, (value) => changeSetting(group.dataset.setting, value)),
  ]),
);

function renderScore() {
  scorePanel.hidden = scoring === null;
  if (scoring === null) {
    return;
  }

  const score = scoreGame(current(), [...scoring.dead]);
  document.querySelector("#score-black").textContent =
    `${score.black.stones} 子 + ${score.black.territory} 空 = ${score.black.total}`;
  document.querySelector("#score-white").textContent =
    `${score.white.stones} 子 + ${score.white.territory} 空 + ${score.white.komi} = ${score.white.total}`;
}

function renderControls() {
  const game = current();
  const opponent = settings.opponent === "ai" ? `人机 · ${LEVEL_NAMES[settings.level]}` : "两人同屏";
  modeLabel.textContent = `${opponent} · ${game.size} 路`;
  undoButton.disabled = moves.length === 0 && result?.state !== "resign";
  hintButton.disabled = !canHumanPlay();
  passButton.disabled = !canHumanPlay();
  resignButton.disabled = result !== null || scoring !== null || moves.length === 0;
  confirmModeButton.setAttribute("aria-pressed", String(settings.confirm));
  moveCount.textContent = moves.length === 0 ? "还没下" : `共 ${moves.length} 手`;

  for (const [name, group] of choiceGroups) {
    group.set(settings[name]);
  }
}

function renderAll() {
  renderBoard();
  renderPlayers();
  renderControls();
  renderScore();
  renderMoveRecord(moveRecord, notations, {
    paired: false,
    emptyText: "还没有落子。黑方先下。",
  });
}

function save() {
  saveSession(SAVE_KEY, {
    settings,
    size: current().size,
    moves,
    finished: result !== null,
    result,
    scoringDead: scoring === null ? null : [...scoring.dead],
    hintsUsed,
  });
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

function pushMove(game, move, notation) {
  games.push(game);
  moves.push(move);
  notations.push(notation);
}

function popMove() {
  games.pop();
  moves.pop();
  notations.pop();
}

function describePlay(mover, point, outcome) {
  const game = outcome.game;
  const opponent = other(mover);
  const notes = [];

  if (outcome.captured.length > 0) {
    notes.push(`提掉 ${outcome.captured.length} 子！`);
  }

  const ataried = new Set();
  for (const neighbor of go.neighbors(game.size, point)) {
    if (game.board[neighbor] === opponent) {
      const group = getGroup(game.board, game.size, neighbor);
      if (group.liberties.length === 1) {
        group.stones.forEach((stone) => ataried.add(stone));
      }
    }
  }
  if (ataried.size > 0) {
    notes.push("打吃！");
  }
  if (getGroup(game.board, game.size, point).liberties.length === 1) {
    notes.push("小心，这块棋只剩一口气了。");
  }

  return `${STONE_NAMES[mover]} ${coordinate(point, game.size)}。${notes.join("")}`;
}

function finishWithResult(nextResult) {
  result = nextResult;
  scoring = null;
  preview = null;
  hint = null;
  renderAll();

  const humanSide = settings.opponent === "ai" ? settings.side : null;
  let outcome = "neutral";
  if (result.winner === EMPTY) {
    outcome = "draw";
  } else if (humanSide !== null) {
    outcome = result.winner === humanSide ? "win" : "loss";
  }

  let title;
  let detail = "";
  if (result.state === "resign") {
    title = `${SIDE_NAMES[other(result.winner)]}认输，${SIDE_NAMES[result.winner]}胜`;
  } else if (result.winner === EMPTY) {
    title = "和棋，双方一样多";
  } else {
    title = `${SIDE_NAMES[result.winner]}胜 ${result.margin} 目`;
    detail = `黑方 ${result.black}，白方 ${result.white}（含贴目）。`;
  }

  const advice = {
    win: "想一想，哪一块地是怎么围出来的？",
    loss: "可以悔棋回去再试，或者先把电脑调低一档。",
    draw: "势均力敌，再来一局？",
    neutral: "复盘一下，看看哪块棋是胜负手。",
  }[outcome];
  const seal = { win: "胜", loss: "负", draw: "和", neutral: "终局" }[outcome];
  const steps = `共下了 ${moves.length} 手${hintsUsed > 0 ? `，用了 ${hintsUsed} 次提示` : ""}。`;

  document.querySelector("#result-title").textContent = title;
  document.querySelector("#result-summary").textContent = `${detail}${steps}${advice}`;
  document.querySelector("#result-seal").textContent = seal;
  announce(title, "success");
  save();

  if (!resultPanel.open) {
    resultPanel.showModal();
    requestAnimationFrame(() => resultPanel.querySelector("button").focus());
  }
}

function estimateDead(game) {
  try {
    return estimateDeadStones(game);
  } catch {
    return [];
  }
}

function enterScoring(savedDead = null) {
  const game = current();
  preview = null;
  hint = null;
  announce("双方都停了一手，对局结束。正在数子……");
  renderAll();

  setTimeout(() => {
    if (current() !== game) {
      return;
    }
    scoring = { dead: new Set(savedDead ?? estimateDead(game)) };
    renderAll();
    announce("数好了。打 × 的棋判为死子，点一块棋可以改；没问题就点「确认结果」。", "success");
    save();
    scorePanel.querySelector("button").focus({ preventScroll: true });
  }, 40);
}

function toggleDead(point) {
  const game = current();
  if (game.board[point] === EMPTY) {
    announce("点棋子可以标记死子；空点不用标。");
    return;
  }

  const stones = getGroup(game.board, game.size, point).stones;
  const allDead = stones.every((stone) => scoring.dead.has(stone));
  for (const stone of stones) {
    if (allDead) {
      scoring.dead.delete(stone);
    } else {
      scoring.dead.add(stone);
    }
  }
  renderAll();
  announce(
    allDead
      ? `这块${STONE_NAMES[game.board[point]]}棋改回活棋。`
      : `这块${STONE_NAMES[game.board[point]]}棋（${stones.length} 子）标成死子。`,
  );
  save();
}

function confirmScore() {
  if (scoring === null) {
    return;
  }
  const dead = [...scoring.dead];
  const score = scoreGame(current(), dead);
  finishWithResult({
    state: "score",
    winner: score.winner,
    margin: score.margin,
    black: score.black.total,
    white: score.white.total,
    dead,
  });
}

function resumePlay() {
  if (scoring === null) {
    return;
  }
  stopThinking();
  scoring = null;
  popMove();
  if (settings.opponent === "ai") {
    while (moves.length > 0 && (current().over || current().turn !== settings.side)) {
      popMove();
    }
  }
  renderAll();
  announce("好，接着下。觉得下完了再停一手。");
  save();
  if (isAiTurn()) {
    requestAiMove();
  }
}

function play(point) {
  const game = current();
  const outcome = playMove(game, point);
  if (!outcome.ok) {
    preview = null;
    renderBoard();
    announce(ILLEGAL_REASONS[outcome.reason] ?? "这里不能下。", "error");
    return;
  }

  pushMove(outcome.game, point, `${STONE_NAMES[game.turn]} ${coordinate(point, game.size)}`);
  preview = null;
  hint = null;
  renderAll();
  dropIn(cells[point].querySelector(".go-stone"));
  announce(
    describePlay(game.turn, point, outcome),
    outcome.captured.length > 0 ? "success" : "neutral",
  );
  save();

  if (isAiTurn()) {
    requestAiMove();
  }
}

function pass(byAi = false) {
  const game = current();
  const next = passTurn(game);
  pushMove(next, "pass", `${STONE_NAMES[game.turn]} 停一手`);
  preview = null;
  hint = null;

  if (next.over) {
    enterScoring();
    return;
  }

  renderAll();
  if (byAi) {
    announce("电脑停一手。如果你也觉得下完了，就点「停一手」结束对局。", "alert");
  } else {
    announce(`${SIDE_NAMES[game.turn]}停一手。对方也停一手的话，对局就结束。`);
  }
  save();

  if (isAiTurn()) {
    requestAiMove();
  }
}

async function requestAiMove() {
  const token = ++thinkingToken;
  const started = performance.now();
  thinking = true;
  renderAll();

  try {
    const move = await ai.request(current(), { level: settings.level });
    const remaining = MIN_THINK_MS - (performance.now() - started);
    if (remaining > 0) {
      await delay(remaining);
    }
    if (token !== thinkingToken) {
      return;
    }

    thinking = false;
    if (move === "pass") {
      pass(true);
    } else {
      play(move);
    }
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
  if (!canHumanPlay()) {
    return;
  }

  const game = current();
  hintButton.disabled = true;
  announce("帮你想一想……");

  try {
    const move = await ai.request(game, { level: 3, timeLimitMs: 1000 });
    if (current() !== game) {
      return;
    }

    hintsUsed += 1;
    if (move === "pass") {
      hint = null;
      announce("提示：已经没有特别值得下的地方了，可以停一手。", "success");
    } else {
      hint = move;
      announce(`提示：试试 ${coordinate(move, game.size)}。虚线圈标出了位置。`, "success");
    }
    renderBoard();
    save();
  } catch (error) {
    if (!isCancelled(error) && current() === game) {
      announce("这次没想出好的提示。", "error");
    }
  } finally {
    renderControls();
  }
}

function explainIllegal(game, point) {
  const outcome = playMove(game, point);
  return outcome.ok ? null : (ILLEGAL_REASONS[outcome.reason] ?? "这里不能下。");
}

function activatePoint(point) {
  focusCell(cells, point);

  if (scoring !== null) {
    toggleDead(point);
    return;
  }
  if (result !== null) {
    announce("这一局已经结束。可以悔棋，也可以新开一局。");
    return;
  }
  if (thinking || isAiTurn()) {
    announce("电脑正在想，稍等一下。");
    return;
  }

  const game = current();
  if (settings.confirm && preview !== point) {
    const problem = isLegalMove(game, point) ? null : explainIllegal(game, point);
    if (problem !== null) {
      preview = null;
      renderBoard();
      announce(problem, "error");
      return;
    }
    preview = point;
    renderBoard();
    announce(`准备下在 ${coordinate(point, game.size)}，再点一次确认。`);
    return;
  }

  play(point);
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
  scoring = null;
  preview = null;
  hint = null;
  popMove();
  if (settings.opponent === "ai") {
    while (moves.length > 0 && current().turn !== settings.side) {
      popMove();
    }
  }
  renderAll();
  announce("悔了一步，想好再下。");
  save();

  if (isAiTurn()) {
    requestAiMove();
  }
}

function newGame() {
  stopThinking();
  closeResult();
  if (
    settings.size === 19 &&
    boardSize !== 19 &&
    (globalThis.matchMedia?.("(pointer: coarse)").matches ?? false)
  ) {
    settings.confirm = true;
  }

  games = [createGame(settings.size)];
  moves = [];
  notations = [];
  result = null;
  scoring = null;
  preview = null;
  hint = null;
  hintsUsed = 0;
  renderAll();

  if (settings.opponent === "human") {
    announce(`新局开始，${settings.size} 路棋盘，黑方先下。`);
  } else {
    announce(
      settings.side === BLACK
        ? `新局开始，${settings.size} 路棋盘，你执黑先下。`
        : `新局开始，${settings.size} 路棋盘，电脑执黑先下。`,
    );
  }
  save();

  if (isAiTurn()) {
    requestAiMove();
  }
}

function resign() {
  if (result !== null || scoring !== null || moves.length === 0) {
    return;
  }
  stopThinking();
  const loser = settings.opponent === "ai" ? settings.side : current().turn;
  finishWithResult({ state: "resign", winner: other(loser) });
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

  if (name === "size") {
    settings.size = Number(value);
    if (moves.length === 0 && result === null) {
      newGame();
    } else {
      renderControls();
      announce(`点「新开一局」就换成 ${settings.size} 路棋盘。`);
      save();
    }
    return;
  }

  stopThinking();
  if (name === "opponent") {
    settings.opponent = value === "human" ? "human" : "ai";
    announce(settings.opponent === "ai" ? "改为和电脑下。" : "改为两人同屏，轮流落子。");
  } else if (name === "side") {
    settings.side = Number(value) === WHITE ? WHITE : BLACK;
    announce(`你执${STONE_NAMES[settings.side]}棋。`);
  }

  preview = null;
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
    side: raw?.side === WHITE ? WHITE : BLACK,
    size: SUPPORTED_SIZES.includes(raw?.size) ? raw.size : 9,
    confirm: raw?.confirm === true,
  };
}

function restore() {
  const session = loadSession(SAVE_KEY);
  if (session === null || !Array.isArray(session.moves) || !SUPPORTED_SIZES.includes(session.size)) {
    return false;
  }

  try {
    let game = createGame(session.size);
    const restoredGames = [game];
    const restoredMoves = [];
    const restoredNotations = [];

    for (const move of session.moves) {
      if (move === "pass") {
        restoredNotations.push(`${STONE_NAMES[game.turn]} 停一手`);
        game = passTurn(game);
      } else {
        const outcome = playMove(game, move);
        if (!outcome.ok) {
          return false;
        }
        restoredNotations.push(`${STONE_NAMES[game.turn]} ${coordinate(move, game.size)}`);
        game = outcome.game;
      }
      restoredMoves.push(move);
      restoredGames.push(game);
    }

    settings = sanitizeSettings(session.settings);
    games = restoredGames;
    moves = restoredMoves;
    notations = restoredNotations;
    hintsUsed = Number.isInteger(session.hintsUsed) && session.hintsUsed >= 0 ? session.hintsUsed : 0;

    const saved = session.result;
    const area = game.size * game.size;
    const validDead = (list) =>
      Array.isArray(list) && list.every((point) => Number.isInteger(point) && point >= 0 && point < area);

    if (saved?.state === "resign" && [BLACK, WHITE].includes(saved.winner)) {
      result = { state: "resign", winner: saved.winner };
    } else if (saved?.state === "score" && game.over && validDead(saved.dead)) {
      const score = scoreGame(game, saved.dead);
      result = {
        state: "score",
        winner: score.winner,
        margin: score.margin,
        black: score.black.total,
        white: score.white.total,
        dead: [...saved.dead],
      };
    } else if (game.over) {
      scoring = { dead: new Set(validDead(session.scoringDead) ? session.scoringDead : estimateDead(game)) };
    }
    return true;
  } catch {
    return false;
  }
}

bindGridKeyboard(
  cellsElement,
  () => cells,
  () => boardSize,
  () => {
    preview = null;
    renderBoard();
    announce("取消了准备落子的点。");
  },
);

for (const button of document.querySelectorAll('[data-action="new-game"]')) {
  button.addEventListener("click", newGame);
}
undoButton.addEventListener("click", undo);
hintButton.addEventListener("click", showHint);
passButton.addEventListener("click", () => {
  if (canHumanPlay()) {
    pass();
  }
});
confirmModeButton.addEventListener("click", () => {
  settings.confirm = !settings.confirm;
  preview = null;
  renderAll();
  save();
  announce(settings.confirm ? "已开启：点一次预览，再点一次落子。" : "已关闭落子确认，点一下就落子。");
});
createConfirmButton(resignButton, "认输", "确认？", resign);
scorePanel.querySelector('[data-action="confirm-score"]').addEventListener("click", confirmScore);
scorePanel.querySelector('[data-action="resume"]').addEventListener("click", resumePlay);
resultPanel.querySelector('[data-action="again"]').addEventListener("click", newGame);
resultPanel.querySelector('[data-action="review"]').addEventListener("click", closeResult);

bindSheets();

const restored = restore();
renderAll();
if (!restored || moves.length === 0) {
  announce(isAiTurn() ? "电脑执黑先下。" : "黑方先下。点一个交叉点落子。");
} else if (result !== null) {
  announce("上一局已经下完了。点「新开一局」再来，或者悔棋复盘。");
} else if (scoring !== null) {
  announce("上一局正在数子。确认结果，或者点「还没下完」接着下。");
} else {
  announce("已接上次的棋局，继续下吧。", "success");
}
if (isAiTurn()) {
  requestAiMove();
}

registerServiceWorker();
