// BREACH PROTOCOL - Cyberpunk 2077 Accurate Recreation
// With persistent credits and upgrade shop

// === Storage Keys ===
const STORAGE_KEY = 'icepick_save';

// === Default Save Data ===
const DEFAULT_SAVE = {
  credits: 0,
  bufferSize: 4,
  breachTime: 15,
  difficulty: 0, // 0=standard, 1=advanced, 2=expert
  totalBreaches: 0,
  successfulBreaches: 0,
  bestStreak: 0,
  currentStreak: 0
};

// === Difficulty Settings ===
const DIFFICULTIES = [
  { name: 'STANDARD', matrixSize: 5, rewardMult: 1.0, color: '#02D7F2' },
  { name: 'ADVANCED', matrixSize: 6, rewardMult: 1.5, color: '#FFEB0B' },
  { name: 'EXPERT', matrixSize: 7, rewardMult: 2.5, color: '#ED1E79' }
];

// === Shop Items ===
const SHOP_ITEMS = [
  {
    id: 'buffer',
    name: 'BUFFER UPGRADE',
    desc: 'Increase buffer capacity',
    levels: [
      { cost: 2000, value: 5 },
      { cost: 5000, value: 6 },
      { cost: 12000, value: 7 },
      { cost: 25000, value: 8 }
    ],
    getStat: (save) => save.bufferSize,
    apply: (save, level) => { save.bufferSize = SHOP_ITEMS[0].levels[level].value; }
  },
  {
    id: 'time',
    name: 'NEURAL ACCELERATOR',
    desc: 'Increase breach time limit',
    levels: [
      { cost: 1500, value: 20 },
      { cost: 4000, value: 25 },
      { cost: 10000, value: 30 }
    ],
    getStat: (save) => save.breachTime,
    apply: (save, level) => { save.breachTime = SHOP_ITEMS[1].levels[level].value; }
  },
  {
    id: 'difficulty',
    name: 'ICE BREAKER PROTOCOLS',
    desc: 'Unlock harder difficulties with better rewards',
    levels: [
      { cost: 8000, value: 1, label: 'ADVANCED (1.5x rewards)' },
      { cost: 20000, value: 2, label: 'EXPERT (2.5x rewards)' }
    ],
    getStat: (save) => save.difficulty,
    apply: (save, level) => { save.difficulty = Math.max(save.difficulty, SHOP_ITEMS[2].levels[level].value); }
  }
];

// === Configuration ===
const CONFIG = {
  codes: ['1C', '55', '7A', 'BD', 'E9', 'FF']
};

// === Daemon Definitions ===
const DAEMONS = [
  { name: 'DATAMINE_V1', effect: 'Extract eurodollars', reward: 500, length: 2 },
  { name: 'DATAMINE_V2', effect: 'Extract eurodollars + components', reward: 1500, length: 3 },
  { name: 'DATAMINE_V3', effect: 'Extract rare components', reward: 3500, length: 4 }
];

// === DOM Elements ===
const $ = id => document.getElementById(id);
const elements = {
  matrix: $('matrix'),
  buffer: $('buffer'),
  bufferSize: $('buffer-size'),
  sequences: $('sequences'),
  timer: $('timer-value'),
  wallet: $('wallet-value'),
  rowHighlight: $('row-highlight'),
  colHighlight: $('col-highlight'),
  difficultyName: $('difficulty-name'),
  streakValue: $('streak-value'),
  resultOverlay: $('result-overlay'),
  resultTitle: $('result-title'),
  resultStats: $('result-stats'),
  shopOverlay: $('shop-overlay'),
  shopBalance: $('shop-balance'),
  shopItems: $('shop-items'),
  statBreaches: $('stat-breaches'),
  statSuccess: $('stat-success'),
  statStreak: $('stat-streak'),
  btnStart: $('btn-start'),
  btnShop: $('btn-shop'),
  btnExit: $('btn-exit'),
  btnContinue: $('btn-continue'),
  btnCloseShop: $('btn-close-shop')
};

