export const SAVE_VERSION = 1;
export const LEVEL_NAMES = Object.freeze({ 1: "启蒙", 2: "入门", 3: "进阶" });
const STATUS_MARKS = Object.freeze({ neutral: "·", success: "✓", error: "×", alert: "!" });

export function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function createAnnouncer(statusLine) {
  const text = statusLine.querySelector("#status-text");
  const mark = statusLine.querySelector(".status-line__mark");

  return function announce(message, kind = "neutral") {
    text.textContent = message;
    mark.textContent = STATUS_MARKS[kind] ?? STATUS_MARKS.neutral;
  };
}

export function loadSession(key) {
  try {
    const serialized = globalThis.localStorage?.getItem(key) ?? null;
    if (serialized === null) {
      return null;
    }

    const session = JSON.parse(serialized);
    return session !== null && typeof session === "object" && session.version === SAVE_VERSION
      ? session
      : null;
  } catch {
    return null;
  }
}

export function saveSession(key, session) {
  try {
    globalThis.localStorage?.setItem(
      key,
      JSON.stringify({ ...session, version: SAVE_VERSION, updatedAt: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

export function bindChoiceGroup(group, onChange) {
  const buttons = [...group.querySelectorAll('[role="radio"]')];

  function set(value) {
    for (const button of buttons) {
      const isSelected = button.dataset.value === String(value);
      button.setAttribute("aria-checked", String(isSelected));
      button.tabIndex = isSelected ? 0 : -1;
    }
  }

  function choose(button, focus = false) {
    set(button.dataset.value);
    if (focus) {
      button.focus();
    }
    onChange(button.dataset.value);
  }

  for (const button of buttons) {
    button.addEventListener("click", () => choose(button));
    button.addEventListener("keydown", (event) => {
      const index = buttons.indexOf(button);
      let next = null;

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          next = (index - 1 + buttons.length) % buttons.length;
          break;
        case "ArrowRight":
        case "ArrowDown":
          next = (index + 1) % buttons.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = buttons.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      choose(buttons[next], true);
    });
  }

  return { set };
}

export function bindGridKeyboard(container, getCells, getColumns, onEscape) {
  container.addEventListener("keydown", (event) => {
    const cells = typeof getCells === "function" ? getCells() : getCells;
    const columns = typeof getColumns === "function" ? getColumns() : getColumns;
    const index = cells.indexOf(document.activeElement);
    if (index === -1 || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    let next = index;
    switch (event.key) {
      case "ArrowLeft":
        next = index % columns > 0 ? index - 1 : index;
        break;
      case "ArrowRight":
        next = index % columns < columns - 1 ? index + 1 : index;
        break;
      case "ArrowUp":
        next = index - columns >= 0 ? index - columns : index;
        break;
      case "ArrowDown":
        next = index + columns < cells.length ? index + columns : index;
        break;
      case "Escape":
        event.preventDefault();
        onEscape();
        return;
      default:
        return;
    }

    event.preventDefault();
    focusCell(cells, next);
  });
}

export function focusCell(cells, index) {
  cells.forEach((cell, cellIndex) => {
    cell.tabIndex = cellIndex === index ? 0 : -1;
  });
  cells[index]?.focus({ preventScroll: true });
}

export function slideFrom(element, fromRect) {
  if (element === null || fromRect === null || prefersReducedMotion()) {
    return;
  }

  const toRect = element.getBoundingClientRect();
  const dx = fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2);
  const dy = fromRect.top + fromRect.height / 2 - (toRect.top + toRect.height / 2);
  if (Math.abs(dx) + Math.abs(dy) < 1) {
    return;
  }

  element.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(1.08)`, zIndex: 6 },
      { transform: "translate(0, 0) scale(1)", zIndex: 6 },
    ],
    { duration: 240, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
  );
}

export function dropIn(element) {
  if (element === null || prefersReducedMotion()) {
    return;
  }

  element.animate(
    [
      { transform: "scale(1.35)", opacity: 0 },
      { transform: "scale(0.96)", opacity: 1, offset: 0.7 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 260, easing: "ease-out" },
  );
}

export function renderMoveRecord(list, notations, { paired = true, emptyText = "还没有落子。" } = {}) {
  const items = [];

  if (notations.length === 0) {
    const item = document.createElement("li");
    item.className = "move-record__empty";
    item.textContent = emptyText;
    list.replaceChildren(item);
    return;
  }

  if (!paired) {
    notations.forEach((notation, index) => {
      const item = document.createElement("li");
      const move = document.createElement("span");
      move.className = "move-record__move";
      move.classList.toggle("is-latest", index === notations.length - 1);
      move.textContent = notation;
      item.append(move);
      items.push(item);
    });
  } else {
    for (let index = 0; index < notations.length; index += 2) {
      const item = document.createElement("li");
      const number = document.createElement("span");
      number.className = "move-record__number";
      number.textContent = `${index / 2 + 1}.`;
      item.append(number);

      for (const offset of [0, 1]) {
        const move = document.createElement("span");
        move.className = "move-record__move";
        move.textContent = notations[index + offset] ?? "";
        move.classList.toggle("is-latest", index + offset === notations.length - 1);
        item.append(move);
      }
      items.push(item);
    }
  }

  list.replaceChildren(...items);
  list.scrollTop = list.scrollHeight;
}

export function createAiClient(gameName, engine) {
  let worker = null;
  let workerUnavailable = typeof Worker !== "function";
  let pending = null;
  let nextId = 1;

  function runOnMainThread(job) {
    setTimeout(() => {
      if (pending !== job) {
        return;
      }
      pending = null;
      try {
        job.resolve(engine.chooseAiMove(job.position, job.options));
      } catch (error) {
        job.reject(error);
      }
    }, 30);
  }

  function spawnWorker() {
    try {
      worker = new Worker("/js/ai-worker.js", { type: "module", name: `${gameName}-ai` });
    } catch {
      worker = null;
      workerUnavailable = true;
      return;
    }

    worker.addEventListener("message", (event) => {
      const { id, move, error } = event.data ?? {};
      if (pending === null || pending.id !== id) {
        return;
      }

      const job = pending;
      pending = null;
      if (error) {
        job.reject(new Error(error));
      } else {
        job.resolve(move);
      }
    });

    worker.addEventListener("error", (event) => {
      event.preventDefault();
      worker?.terminate();
      worker = null;
      workerUnavailable = true;
      if (pending !== null) {
        runOnMainThread(pending);
      }
    });
  }

  function cancel() {
    if (pending === null) {
      return;
    }

    const job = pending;
    pending = null;
    worker?.terminate();
    worker = null;
    job.reject(new Error("cancelled"));
  }

  function request(position, options) {
    cancel();

    return new Promise((resolve, reject) => {
      const job = { id: nextId, position, options, resolve, reject };
      nextId += 1;
      pending = job;

      if (!workerUnavailable && worker === null) {
        spawnWorker();
      }
      if (workerUnavailable || worker === null) {
        runOnMainThread(job);
        return;
      }

      worker.postMessage({ id: job.id, game: gameName, position, options });
    });
  }

  return { request, cancel };
}

export function isCancelled(error) {
  return error instanceof Error && error.message === "cancelled";
}

export function createConfirmButton(button, idleLabel, confirmLabel, onConfirm) {
  let timer = null;

  function reset() {
    clearTimeout(timer);
    timer = null;
    button.textContent = idleLabel;
    button.removeAttribute("aria-pressed");
  }

  button.addEventListener("click", () => {
    if (timer === null) {
      button.textContent = confirmLabel;
      button.setAttribute("aria-pressed", "true");
      timer = setTimeout(reset, 3200);
      return;
    }

    reset();
    onConfirm();
  });

  return { reset };
}
