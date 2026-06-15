(function () {
  "use strict";

  const STORAGE_KEY = "heart-sudoku-best";
  const MAX_MISTAKES = 3;
  const START_HINTS = 3;

  const PUZZLES = [
    {
      name: "月光高阶 01",
      puzzle: "000260701680070090190004500820100040004602900050003028009300074040050036703018000",
    },
    {
      name: "莓果高阶 02",
      puzzle: "005300000800000020070010500400005300010070006003200080060500009004000030000009700",
    },
    {
      name: "星糖高阶 03",
      puzzle: "100007090030020008009600500005300900010080002600004000300000010040000007007000300",
    },
    {
      name: "晨雾高阶 04",
      puzzle: "000900002050123400030000160908000000070000090000000205091000050007439020400007000",
    },
    {
      name: "花火高阶 05",
      puzzle: "000000907000420180000705026100904000050000040000507009920108000034059000507000000",
    },
  ];

  const boardEl = document.querySelector("#board");
  const timerEl = document.querySelector("#timer");
  const mistakesEl = document.querySelector("#mistakes");
  const bestTimeEl = document.querySelector("#bestTime");
  const puzzleNameEl = document.querySelector("#puzzleName");
  const statusEl = document.querySelector("#status");
  const noteButton = document.querySelector("#noteButton");
  const eraseButton = document.querySelector("#eraseButton");
  const hintButton = document.querySelector("#hintButton");
  const hintCountEl = document.querySelector("#hintCount");
  const checkButton = document.querySelector("#checkButton");
  const newGameTop = document.querySelector("#newGameTop");
  const dialog = document.querySelector("#dialog");
  const dialogKicker = document.querySelector("#dialogKicker");
  const dialogTitle = document.querySelector("#dialogTitle");
  const dialogText = document.querySelector("#dialogText");
  const dialogButton = document.querySelector("#dialogButton");
  const numberButtons = Array.from(document.querySelectorAll("[data-number]"));

  const cells = [];
  const state = {
    puzzle: [],
    solution: [],
    values: [],
    notes: [],
    selected: 0,
    mistakes: 0,
    hints: START_HINTS,
    noteMode: false,
    startedAt: Date.now(),
    elapsed: 0,
    solved: false,
    locked: false,
    lastHint: -1,
    checking: false,
    puzzleName: "",
  };

  function buildBoard() {
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < 81; index += 1) {
      const cell = document.createElement("button");
      const row = Math.floor(index / 9);
      const col = index % 9;
      cell.className = "cell";
      cell.type = "button";
      cell.dataset.index = String(index);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `第${row + 1}行第${col + 1}列`);
      cell.addEventListener("click", () => selectCell(index));
      fragment.appendChild(cell);
      cells.push(cell);
    }

    boardEl.appendChild(fragment);
  }

  function newGame() {
    const base = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
    const solved = solvePuzzle(toNumbers(base.puzzle));
    const transformed = transformPuzzle(toNumbers(base.puzzle), solved);

    state.puzzle = transformed.puzzle;
    state.solution = transformed.solution;
    state.values = transformed.puzzle.slice();
    state.notes = Array.from({ length: 81 }, () => new Set());
    state.selected = state.values.findIndex((value) => value === 0);
    state.mistakes = 0;
    state.hints = START_HINTS;
    state.noteMode = false;
    state.startedAt = Date.now();
    state.elapsed = 0;
    state.solved = false;
    state.locked = false;
    state.lastHint = -1;
    state.checking = false;
    state.puzzleName = base.name;

    dialog.hidden = true;
    noteButton.setAttribute("aria-pressed", "false");
    puzzleNameEl.textContent = `${base.name} · ${countGivens(state.puzzle)} 个已知数`;
    setStatus("选一个空格开始。");
    updateTimer();
    render();
  }

  function render() {
    const selectedValue = state.values[state.selected] || 0;

    cells.forEach((cell, index) => {
      const value = state.values[index];
      const fixed = state.puzzle[index] !== 0;
      const row = Math.floor(index / 9);
      const col = index % 9;
      const selectedRow = Math.floor(state.selected / 9);
      const selectedCol = state.selected % 9;
      const selectedBox = boxIndex(state.selected);
      const related =
        index !== state.selected && (row === selectedRow || col === selectedCol || boxIndex(index) === selectedBox);
      const isError = value !== 0 && value !== state.solution[index] && !fixed;
      const same = selectedValue !== 0 && value === selectedValue;

      cell.className = "cell";
      cell.disabled = state.locked;
      cell.setAttribute("aria-selected", index === state.selected ? "true" : "false");

      if (fixed) cell.classList.add("is-fixed");
      if (related) cell.classList.add("is-related");
      if (same) cell.classList.add("is-same");
      if (index === state.selected) cell.classList.add("is-selected");
      if (isError || (state.checking && value !== 0 && value !== state.solution[index])) cell.classList.add("is-error");
      if (index === state.lastHint) cell.classList.add("is-hint");

      cell.replaceChildren();
      if (value) {
        cell.textContent = String(value);
        cell.setAttribute("aria-label", `${cellLabel(index)}，数字 ${value}${fixed ? "，题目给定" : ""}`);
      } else if (state.notes[index].size > 0) {
        cell.appendChild(renderNotes(state.notes[index]));
        cell.setAttribute("aria-label", `${cellLabel(index)}，候选 ${Array.from(state.notes[index]).join("、")}`);
      } else {
        cell.setAttribute("aria-label", `${cellLabel(index)}，空格`);
      }
    });

    numberButtons.forEach((button) => {
      const number = Number(button.dataset.number);
      button.classList.toggle("is-active", selectedValue === number);
      button.disabled = state.locked || countPlaced(number) >= 9;
    });

    mistakesEl.textContent = `${state.mistakes}/${MAX_MISTAKES}`;
    hintCountEl.textContent = `提示 ${state.hints}`;
    hintButton.disabled = state.locked || state.hints <= 0;
    const bestTime = readBestTime();
    bestTimeEl.textContent = bestTime ? formatTime(bestTime) : "--:--";
  }

  function renderNotes(notes) {
    const notesEl = document.createElement("span");
    notesEl.className = "notes";

    for (let number = 1; number <= 9; number += 1) {
      const slot = document.createElement("span");
      slot.textContent = notes.has(number) ? String(number) : "";
      notesEl.appendChild(slot);
    }

    return notesEl;
  }

  function selectCell(index) {
    if (state.locked) return;
    state.selected = index;
    state.lastHint = -1;
    render();
  }

  function placeNumber(number) {
    if (state.locked) return;

    const index = state.selected;
    if (index < 0 || state.puzzle[index] !== 0) {
      setStatus("这个格子是题目给定的。");
      return;
    }

    if (state.noteMode) {
      toggleNote(index, number);
      render();
      return;
    }

    state.values[index] = number;
    state.notes[index].clear();
    state.lastHint = -1;

    if (number === state.solution[index]) {
      clearRelatedNotes(index, number);
      setStatus("放得很好。");
      moveToNextEmpty(index);
    } else {
      state.mistakes += 1;
      setStatus("这里不太对。");
      if (state.mistakes >= MAX_MISTAKES) {
        endGame(false);
      }
    }

    if (!state.locked && isSolved()) {
      endGame(true);
    }

    render();
  }

  function toggleNote(index, number) {
    if (state.values[index] !== 0) {
      setStatus("已有数字的格子不能写笔记。");
      return;
    }

    if (state.notes[index].has(number)) {
      state.notes[index].delete(number);
      setStatus("已移除候选。");
    } else {
      state.notes[index].add(number);
      setStatus("已记下候选。");
    }
  }

  function eraseSelected() {
    if (state.locked) return;

    const index = state.selected;
    if (index < 0 || state.puzzle[index] !== 0) {
      setStatus("题目给定的数字不能擦除。");
      return;
    }

    state.values[index] = 0;
    state.notes[index].clear();
    state.lastHint = -1;
    setStatus("已擦除。");
    render();
  }

  function useHint() {
    if (state.locked || state.hints <= 0) return;

    let index = state.selected;
    if (index < 0 || state.puzzle[index] !== 0 || state.values[index] === state.solution[index]) {
      index = state.values.findIndex((value, cellIndex) => state.puzzle[cellIndex] === 0 && value !== state.solution[cellIndex]);
    }

    if (index < 0) return;

    state.selected = index;
    state.values[index] = state.solution[index];
    state.notes[index].clear();
    state.hints -= 1;
    state.lastHint = index;
    clearRelatedNotes(index, state.solution[index]);
    setStatus("给你点亮了一个格子。");

    if (isSolved()) {
      endGame(true);
    }

    render();
  }

  function checkBoard() {
    if (state.locked) return;

    const wrong = state.values.filter((value, index) => value !== 0 && value !== state.solution[index]).length;
    const empty = state.values.filter((value) => value === 0).length;

    state.checking = true;
    render();

    window.setTimeout(() => {
      state.checking = false;
      render();
    }, 900);

    if (wrong > 0) {
      setStatus(`有 ${wrong} 个格子需要再看看。`);
    } else if (empty > 0) {
      setStatus(`目前都对，还剩 ${empty} 格。`);
    } else {
      endGame(true);
    }
  }

  function endGame(won) {
    state.locked = true;
    state.solved = won;
    updateTimer();

    if (won) {
      const best = readBestTime();
      if (!best || state.elapsed < best) {
        localStorage.setItem(STORAGE_KEY, String(state.elapsed));
      }
      dialogKicker.textContent = "完成";
      dialogTitle.textContent = "漂亮，解开了！";
      dialogText.textContent = `本局用时 ${formatTime(state.elapsed)}，失误 ${state.mistakes} 次。`;
    } else {
      dialogKicker.textContent = "差一点";
      dialogTitle.textContent = "这局先缓一缓";
      dialogText.textContent = "失误次数用完了，换一盘继续挑战。";
    }

    dialog.hidden = false;
    render();
  }

  function moveToNextEmpty(fromIndex) {
    for (let step = 1; step <= 81; step += 1) {
      const next = (fromIndex + step) % 81;
      if (state.puzzle[next] === 0 && state.values[next] === 0) {
        state.selected = next;
        return;
      }
    }
  }

  function clearRelatedNotes(index, number) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = boxIndex(index);

    state.notes.forEach((notes, noteIndex) => {
      if (noteIndex === index) return;
      const noteRow = Math.floor(noteIndex / 9);
      const noteCol = noteIndex % 9;
      if (noteRow === row || noteCol === col || boxIndex(noteIndex) === box) {
        notes.delete(number);
      }
    });
  }

  function handleKeydown(event) {
    if (dialog.hidden === false && event.key === "Enter") {
      newGame();
      return;
    }

    if (state.locked) return;

    if (/^[1-9]$/.test(event.key)) {
      placeNumber(Number(event.key));
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      eraseSelected();
      return;
    }

    if (event.key.toLowerCase() === "n") {
      toggleNoteMode();
      return;
    }

    const row = Math.floor(state.selected / 9);
    const col = state.selected % 9;
    let next = state.selected;

    if (event.key === "ArrowUp") next = Math.max(0, row - 1) * 9 + col;
    if (event.key === "ArrowDown") next = Math.min(8, row + 1) * 9 + col;
    if (event.key === "ArrowLeft") next = row * 9 + Math.max(0, col - 1);
    if (event.key === "ArrowRight") next = row * 9 + Math.min(8, col + 1);

    if (next !== state.selected) {
      event.preventDefault();
      selectCell(next);
    }
  }

  function toggleNoteMode() {
    state.noteMode = !state.noteMode;
    noteButton.setAttribute("aria-pressed", state.noteMode ? "true" : "false");
    setStatus(state.noteMode ? "笔记模式已开启。" : "笔记模式已关闭。");
  }

  function isSolved() {
    return state.values.every((value, index) => value === state.solution[index]);
  }

  function countPlaced(number) {
    return state.values.filter((value, index) => value === number && value === state.solution[index]).length;
  }

  function countGivens(puzzle) {
    return puzzle.filter(Boolean).length;
  }

  function boxIndex(index) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    return Math.floor(row / 3) * 3 + Math.floor(col / 3);
  }

  function cellLabel(index) {
    const row = Math.floor(index / 9) + 1;
    const col = (index % 9) + 1;
    return `第${row}行第${col}列`;
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function updateTimer() {
    if (!state.locked) {
      state.elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    }

    timerEl.textContent = formatTime(state.elapsed);
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function readBestTime() {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  }

  function toNumbers(puzzle) {
    return puzzle.split("").map((char) => Number(char));
  }

  function transformPuzzle(puzzle, solution) {
    const digitMap = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const rowBands = shuffled([0, 1, 2]);
    const colStacks = shuffled([0, 1, 2]);
    const rowsInBand = [shuffled([0, 1, 2]), shuffled([0, 1, 2]), shuffled([0, 1, 2])];
    const colsInStack = [shuffled([0, 1, 2]), shuffled([0, 1, 2]), shuffled([0, 1, 2])];
    const transpose = Math.random() > 0.5;

    const mapIndex = (index) => {
      const row = Math.floor(index / 9);
      const col = index % 9;
      const newRow = rowBands[Math.floor(row / 3)] * 3 + rowsInBand[Math.floor(row / 3)][row % 3];
      const newCol = colStacks[Math.floor(col / 3)] * 3 + colsInStack[Math.floor(col / 3)][col % 3];
      return transpose ? newCol * 9 + newRow : newRow * 9 + newCol;
    };

    const mapValue = (value) => (value === 0 ? 0 : digitMap[value - 1]);
    const nextPuzzle = Array(81).fill(0);
    const nextSolution = Array(81).fill(0);

    for (let index = 0; index < 81; index += 1) {
      const nextIndex = mapIndex(index);
      nextPuzzle[nextIndex] = mapValue(puzzle[index]);
      nextSolution[nextIndex] = mapValue(solution[index]);
    }

    return { puzzle: nextPuzzle, solution: nextSolution };
  }

  function shuffled(items) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function solvePuzzle(grid) {
    const board = grid.slice();

    function solve() {
      let bestIndex = -1;
      let bestCandidates = null;

      for (let index = 0; index < 81; index += 1) {
        if (board[index] !== 0) continue;
        const candidates = getCandidates(board, index);
        if (candidates.length === 0) return false;
        if (!bestCandidates || candidates.length < bestCandidates.length) {
          bestCandidates = candidates;
          bestIndex = index;
          if (candidates.length === 1) break;
        }
      }

      if (bestIndex === -1) return true;

      for (const number of bestCandidates) {
        board[bestIndex] = number;
        if (solve()) return true;
        board[bestIndex] = 0;
      }

      return false;
    }

    if (!solve()) {
      throw new Error("Puzzle has no solution.");
    }

    return board;
  }

  function getCandidates(board, index) {
    const used = new Set();
    const row = Math.floor(index / 9);
    const col = index % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;

    for (let offset = 0; offset < 9; offset += 1) {
      used.add(board[row * 9 + offset]);
      used.add(board[offset * 9 + col]);
    }

    for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
      for (let colOffset = 0; colOffset < 3; colOffset += 1) {
        used.add(board[(boxRow + rowOffset) * 9 + boxCol + colOffset]);
      }
    }

    const candidates = [];
    for (let number = 1; number <= 9; number += 1) {
      if (!used.has(number)) candidates.push(number);
    }
    return candidates;
  }

  numberButtons.forEach((button) => {
    button.addEventListener("click", () => placeNumber(Number(button.dataset.number)));
  });

  noteButton.addEventListener("click", toggleNoteMode);
  eraseButton.addEventListener("click", eraseSelected);
  hintButton.addEventListener("click", useHint);
  checkButton.addEventListener("click", checkBoard);
  newGameTop.addEventListener("click", newGame);
  dialogButton.addEventListener("click", newGame);
  document.addEventListener("keydown", handleKeydown);
  window.setInterval(updateTimer, 1000);

  buildBoard();
  newGame();
})();