// === Game State ===
let save = { ...DEFAULT_SAVE };
let state = {
  phase: 'ready',
  matrix: [],
  buffer: [],
  sequences: [],
  selections: [],
  selectionMode: 'row',
  currentIndex: 0,
  timerStarted: false,
  timeRemaining: 15,
  timerInterval: null,
  sessionReward: 0
};

// === Storage Functions ===
function loadSave() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      save = { ...DEFAULT_SAVE, ...JSON.parse(data) };
    }
  } catch (e) {
    console.warn('Failed to load save:', e);
  }
  updateUI();
}

function saveSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch (e) {
    console.warn('Failed to save:', e);
  }
}

// === Utility Functions ===
const randomCode = () => CONFIG.codes[Math.floor(Math.random() * CONFIG.codes.length)];
const getDifficulty = () => DIFFICULTIES[save.difficulty];

// === UI Updates ===
function updateUI() {
  elements.wallet.textContent = `€$${save.credits.toLocaleString()}`;
  elements.bufferSize.textContent = `(${save.bufferSize} SLOTS)`;
  elements.difficultyName.textContent = getDifficulty().name;
  elements.difficultyName.style.color = getDifficulty().color;
  elements.streakValue.textContent = save.currentStreak;
}

// === Matrix Generation ===
function generateMatrix() {
  const size = getDifficulty().matrixSize;
  state.matrix = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      row.push(randomCode());
    }
    state.matrix.push(row);
  }
}

function renderMatrix() {
  const size = getDifficulty().matrixSize;
  elements.matrix.innerHTML = '';
  elements.matrix.style.gridTemplateColumns = `repeat(${size}, 52px)`;
  
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';
      cell.textContent = state.matrix[r][c];
      cell.dataset.row = r;
      cell.dataset.col = c;
      
      if (state.phase === 'active') {
        const isUsed = state.selections.some(s => s.row === r && s.col === c);
        const isSelectable = checkSelectable(r, c);
        
        if (isUsed) {
          cell.classList.add('used');
        } else if (isSelectable) {
          cell.classList.add('selectable');
          cell.addEventListener('click', () => handleCellClick(r, c));
        }
      }
      
      elements.matrix.appendChild(cell);
    }
  }
  
  updateHighlights();
}

function checkSelectable(row, col) {
  if (state.buffer.length >= save.bufferSize) return false;
  if (state.selections.some(s => s.row === row && s.col === col)) return false;
  
  if (state.selections.length === 0) {
    return row === 0;
  }
  
  if (state.selectionMode === 'row') {
    return row === state.currentIndex;
  } else {
    return col === state.currentIndex;
  }
}

function updateHighlights() {
  const cellSize = 56;
  const size = getDifficulty().matrixSize;
  
  if (state.phase !== 'active' || state.selections.length === 0) {
    elements.rowHighlight.classList.remove('active');
    elements.colHighlight.classList.remove('active');
    return;
  }
  
  if (state.selectionMode === 'row') {
    elements.rowHighlight.classList.add('active');
    elements.colHighlight.classList.remove('active');
    elements.rowHighlight.style.top = `${state.currentIndex * cellSize}px`;
    elements.rowHighlight.style.left = '0';
    elements.rowHighlight.style.width = `${size * cellSize}px`;
    elements.rowHighlight.style.height = `${cellSize - 4}px`;
  } else {
    elements.colHighlight.classList.add('active');
    elements.rowHighlight.classList.remove('active');
    elements.colHighlight.style.left = `${state.currentIndex * cellSize}px`;
    elements.colHighlight.style.top = '0';
    elements.colHighlight.style.height = `${size * cellSize}px`;
    elements.colHighlight.style.width = `${cellSize - 4}px`;
  }
}

// === Buffer ===
function renderBuffer() {
  elements.buffer.innerHTML = '';
  
  for (let i = 0; i < save.bufferSize; i++) {
    const slot = document.createElement('div');
    slot.className = 'buffer-slot';
    
    if (state.buffer[i]) {
      slot.textContent = state.buffer[i];
      slot.classList.add('filled');
      
      if (checkBufferMatch(i)) {
        slot.classList.add('sequence-match');
      }
    }
    
    elements.buffer.appendChild(slot);
  }
}

