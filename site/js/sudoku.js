const CELL_COUNT = 81;
const GRID_SIZE = 9;

function assertBoard(board) {
  if (
    !Array.isArray(board) ||
    board.length !== CELL_COUNT ||
    board.some((value) => !Number.isInteger(value) || value < 0 || value > 9)
  ) {
    throw new TypeError("盘面必须是包含 81 个 0–9 整数的数组");
  }
}

function assertCell(index) {
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    throw new RangeError("格子索引必须在 0–80 之间");
  }
}

function cloneNotes(notes) {
  return notes.map((cellNotes) => [...cellNotes]);
}

function createSnapshot(state) {
  const board = Object.freeze([...state.board]);
  const notes = Object.freeze(
    state.notes.map((cellNotes) => Object.freeze([...cellNotes])),
  );

  return Object.freeze({ board, notes });
}

function hasGiven(state, index) {
  return Boolean(state.givens[index]);
}

function candidatesFor(board, index) {
  if (board[index] !== 0) {
    return [];
  }

  const used = new Set();
  const row = Math.floor(index / GRID_SIZE);
  const column = index % GRID_SIZE;
  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;

  for (let offset = 0; offset < GRID_SIZE; offset += 1) {
    used.add(board[row * GRID_SIZE + offset]);
    used.add(board[offset * GRID_SIZE + column]);
  }

  for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
      used.add(
        board[
          (boxRow + rowOffset) * GRID_SIZE + boxColumn + columnOffset
        ],
      );
    }
  }

  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((value) => !used.has(value));
}

export function parseGrid(grid) {
  if (typeof grid !== "string") {
    throw new TypeError("数独文本必须是字符串");
  }

  const cells = grid.replaceAll(/\s/g, "");
  if (cells.length !== CELL_COUNT) {
    throw new RangeError("数独文本必须包含 81 个格子");
  }
  if (!/^[0-9.]+$/.test(cells)) {
    throw new TypeError("数独文本包含无效字符");
  }

  return [...cells].map((cell) => (cell === "." || cell === "0" ? 0 : Number(cell)));
}

export function findConflicts(board) {
  assertBoard(board);
  const conflicts = new Set();

  function inspect(indices) {
    const positionsByValue = new Map();

    for (const index of indices) {
      const value = board[index];
      if (value === 0) {
        continue;
      }

      const positions = positionsByValue.get(value) ?? [];
      positions.push(index);
      positionsByValue.set(value, positions);
    }

    for (const positions of positionsByValue.values()) {
      if (positions.length > 1) {
        positions.forEach((index) => conflicts.add(index));
      }
    }
  }

  for (let unit = 0; unit < GRID_SIZE; unit += 1) {
    inspect(Array.from({ length: GRID_SIZE }, (_, column) => unit * 9 + column));
    inspect(Array.from({ length: GRID_SIZE }, (_, row) => row * 9 + unit));
  }

  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      const indices = [];
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          indices.push(
            (boxRow * 3 + row) * GRID_SIZE + boxColumn * 3 + column,
          );
        }
      }
      inspect(indices);
    }
  }

  return conflicts;
}

export function getCandidates(board, index) {
  assertBoard(board);
  assertCell(index);
  return candidatesFor(board, index);
}

export function setValue(state, index, value) {
  assertBoard(state.board);
  assertCell(index);
  if (!Number.isInteger(value) || value < 0 || value > 9) {
    throw new RangeError("输入数字必须在 0–9 之间");
  }
  if (hasGiven(state, index) || state.board[index] === value) {
    return state;
  }

  const board = [...state.board];
  const notes = cloneNotes(state.notes);
  board[index] = value;
  notes[index] = [];

  return {
    ...state,
    board,
    notes,
    history: [...state.history, createSnapshot(state)],
  };
}

export function toggleNote(state, index, value) {
  assertBoard(state.board);
  assertCell(index);
  if (!Number.isInteger(value) || value < 1 || value > 9) {
    throw new RangeError("候选数字必须在 1–9 之间");
  }
  if (hasGiven(state, index) || state.board[index] !== 0) {
    return state;
  }

  const notes = cloneNotes(state.notes);
  const cellNotes = new Set(notes[index]);
  if (cellNotes.has(value)) {
    cellNotes.delete(value);
  } else {
    cellNotes.add(value);
  }
  notes[index] = [...cellNotes].sort((left, right) => left - right);

  return {
    ...state,
    notes,
    history: [...state.history, createSnapshot(state)],
  };
}

export function isSolved(board) {
  assertBoard(board);
  return board.every((value) => value !== 0) && findConflicts(board).size === 0;
}

export function countSolutions(board, limit = 2) {
  assertBoard(board);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("解答数量上限必须是正整数");
  }
  if (findConflicts(board).size > 0) {
    return 0;
  }

  const working = [...board];
  let solutions = 0;

  function search() {
    if (solutions >= limit) {
      return;
    }

    let nextIndex = -1;
    let nextCandidates = null;

    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (working[index] !== 0) {
        continue;
      }

      const candidates = candidatesFor(working, index);
      if (candidates.length === 0) {
        return;
      }
      if (nextCandidates === null || candidates.length < nextCandidates.length) {
        nextIndex = index;
        nextCandidates = candidates;
        if (candidates.length === 1) {
          break;
        }
      }
    }

    if (nextIndex === -1) {
      solutions += 1;
      return;
    }

    for (const candidate of nextCandidates) {
      working[nextIndex] = candidate;
      search();
      working[nextIndex] = 0;

      if (solutions >= limit) {
        return;
      }
    }
  }

  search();
  return solutions;
}
