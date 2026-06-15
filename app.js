(function () {
  "use strict";

  const SAVE_KEY = "heart-sudoku-level-saves-v2";
  const PROGRESS_KEY = "heart-sudoku-level-progress-v1";
  const CHINESE_NUMBERS = ["一", "二", "三", "四", "五"];

  const DIFFICULTIES = [
    {
      id: "easy",
      label: "轻松",
      hints: 4,
      maxMistakes: 4,
      levels: [
        "561000027390601845070005169010026473900143050040700902704002591150300284000004700",
        "604850000097600408038400056089013000403500000260904003850190340906305020340028005",
        "000007306060412800004350290090500702000090035015800000031045028906708014008100003",
        "070000000230004907000000863056000421901000038003020605397010286100038070400002000",
        "000004002620007300070300960200000000510000603390458100080070000734000256900003800",
      ],
    },
    {
      id: "normal",
      label: "进阶",
      hints: 3,
      maxMistakes: 3,
      levels: [
        "614000092070004008805000700080001000900056401000849070090600000040007026001005009",
        "200070018041006090738950000000600001050000740000000030000000009420107083009200004",
        "000060040000800506100250000009000302200073000300020705000090000080002004790014800",
        "020000090000021003000036057095000000010000635400302010200000540060000000008400070",
        "109308006000000840000020003000000500002000000006185390025000000031000675000900000",
      ],
    },
    {
      id: "hard",
      label: "高阶",
      hints: 2,
      maxMistakes: 3,
      levels: [
        "006010090300900060000000700800001074500246000600800000000000300075009000004002010",
        "000946000900008005000003000002690000650000709400007800010409006080300000004800300",
        "030076920009200800006030000040600500900000400000029000000008700460000038050000000",
        "020600040741000000600000230000251400007000008000030000000420050060103800010000006",
        "600900002008000500000002008300200400070010006000090300060109004080000000715003600",
      ],
    },
  ];

  const boardEl = document.querySelector("#board");
  const timerEl = document.querySelector("#timer");
  const mistakesEl = document.querySelector("#mistakes");
  const bestTimeEl = document.querySelector("#bestTime");
  const levelLabelEl = document.querySelector("#levelLabel");
  const puzzleNameEl = document.querySelector("#puzzleName");
  const statusEl = document.querySelector("#status");
  const difficultyPicker = document.querySelector("#difficultyPicker");
  const levelPicker = document.querySelector("#levelPicker");
  const noteButton = document.querySelector("#noteButton");
  const eraseButton = document.querySelector("#eraseButton");
  const hintButton = document.querySelector("#hintButton");
  const hintCountEl = document.querySelector("#hintCount");
  const checkButton = document.querySelector("#checkButton");
  const restartTop = document.querySelector("#restartTop");
  const redoButton = document.querySelector("#redoButton");
  const dialog = document.querySelector("#dialog");
  const dialogKicker = document.querySelector("#dialogKicker");
  const dialogTitle = document.querySelector("#dialogTitle");
  const dialogText = document.querySelector("#dialogText");
  const dialogButton = document.querySelector("#dialogButton");
  const numberButtons = Array.from(document.querySelectorAll("[data-number]"));
  const cells = [];

  const state = {
    difficulty: "normal",
    levelIndex: 0,
    puzzle: [],
    solution: [],
    values: [],
    notes: [],
    selected: 0,
    mistakes: 0,
    hints: 3,
    maxMistakes: 3,
    noteMode: false,
    elapsedBase: 0,
    startedAt: Date.now(),
    elapsed: 0,
    solved: false,
    locked: false,
    lastHint: -1,
    checking: false,
    dialogAction: "restart",
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

  function buildLevelPicker() {
    levelPicker.replaceChildren();
    currentConfig().levels.forEach((_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.level = String(index);
      button.textContent = `${index + 1}`;
      button.title = `第${CHINESE_NUMBERS[index]}关`;
      button.addEventListener("click", () => chooseLevel(index));
      levelPicker.appendChild(button);
    });
  }

  function boot() {
    buildBoard();
    bindControls();

    const progress = readProgress();
    const saves = readSaves();
    const lastKey = progress.lastKey;
    const lastSave = lastKey ? saves[lastKey] : null;

    if (lastSave && restoreSavedGame(lastSave)) {
      setStatus("已继续上次进度。");
    } else {
      const fallback = parseSaveKey(lastKey) || { difficulty: "normal", levelIndex: 0 };
      loadLevel(fallback.difficulty, fallback.levelIndex, { preferSave: true, silent: true });
    }

    window.setInterval(updateTimer, 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveCurrentGame();
    });
    window.addEventListener("beforeunload", saveCurrentGame);
  }

  function bindControls() {
    Array.from(difficultyPicker.querySelectorAll("[data-difficulty]")).forEach((button) => {
      button.addEventListener("click", () => chooseDifficulty(button.dataset.difficulty));
    });

    numberButtons.forEach((button) => {
      button.addEventListener("click", () => placeNumber(Number(button.dataset.number)));
    });

    noteButton.addEventListener("click", toggleNoteMode);
    eraseButton.addEventListener("click", eraseSelected);
    hintButton.addEventListener("click", useHint);
    checkButton.addEventListener("click", checkBoard);
    restartTop.addEventListener("click", restartLevel);
    redoButton.addEventListener("click", restartLevel);
    dialogButton.addEventListener("click", handleDialogAction);
    document.addEventListener("keydown", handleKeydown);
  }

  function chooseDifficulty(difficulty) {
    if (!findConfig(difficulty) || difficulty === state.difficulty) return;

    saveCurrentGame();
    const progress = readProgress();
    const lastByDifficulty = progress.lastByDifficulty[difficulty];
    const levelIndex = clampLevel(difficulty, Number.isInteger(lastByDifficulty) ? lastByDifficulty : progress.unlocked[difficulty]);
    loadLevel(difficulty, levelIndex, { preferSave: true });
  }

  function chooseLevel(levelIndex) {
    const progress = readProgress();
    const unlocked = progress.unlocked[state.difficulty] || 0;
    if (levelIndex > unlocked) {
      setStatus("先完成前面的关卡。");
      return;
    }
    if (levelIndex === state.levelIndex) return;

    saveCurrentGame();
    loadLevel(state.difficulty, levelIndex, { preferSave: true });
  }

  function loadLevel(difficulty, levelIndex, options = {}) {
    const safeDifficulty = findConfig(difficulty) ? difficulty : "normal";
    const safeLevel = clampLevel(safeDifficulty, levelIndex);
    const key = saveKey(safeDifficulty, safeLevel);
    const save = readSaves()[key];

    if (options.preferSave && save && restoreSavedGame(save)) {
      setStatus("已继续这一关的进度。");
      return;
    }

    startFreshLevel(safeDifficulty, safeLevel);
    if (!options.silent) {
      setStatus(`已进入${levelTitle(safeLevel)}。`);
    }
  }

  function startFreshLevel(difficulty, levelIndex) {
    const config = findConfig(difficulty);
    const puzzle = toNumbers(config.levels[levelIndex]);
    const solution = solvePuzzle(puzzle);

    state.difficulty = difficulty;
    state.levelIndex = levelIndex;
    state.puzzle = puzzle;
    state.solution = solution;
    state.values = puzzle.slice();
    state.notes = emptyNotes();
    state.selected = state.values.findIndex((value) => value === 0);
    state.mistakes = 0;
    state.hints = config.hints;
    state.maxMistakes = config.maxMistakes;
    state.noteMode = false;
    state.elapsedBase = 0;
    state.startedAt = Date.now();
    state.elapsed = 0;
    state.solved = false;
    state.locked = false;
    state.lastHint = -1;
    state.checking = false;
    state.dialogAction = "restart";

    dialog.hidden = true;
    noteButton.setAttribute("aria-pressed", "false");
    rememberLastLevel();
    render();
    saveCurrentGame();
  }

  function restartLevel() {
    clearSavedGame(state.difficulty, state.levelIndex);
    startFreshLevel(state.difficulty, state.levelIndex);
    setStatus("本关已重做。");
  }

  function restoreSavedGame(save) {
    if (!save || !findConfig(save.difficulty)) return false;
    const config = findConfig(save.difficulty);
    const levelIndex = clampLevel(save.difficulty, save.levelIndex);
    if (!Array.isArray(save.values) || save.values.length !== 81) return false;

    state.difficulty = save.difficulty;
    state.levelIndex = levelIndex;
    state.puzzle = toNumbers(config.levels[levelIndex]);
    state.solution = Array.isArray(save.solution) && save.solution.length === 81 ? save.solution : solvePuzzle(state.puzzle);
    state.values = save.values.slice(0, 81);
    state.notes = Array.isArray(save.notes) ? save.notes.map((note) => new Set(note)) : emptyNotes();
    while (state.notes.length < 81) state.notes.push(new Set());
    state.selected = Number.isInteger(save.selected) ? save.selected : state.values.findIndex((value) => value === 0);
    state.mistakes = Number.isInteger(save.mistakes) ? save.mistakes : 0;
    state.hints = Number.isInteger(save.hints) ? save.hints : config.hints;
    state.maxMistakes = config.maxMistakes;
    state.noteMode = Boolean(save.noteMode);
    state.elapsedBase = Number.isInteger(save.elapsed) ? save.elapsed : 0;
    state.startedAt = Date.now();
    state.elapsed = state.elapsedBase;
    state.solved = false;
    state.locked = false;
    state.lastHint = -1;
    state.checking = false;
    state.dialogAction = "restart";

    dialog.hidden = true;
    noteButton.setAttribute("aria-pressed", state.noteMode ? "true" : "false");
    rememberLastLevel();
    render();
    return true;
  }

  function render() {
    renderHeader();
    renderPickers();
    renderBoard();
    renderNumberPad();
    renderTools();
  }

  function renderHeader() {
    const config = currentConfig();
    puzzleNameEl.textContent = `${config.label} · ${levelTitle(state.levelIndex)}`;
    levelLabelEl.textContent = `${state.levelIndex + 1}/${config.levels.length}`;
    mistakesEl.textContent = `${state.mistakes}/${state.maxMistakes}`;
    hintCountEl.textContent = `提示 ${state.hints}`;
    bestTimeEl.textContent = bestTimeLabel();
    updateTimer();
  }

  function renderPickers() {
    Array.from(difficultyPicker.querySelectorAll("[data-difficulty]")).forEach((button) => {
      const active = button.dataset.difficulty === state.difficulty;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const currentButtons = Array.from(levelPicker.querySelectorAll("[data-level]"));
    if (currentButtons.length !== currentConfig().levels.length) buildLevelPicker();

    const progress = readProgress();
    Array.from(levelPicker.querySelectorAll("[data-level]")).forEach((button) => {
      const levelIndex = Number(button.dataset.level);
      const locked = levelIndex > (progress.unlocked[state.difficulty] || 0);
      const active = levelIndex === state.levelIndex;
      button.disabled = locked;
      button.classList.toggle("is-active", active);
      button.textContent = locked ? "锁" : String(levelIndex + 1);
      button.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  function renderBoard() {
    const selectedValue = state.values[state.selected] || 0;

    cells.forEach((cell, index) => {
      const value = state.values[index];
      const fixed = state.puzzle[index] !== 0;
      const row = Math.floor(index / 9);
      const col = index % 9;
      const selectedRow = Math.floor(state.selected / 9);
      const selectedCol = state.selected % 9;
      const related =
        index !== state.selected &&
        (row === selectedRow || col === selectedCol || boxIndex(index) === boxIndex(state.selected));
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

  function renderNumberPad() {
    const selectedValue = state.values[state.selected] || 0;
    numberButtons.forEach((button) => {
      const number = Number(button.dataset.number);
      button.classList.toggle("is-active", selectedValue === number);
      button.disabled = state.locked || countPlaced(number) >= 9;
    });
  }

  function renderTools() {
    hintButton.disabled = state.locked || state.hints <= 0;
    eraseButton.disabled = state.locked;
    checkButton.disabled = state.locked;
    noteButton.disabled = state.locked;
  }

  function selectCell(index) {
    if (state.locked) return;
    state.selected = index;
    state.lastHint = -1;
    render();
    saveCurrentGame();
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
      saveCurrentGame();
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
      if (state.mistakes >= state.maxMistakes) {
        endGame(false);
      }
    }

    if (!state.locked && isSolved()) {
      endGame(true);
    }

    render();
    saveCurrentGame();
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
    saveCurrentGame();
  }

  function useHint() {
    if (state.locked || state.hints <= 0) return;

    let index = state.selected;
    if (index < 0 || state.puzzle[index] !== 0 || state.values[index] === state.solution[index]) {
      index = state.values.findIndex(
        (value, cellIndex) => state.puzzle[cellIndex] === 0 && value !== state.solution[cellIndex],
      );
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
    saveCurrentGame();
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

    saveCurrentGame();
  }

  function endGame(won) {
    state.elapsedBase = currentElapsed();
    state.startedAt = Date.now();
    state.locked = true;
    state.solved = won;
    clearSavedGame(state.difficulty, state.levelIndex);

    if (won) {
      unlockNextLevel();
      saveBestTime();
      const hasNext = state.levelIndex < currentConfig().levels.length - 1;
      dialogKicker.textContent = "完成";
      dialogTitle.textContent = hasNext ? "漂亮，下一关开了。" : "这一档通关了。";
      dialogText.textContent = `本关用时 ${formatTime(state.elapsedBase)}，失误 ${state.mistakes} 次。`;
      dialogButton.textContent = hasNext ? "下一关" : "重做本关";
      state.dialogAction = hasNext ? "next" : "restart";
    } else {
      dialogKicker.textContent = "差一点";
      dialogTitle.textContent = "这关先重做。";
      dialogText.textContent = "失误次数用完了，重新来一次会更顺。";
      dialogButton.textContent = "重做本关";
      state.dialogAction = "restart";
    }

    dialog.hidden = false;
    render();
  }

  function handleDialogAction() {
    if (state.dialogAction === "next") {
      loadLevel(state.difficulty, state.levelIndex + 1, { preferSave: true });
    } else {
      restartLevel();
    }
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
    if (!dialog.hidden && event.key === "Enter") {
      handleDialogAction();
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
    if (state.locked) return;
    state.noteMode = !state.noteMode;
    noteButton.setAttribute("aria-pressed", state.noteMode ? "true" : "false");
    setStatus(state.noteMode ? "笔记模式已开启。" : "笔记模式已关闭。");
    saveCurrentGame();
  }

  function saveCurrentGame() {
    if (!state.puzzle.length || state.locked) return;
    updateElapsedOnly();

    const saves = readSaves();
    saves[saveKey(state.difficulty, state.levelIndex)] = {
      difficulty: state.difficulty,
      levelIndex: state.levelIndex,
      solution: state.solution,
      values: state.values,
      notes: state.notes.map((note) => Array.from(note)),
      selected: state.selected,
      mistakes: state.mistakes,
      hints: state.hints,
      noteMode: state.noteMode,
      elapsed: state.elapsed,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
    rememberLastLevel();
  }

  function clearSavedGame(difficulty, levelIndex) {
    const saves = readSaves();
    delete saves[saveKey(difficulty, levelIndex)];
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  }

  function rememberLastLevel() {
    const progress = readProgress();
    progress.lastKey = saveKey(state.difficulty, state.levelIndex);
    progress.lastByDifficulty[state.difficulty] = state.levelIndex;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  function unlockNextLevel() {
    const progress = readProgress();
    const next = Math.min(state.levelIndex + 1, currentConfig().levels.length - 1);
    progress.unlocked[state.difficulty] = Math.max(progress.unlocked[state.difficulty] || 0, next);
    progress.lastByDifficulty[state.difficulty] = next;
    progress.lastKey = saveKey(state.difficulty, next);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  function saveBestTime() {
    const progress = readProgress();
    const key = bestKey(state.difficulty, state.levelIndex);
    const oldBest = progress.best[key];
    if (!oldBest || state.elapsedBase < oldBest) {
      progress.best[key] = state.elapsedBase;
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    }
  }

  function readProgress() {
    const fallback = {
      unlocked: { easy: 0, normal: 0, hard: 0 },
      best: {},
      lastKey: "normal-0",
      lastByDifficulty: { easy: 0, normal: 0, hard: 0 },
    };

    try {
      const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
      return {
        unlocked: { ...fallback.unlocked, ...(parsed.unlocked || {}) },
        best: { ...fallback.best, ...(parsed.best || {}) },
        lastKey: typeof parsed.lastKey === "string" ? parsed.lastKey : fallback.lastKey,
        lastByDifficulty: { ...fallback.lastByDifficulty, ...(parsed.lastByDifficulty || {}) },
      };
    } catch {
      return fallback;
    }
  }

  function readSaves() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function currentConfig() {
    return findConfig(state.difficulty) || DIFFICULTIES[1];
  }

  function findConfig(difficulty) {
    return DIFFICULTIES.find((item) => item.id === difficulty);
  }

  function levelTitle(index) {
    return `第${CHINESE_NUMBERS[index] || index + 1}关`;
  }

  function bestTimeLabel() {
    const best = readProgress().best[bestKey(state.difficulty, state.levelIndex)];
    return best ? formatTime(best) : "--:--";
  }

  function saveKey(difficulty, levelIndex) {
    return `${difficulty}-${levelIndex}`;
  }

  function bestKey(difficulty, levelIndex) {
    return `${difficulty}:${levelIndex}`;
  }

  function parseSaveKey(key) {
    if (typeof key !== "string") return null;
    const [difficulty, level] = key.split("-");
    if (!findConfig(difficulty)) return null;
    return { difficulty, levelIndex: clampLevel(difficulty, Number(level)) };
  }

  function clampLevel(difficulty, levelIndex) {
    const config = findConfig(difficulty) || DIFFICULTIES[1];
    if (!Number.isInteger(levelIndex)) return 0;
    return Math.max(0, Math.min(config.levels.length - 1, levelIndex));
  }

  function updateTimer() {
    updateElapsedOnly();
    timerEl.textContent = formatTime(state.elapsed);
  }

  function updateElapsedOnly() {
    if (!state.locked) {
      state.elapsed = currentElapsed();
    }
  }

  function currentElapsed() {
    if (state.locked) return state.elapsedBase;
    return state.elapsedBase + Math.floor((Date.now() - state.startedAt) / 1000);
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function emptyNotes() {
    return Array.from({ length: 81 }, () => new Set());
  }

  function isSolved() {
    return state.values.every((value, index) => value === state.solution[index]);
  }

  function countPlaced(number) {
    return state.values.filter((value, index) => value === number && value === state.solution[index]).length;
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

  function toNumbers(puzzle) {
    return puzzle.split("").map((char) => Number(char));
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

  boot();
})();