function checkBufferMatch(index) {
  for (const seq of state.sequences) {
    if (seq.progress > index) return true;
  }
  return false;
}

// === Sequences ===
function generateSequences() {
  state.sequences = [];
  const mult = getDifficulty().rewardMult;
  
  DAEMONS.forEach(daemon => {
    const seq = { ...daemon };
    seq.reward = Math.floor(daemon.reward * mult);
    seq.codes = generateSequenceCodes(daemon.length);
    seq.progress = 0;
    seq.completed = false;
    seq.failed = false;
    state.sequences.push(seq);
  });
}

function generateSequenceCodes(length) {
  // Generate a solvable sequence by simulating a valid path through the matrix
  const size = getDifficulty().matrixSize;
  const codes = [];
  const usedCells = new Set();
  
  // Start from row 0 (first selection must be from row 0)
  let currentRow = 0;
  let currentCol = Math.floor(Math.random() * size);
  let selectingFromRow = true; // First real selection is from row 0
  
  // Pick first code from row 0
  codes.push(state.matrix[currentRow][currentCol]);
  usedCells.add(`${currentRow},${currentCol}`);
  selectingFromRow = false; // Next selection will be from the column
  
  // Generate remaining codes following valid path
  for (let i = 1; i < length; i++) {
    let found = false;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (!found && attempts < maxAttempts) {
      attempts++;
      
      if (selectingFromRow) {
        // Must pick from currentRow
        const availableCols = [];
        for (let c = 0; c < size; c++) {
          if (!usedCells.has(`${currentRow},${c}`)) {
            availableCols.push(c);
          }
        }
        
        if (availableCols.length > 0) {
          currentCol = availableCols[Math.floor(Math.random() * availableCols.length)];
          codes.push(state.matrix[currentRow][currentCol]);
          usedCells.add(`${currentRow},${currentCol}`);
          selectingFromRow = false;
          found = true;
        }
      } else {
        // Must pick from currentCol
        const availableRows = [];
        for (let r = 0; r < size; r++) {
          if (!usedCells.has(`${r},${currentCol}`)) {
            availableRows.push(r);
          }
        }
        
        if (availableRows.length > 0) {
          currentRow = availableRows[Math.floor(Math.random() * availableRows.length)];
          codes.push(state.matrix[currentRow][currentCol]);
          usedCells.add(`${currentRow},${currentCol}`);
          selectingFromRow = true;
          found = true;
        }
      }
      
      // If stuck, try resetting to a different starting point
      if (!found && attempts >= maxAttempts / 2) {
        // Fall back to picking a code that exists somewhere reachable
        const fallbackCode = state.matrix.flat()[Math.floor(Math.random() * size * size)];
        codes.push(fallbackCode);
        found = true;
      }
    }
    
    if (!found) {
      // Ultimate fallback - just pick from matrix
      codes.push(state.matrix.flat()[Math.floor(Math.random() * size * size)]);
    }
  }
  
  return codes;
}

function renderSequences() {
  elements.sequences.innerHTML = '';
  
  state.sequences.forEach(seq => {
    const div = document.createElement('div');
    div.className = 'sequence';
    if (seq.completed) div.classList.add('completed');
    if (seq.failed) div.classList.add('failed');
    
    const header = document.createElement('div');
    header.className = 'sequence-header';
    header.innerHTML = `
      <span class="sequence-name">${seq.name}</span>
      <span class="sequence-reward">€$${seq.reward.toLocaleString()}</span>
    `;
    
    const codes = document.createElement('div');
    codes.className = 'sequence-codes';
    seq.codes.forEach((code, i) => {
      const codeEl = document.createElement('span');
      codeEl.className = 'sequence-code';
      codeEl.textContent = code;
      
      if (i < seq.progress) {
        codeEl.classList.add('matched');
      } else if (i === seq.progress && !seq.completed && !seq.failed) {
        codeEl.classList.add('current');
      }
      
      codes.appendChild(codeEl);
    });
    
    const effect = document.createElement('div');
    effect.className = 'sequence-effect';
    effect.textContent = seq.effect;
    
    div.appendChild(header);
    div.appendChild(codes);
    div.appendChild(effect);
    elements.sequences.appendChild(div);
  });
}

