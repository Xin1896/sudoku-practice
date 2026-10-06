import { chooseAiMove as chooseChessMove } from "./chess.js";
import { chooseAiMove as chooseGoMove } from "./go.js";
import { chooseAiMove as chooseXiangqiMove } from "./xiangqi.js";

const ENGINES = Object.freeze({
  chess: chooseChessMove,
  go: chooseGoMove,
  xiangqi: chooseXiangqiMove,
});

self.addEventListener("message", (event) => {
  const { id, game, position, options } = event.data ?? {};
  const choose = ENGINES[game];

  try {
    if (typeof choose !== "function") {
      throw new Error(`未知的棋类：${game}`);
    }
    self.postMessage({ id, move: choose(position, options) });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
});