// === Selection Logic ===
function handleCellClick(row, col) {
  if (state.phase !== 'active') return;
  if (!checkSelectable(row, col)) return;
  
  if (!state.timerStarted) {
    startTimer();
    state.timerStarted = true;
  }
  
  const code = state.matrix[row][col];
  
  state.buffer.push(code);
  state.selections.push({ row, col, code });
  
  if (state.selectionMode === 'row') {
    state.selectionMode = 'col';
    state.currentIndex = col;
  } else {
    state.selectionMode = 'row';
    state.currentIndex = row;
  }
  
  checkSequenceProgress(code);
  
  renderMatrix();
  renderBuffer();
  renderSequences();
  
  if (state.buffer.length >= save.bufferSize) {
    endBreach();
  }
  
  const allResolved = state.sequences.every(s => s.completed || s.failed);
  if (allResolved) {
    endBreach();
  }
}

function checkSequenceProgress(code) {
  state.sequences.forEach(seq => {
    if (seq.completed || seq.failed) return;
    
    const expectedCode = seq.codes[seq.progress];
    
    if (code === expectedCode) {
      seq.progress++;
      
      if (seq.progress >= seq.codes.length) {
        seq.completed = true;
        state.sessionReward += seq.reward;
      }
    } else {
      const remainingBuffer = save.bufferSize - state.buffer.length;
      const remainingCodes = seq.codes.length - seq.progress;
      
      if (remainingBuffer < remainingCodes) {
        seq.failed = true;
      }
    }
  });
}

// === Timer ===
function startTimer() {
  state.timeRemaining = save.breachTime;
  updateTimerDisplay();
  
  state.timerInterval = setInterval(() => {
    state.timeRemaining--;
    updateTimerDisplay();
    
    if (state.timeRemaining <= 0) {
      endBreach(true);
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(state.timeRemaining / 60);
  const secs = state.timeRemaining % 60;
  elements.timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  elements.timer.classList.remove('critical', 'inactive');
  
  if (!state.timerStarted && state.phase === 'active') {
    elements.timer.classList.add('inactive');
  } else if (state.timeRemaining <= 5) {
    elements.timer.classList.add('critical');
  }
}

// === Game Control ===
function initBreach() {
  state = {
    phase: 'active',
    matrix: [],
    buffer: [],
    sequences: [],
    selections: [],
    selectionMode: 'row',
    currentIndex: 0,
    timerStarted: false,
    timeRemaining: save.breachTime,
    timerInterval: null,
    sessionReward: 0
  };
  
  generateMatrix();
  generateSequences();
  
  renderMatrix();
  renderBuffer();
  renderSequences();
  updateTimerDisplay();
  
  elements.btnStart.disabled = true;
  elements.btnShop.disabled = true;
  elements.timer.classList.add('inactive');
}

function endBreach(timeout = false) {
  stopTimer();
  state.phase = 'complete';
  
  if (timeout) {
    state.sequences.forEach(s => {
      if (!s.completed) s.failed = true;
    });
  }
  
  const completed = state.sequences.filter(s => s.completed);
  
  // Update save stats
  save.totalBreaches++;
  if (completed.length > 0) {
    save.successfulBreaches++;
    save.currentStreak++;
    save.bestStreak = Math.max(save.bestStreak, save.currentStreak);
    save.credits += state.sessionReward;
  } else {
    save.currentStreak = 0;
  }
  
  saveSave();
  updateUI();
  renderSequences();
  showResults(completed, timeout);
}

function showResults(completed, timeout) {
  let titleClass = 'partial';
  let titleText = 'BREACH COMPLETE';
  
  if (timeout && completed.length === 0) {
    titleClass = 'failure';
    titleText = 'BREACH FAILED';
  } else if (completed.length === state.sequences.length) {
    titleClass = 'success';
    titleText = 'BREACH SUCCESSFUL';
  }
  
  elements.resultTitle.className = `result-title ${titleClass}`;
  elements.resultTitle.textContent = titleText;
  
  let statsHTML = '';
  
  state.sequences.forEach(seq => {
    const status = seq.completed ? 'success' : 'failure';
    const statusText = seq.completed ? 'UPLOADED' : 'FAILED';
    statsHTML += `
      <div class="result-stat">
        <span class="label">${seq.name}</span>
        <span class="value ${status}">${statusText}</span>
      </div>
    `;
  });
  
  if (state.sessionReward > 0) {
    statsHTML += `
      <div class="result-stat">
        <span class="label">REWARD</span>
        <span class="value success">+€$${state.sessionReward.toLocaleString()}</span>
      </div>
    `;
  }
  
  statsHTML += `
    <div class="result-stat">
      <span class="label">STREAK</span>
      <span class="value">${save.currentStreak}</span>
    </div>
  `;
  
  elements.resultStats.innerHTML = statsHTML;
  elements.resultOverlay.classList.add('active');
}

function closeResults() {
  elements.resultOverlay.classList.remove('active');
  resetToReady();
}

function resetToReady() {
  stopTimer();
  
  state.phase = 'ready';
  state.buffer = [];
  state.selections = [];
  state.timerStarted = false;
  state.sessionReward = 0;
  
  generateMatrix();
  generateSequences();
  
  renderMatrix();
  renderBuffer();
  renderSequences();
  updateUI();
  
  elements.btnStart.disabled = false;
  elements.btnShop.disabled = false;
  elements.timer.textContent = '00:00';
  elements.timer.classList.add('inactive');
}

function exitBreach() {
  if (state.phase === 'active') {
    stopTimer();
    endBreach(true);
  } else {
    resetToReady();
  }
}

// === Shop ===
function openShop() {
  if (state.phase === 'active') return;
  
  renderShop();
  elements.shopOverlay.classList.add('active');
}

function closeShop() {
  elements.shopOverlay.classList.remove('active');
}

function renderShop() {
  elements.shopBalance.textContent = `€$${save.credits.toLocaleString()}`;
  elements.statBreaches.textContent = save.totalBreaches;
  elements.statSuccess.textContent = save.totalBreaches > 0 
    ? Math.round((save.successfulBreaches / save.totalBreaches) * 100) + '%' 
    : '0%';
  elements.statStreak.textContent = save.bestStreak;
  
  elements.shopItems.innerHTML = '';
  
  SHOP_ITEMS.forEach(item => {
    const currentValue = item.getStat(save);
    let currentLevel = -1;
    
    // Find current level
    for (let i = 0; i < item.levels.length; i++) {
      if (item.levels[i].value <= currentValue) {
        currentLevel = i;
      }
    }
    
    const nextLevel = currentLevel + 1;
    const isMaxed = nextLevel >= item.levels.length;
    const nextUpgrade = isMaxed ? null : item.levels[nextLevel];
    const canAfford = nextUpgrade && save.credits >= nextUpgrade.cost;
    
    const div = document.createElement('div');
    div.className = 'shop-item';
    if (isMaxed) div.classList.add('maxed');
    if (!canAfford && !isMaxed) div.classList.add('locked');
    
    let levelText = '';
    if (item.id === 'buffer') {
      levelText = `Current: ${currentValue} slots`;
    } else if (item.id === 'time') {
      levelText = `Current: ${currentValue}s`;
    } else if (item.id === 'difficulty') {
      const unlocked = [];
      for (let i = 0; i <= save.difficulty; i++) {
        unlocked.push(DIFFICULTIES[i].name);
      }
      levelText = `Unlocked: ${unlocked.join(', ')}`;
    }
    
    div.innerHTML = `
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.desc}</div>
        <div class="shop-item-level">${levelText}</div>
      </div>
      <div class="shop-item-action">
        ${isMaxed ? `
          <button class="btn-buy maxed" disabled>MAXED</button>
        ` : `
          <div class="shop-item-price ${canAfford ? '' : 'expensive'}">€$${nextUpgrade.cost.toLocaleString()}</div>
          <button class="btn-buy" ${canAfford ? '' : 'disabled'} data-item="${item.id}" data-level="${nextLevel}">
            ${nextUpgrade.label || 'UPGRADE'}
          </button>
        `}
      </div>
    `;
    
    elements.shopItems.appendChild(div);
  });
  
  // Add buy button listeners using event delegation to prevent duplicates
  // Remove old listener if exists, then add new one
  const shopItemsEl = elements.shopItems;
  const newShopItems = shopItemsEl.cloneNode(true);
  shopItemsEl.parentNode.replaceChild(newShopItems, shopItemsEl);
  elements.shopItems = newShopItems;
  
  elements.shopItems.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-buy[data-item]');
    if (btn && !btn.disabled) {
      const itemId = btn.dataset.item;
      const level = parseInt(btn.dataset.level);
      purchaseUpgrade(itemId, level);
    }
  });
}

function purchaseUpgrade(itemId, level) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  
  const upgrade = item.levels[level];
  if (!upgrade || save.credits < upgrade.cost) return;
  
  save.credits -= upgrade.cost;
  item.apply(save, level);
  
  saveSave();
  updateUI();
  renderShop();
  renderBuffer(); // In case buffer size changed
}

// Cycle difficulty
function cycleDifficulty() {
  if (state.phase !== 'ready') return;
  
  // Only cycle through unlocked difficulties
  const maxUnlocked = save.difficulty;
  const current = DIFFICULTIES.findIndex(d => d.name === getDifficulty().name);
  const next = (current + 1) % (maxUnlocked + 1);
  
  // Temporarily set difficulty for display (actual save.difficulty is max unlocked)
  state.currentDifficulty = next;
  
  // We need a separate tracker for selected difficulty vs unlocked
  // Let's simplify: save.difficulty = selected difficulty (0-based)
  // And track max unlocked separately
}

// === Event Listeners ===
elements.btnStart.addEventListener('click', initBreach);
elements.btnShop.addEventListener('click', openShop);
elements.btnCloseShop.addEventListener('click', closeShop);
elements.btnExit.addEventListener('click', () => {
  if (state.phase === 'active') {
    exitBreach();
  } else {
    resetToReady();
  }
});
elements.btnContinue.addEventListener('click', closeResults);

document.addEventListener('keydown', (e) => {
  // Ignore if shop is open
  if (elements.shopOverlay.classList.contains('active')) {
    if (e.key === 'Escape') closeShop();
    return;
  }
  
  if (e.key === 'Enter') {
    if (elements.resultOverlay.classList.contains('active')) {
      closeResults();
    } else if (state.phase === 'ready') {
      initBreach();
    }
  }
  if (e.key === 'Escape') {
    if (elements.resultOverlay.classList.contains('active')) {
      closeResults();
    } else if (state.phase === 'active') {
      exitBreach();
    } else if (state.phase === 'ready') {
      resetToReady();
    }
  }
  if (e.key.toLowerCase() === 's' && state.phase === 'ready') {
    openShop();
  }
});

// === Cleanup ===
function cleanup() {
  stopTimer();
  // Clear any orphaned intervals
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// === Initialize ===
function init() {
  loadSave();
  generateMatrix();
  generateSequences();
  renderMatrix();
  renderBuffer();
  renderSequences();
  elements.timer.textContent = '00:00';
  elements.timer.classList.add('inactive');
  
  // Cleanup on page unload to prevent orphaned intervals
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);
}

init();

console.log('%c BREACH PROTOCOL ', 'background: #FFEB0B; color: #000; font-size: 16px; font-weight: bold;');
console.log('%c Access Point Detected ', 'background: #02D7F2; color: #000;');
