'use strict';

/* =========================================================
   Meme Coin Detective: The On-Chain Hunt
   Vanilla JS game logic — no dependencies, no build step.
   ========================================================= */

console.log('%c🕵️ Meme Coin Detective: The On-Chain Hunt', 'color:#39ff88;font-size:15px;font-weight:bold;');
console.log('%cThe only guaranteed 100x is reading the source. Ape responsibly.', 'color:#8a8577;font-size:11px;');

/* ---------------- Utility ---------------- */

const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const choice = (arr) => arr[randInt(0, arr.length - 1)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function randomBase58(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += BASE58[randInt(0, BASE58.length - 1)];
  return s;
}
function truncateAddress(addr) {
  return addr.slice(0, 4) + '…' + addr.slice(-4);
}

/* ---------------- Audio (synthesized, no assets) ---------------- */

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, startOffset, duration, type = 'sine', peakGain = 0.2, freqEnd = null) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + startOffset;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== null) osc.frequency.linearRampToValueAtTime(freqEnd, t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.02, duration / 4));
  gain.gain.linearRampToValueAtTime(0, t0 + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function playClick() {
  if (!audioCtx) return;
  playTone(720, 0, 0.05, 'square', 0.12);
}

function playFlag() {
  if (!audioCtx) return;
  playTone(340, 0, 0.07, 'square', 0.1);
}

function playCashRegister() {
  if (!audioCtx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => playTone(f, i * 0.07, 0.14, 'triangle', 0.18));
}

function playSadTrombone() {
  if (!audioCtx) return;
  const notes = [
    { f: 330, fe: 300, t: 0.0, d: 0.35 },
    { f: 300, fe: 270, t: 0.32, d: 0.35 },
    { f: 270, fe: 240, t: 0.64, d: 0.35 },
    { f: 240, fe: 160, t: 0.96, d: 0.7 },
  ];
  notes.forEach((n) => playTone(n.f, n.t, n.d, 'sawtooth', 0.16, n.fe));
}

function playWarningBlip() {
  if (!audioCtx) return;
  playTone(1000, 0, 0.08, 'square', 0.1);
  playTone(1000, 0.14, 0.08, 'square', 0.1);
}

/* ---------------- Rewarded ad service (pluggable) ----------------
   AdService is the seam for monetization. Swap MockAdAdapter for a real
   SDK adapter (Google H5 Games Ads, CrazyGames SDK, AdinPlay, etc.) when
   this game is embedded on an ad-supported portal — every call site in
   this file only ever talks to AdService.showRewarded(), never to a
   vendor SDK directly, so the adapter is the only thing that needs to
   change. ------------------------------------------------------------ */

const AdService = {
  adapter: null,
  init(adapter) { this.adapter = adapter; },
  showRewarded(placementName, onReward, onClose) {
    if (!this.adapter) { if (onClose) onClose(); return; }
    this.adapter.showRewarded(placementName, onReward, onClose);
  },
};

const MockAdAdapter = {
  showRewarded(placementName, onReward, onClose) {
    const modal = document.getElementById('ad-modal');
    const label = document.getElementById('ad-modal-label');
    const countdownEl = document.getElementById('ad-modal-countdown');
    label.textContent = placementName;
    modal.classList.remove('hidden');

    let secondsLeft = 4;
    countdownEl.textContent = secondsLeft;
    const interval = setInterval(() => {
      secondsLeft--;
      countdownEl.textContent = Math.max(secondsLeft, 0);
      if (secondsLeft <= 0) {
        clearInterval(interval);
        modal.classList.add('hidden');
        if (onReward) onReward();
        if (onClose) onClose();
      }
    }, 1000);
  },
};

// Real adapter for when the game is running inside the CrazyGames iframe.
// Uses the documented HTML5 SDK v3 API: window.CrazyGames.SDK.ad.requestAd().
const CrazyGamesAdAdapter = {
  showRewarded(placementName, onReward, onClose) {
    window.CrazyGames.SDK.ad.requestAd('rewarded', {
      adFinished: () => {
        if (onReward) onReward();
        if (onClose) onClose();
      },
      adError: () => {
        // No fill / ad blocked / SDK error — fail gracefully, no reward.
        if (onClose) onClose();
      },
      adStarted: () => {},
    });
  },
};

// CrazyGames SDK lifecycle — only meaningful inside the CrazyGames iframe.
// Everywhere else (GitHub Pages, local file, itch.io) these are no-ops so the
// game keeps working standalone with the mock ad adapter.
const CrazyGamesLifecycle = {
  active: false,
  init() {
    if (typeof window.CrazyGames === 'undefined') {
      AdService.init(MockAdAdapter);
      return;
    }
    window.CrazyGames.SDK.init().then(() => {
      this.active = true;
      AdService.init(CrazyGamesAdAdapter);
      window.CrazyGames.SDK.game.loadingStop();
    }).catch(() => {
      AdService.init(MockAdAdapter);
    });
  },
  gameplayStart() {
    if (this.active) window.CrazyGames.SDK.game.gameplayStart();
  },
  gameplayStop() {
    if (this.active) window.CrazyGames.SDK.game.gameplayStop();
  },
};

AdService.init(MockAdAdapter);
if (typeof window.CrazyGames !== 'undefined') {
  window.CrazyGames.SDK.game.loadingStart();
}
CrazyGamesLifecycle.init();

/* ---------------- Screen management ---------------- */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ---------------- Game state ---------------- */

const state = {
  bankroll: 1000,
  heat: 0,
  casesSolved: 0,
  streak: 0,
  currentCase: null,
  scanFlags: new Set(),
  intelGood: false,
  adTipUsed: false,
  lastScanStats: null,
  stake: 0,
  bestMultiplierRun: 1,
  hold: null, // runtime hold-phase data
};

const HS_KEY_BANKROLL = 'mcd_high_bankroll';
const HS_KEY_CASES = 'mcd_high_cases';
const HS_KEY_MULTIPLIER = 'mcd_high_multiplier';
const HS_KEY_HOF = 'mcd_hall_of_fame';

function loadHighScores() {
  const bankroll = parseInt(localStorage.getItem(HS_KEY_BANKROLL) || '0', 10);
  const cases = parseInt(localStorage.getItem(HS_KEY_CASES) || '0', 10);
  const multiplier = parseFloat(localStorage.getItem(HS_KEY_MULTIPLIER) || '0');
  return { bankroll, cases, multiplier };
}

function loadHallOfFame() {
  try {
    return JSON.parse(localStorage.getItem(HS_KEY_HOF) || '[]');
  } catch (e) {
    return [];
  }
}

function maybeSaveHighScore() {
  const hs = loadHighScores();
  if (state.bankroll > hs.bankroll) localStorage.setItem(HS_KEY_BANKROLL, String(Math.round(state.bankroll)));
  if (state.casesSolved > hs.cases) localStorage.setItem(HS_KEY_CASES, String(state.casesSolved));
  if (state.bestMultiplierRun > hs.multiplier) localStorage.setItem(HS_KEY_MULTIPLIER, String(state.bestMultiplierRun));
}

function recordHallOfFameEntry() {
  if (state.casesSolved === 0) return;
  const entries = loadHallOfFame();
  entries.push({
    bankroll: Math.round(state.bankroll),
    cases: state.casesSolved,
    multiplier: Number(state.bestMultiplierRun.toFixed(2)),
  });
  entries.sort((a, b) => b.bankroll - a.bankroll);
  localStorage.setItem(HS_KEY_HOF, JSON.stringify(entries.slice(0, 5)));
}

function pluralize(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function renderHighScoreLine() {
  const hs = loadHighScores();
  const statsEl = document.getElementById('high-score-line');
  if (hs.bankroll > 0) {
    statsEl.textContent = `Best case file: ${formatMoney(hs.bankroll)} bankroll · ${pluralize(hs.cases, 'case')} solved · ${hs.multiplier.toFixed(2)}x best cash-out`;
  } else {
    statsEl.textContent = '';
  }

  const hofEl = document.getElementById('hof-list');
  const entries = loadHallOfFame();
  if (entries.length === 0) {
    hofEl.innerHTML = '';
    return;
  }
  hofEl.innerHTML = '<div class="hof-header">HALL OF FAME</div>' + entries.map((e, i) =>
    `<div class="hof-row"><span class="hof-rank">#${i + 1}</span><span class="hof-bankroll">${formatMoney(e.bankroll)}</span><span class="hof-detail">${pluralize(e.cases, 'case')} · ${e.multiplier.toFixed(2)}x best</span></div>`
  ).join('');
}

function updateHud() {
  document.getElementById('hud-bankroll').textContent = formatMoney(state.bankroll);
  document.getElementById('hud-case').textContent = state.casesSolved + 1;
  const fires = '🔥'.repeat(clamp(1 + Math.floor(state.heat / 2), 1, 5));
  document.getElementById('hud-heat').textContent = fires;
  document.getElementById('hud-streak').textContent = state.streak > 0 ? `⚡${state.streak}` : '—';
}

/* ---------------- Coin name generator ---------------- */

const COIN_PREFIXES = ['WOJAK', 'PEPE', 'DOGE', 'CHAD', 'GIGA', 'RUG', 'MOON', 'BASED', 'NGMI', 'WAGMI',
  'REKT', 'SIGMA', 'FLOKI', 'BONK', 'TURBO', 'ELON', 'SAFU', 'APE', 'DEGEN', 'COPE', 'SNIPER', 'FOMO'];
const COIN_SUFFIXES = ['9000', 'INU', 'KING', 'MAX', 'AI', 'X', '2', 'CEO', 'LORD', 'ULTRA', '69', '420',
  'PRIME', '666', 'COIN', 'SOL', ''];

function generateCoinName() {
  const p = choice(COIN_PREFIXES);
  const s = choice(COIN_SUFFIXES);
  return '$' + p + s;
}

/* ---------------- Case generation ---------------- */

function generateCase(heat) {
  const walletCount = clamp(6 + Math.floor(heat / 2), 6, 10);
  const botFraction = clamp(0.3 + heat * 0.035, 0.25, 0.7);
  let botCount = clamp(Math.round(walletCount * botFraction), 1, walletCount - 1);

  const scanTime = clamp(10 - heat * 0.4, 5, 10);
  const botJitter = clamp(0.03 + heat * 0.012, 0.03, 0.22); // higher heat = bots harder to spot

  const botIndices = new Set();
  while (botIndices.size < botCount) botIndices.add(randInt(0, walletCount - 1));

  const wallets = [];
  for (let i = 0; i < walletCount; i++) {
    const isBot = botIndices.has(i);
    const address = randomBase58(44);
    const txCount = 5;
    const amounts = [];
    const gaps = [];

    if (isBot) {
      const baseAmount = rand(0.3, 4.5);
      const baseGap = rand(0.15, 0.6);
      for (let t = 0; t < txCount; t++) {
        amounts.push(clamp(baseAmount * (1 + rand(-botJitter, botJitter)), 0.05, 5));
        gaps.push(clamp(baseGap * (1 + rand(-botJitter, botJitter)), 0.05, 5));
      }
    } else {
      for (let t = 0; t < txCount; t++) {
        amounts.push(rand(0.05, 5));
        gaps.push(rand(0.1, 3.2));
      }
    }

    wallets.push({ address, isBot, amounts, gaps });
  }

  const hiddenRiskRatio = botCount / walletCount;
  const effectiveRisk = clamp(hiddenRiskRatio * 0.75 + heat * 0.02, 0.05, 0.92);

  const rugCenter = lerp(9000, 1800, effectiveRisk);
  const rugTime = clamp(rugCenter * rand(0.75, 1.25), 1200, 13000);

  const growthRate = 0.22 + heat * 0.015; // per second
  const wavePhase1 = rand(0, Math.PI * 2);
  const wavePhase2 = rand(0, Math.PI * 2);

  return {
    coinName: generateCoinName(),
    wallets,
    walletCount,
    botCount,
    scanTime,
    hiddenRiskRatio,
    effectiveRisk,
    rugTime,
    growthRate,
    wavePhase1,
    wavePhase2,
  };
}

/* ---------------- Briefing screen ---------------- */

const BRIEFING_LINES = [
  "Word on the street: {coin} is either the next 100x, or another rug waiting to happen. Your call, detective.",
  "{coin} just hit the charts. Somebody's wallets look clean. Somebody's don't. Find out which is which.",
  "Anonymous tip just came in about {coin}. Read the chain before you read the room wrong.",
  "The dev behind {coin} hasn't said a word since launch. That's either very good, or very bad.",
  "{coin} is pumping. The question isn't if it dumps — it's who dumps it, and when.",
];

let typewriterTimer = null;

function startBriefing(gameCase) {
  document.getElementById('briefing-case-num').textContent = state.casesSolved + 1;
  document.getElementById('briefing-coin-name').textContent = gameCase.coinName;
  document.getElementById('briefing-wallet-count').textContent = gameCase.walletCount;
  document.getElementById('briefing-scan-time').textContent = gameCase.scanTime.toFixed(1) + 's';

  const line = choice(BRIEFING_LINES).replace('{coin}', gameCase.coinName);
  const textEl = document.getElementById('briefing-text');
  textEl.innerHTML = '<span class="cursor">&nbsp;</span>';

  clearInterval(typewriterTimer);
  let i = 0;
  const finish = () => {
    clearInterval(typewriterTimer);
    textEl.textContent = line;
  };
  textEl.onclick = finish;
  typewriterTimer = setInterval(() => {
    i++;
    textEl.innerHTML = line.slice(0, i) + '<span class="cursor">&nbsp;</span>';
    if (i >= line.length) finish();
  }, 16);

  showScreen('screen-briefing');
}

/* ---------------- Scan screen ---------------- */

let scanTimerInterval = null;
let scanTimeLeft = 0;
let scanTimeTotal = 0;

function setupScanScreen(gameCase) {
  state.scanFlags = new Set();
  state.adTipUsed = false;
  const adTipBtn = document.getElementById('btn-ad-tip');
  adTipBtn.disabled = false;
  adTipBtn.textContent = '📞 Call a Contact (Watch Ad)';

  const grid = document.getElementById('wallet-grid');
  grid.innerHTML = '';

  const globalMax = 5.0; // fixed scale so bot uniformity is visible

  gameCase.wallets.forEach((wallet, idx) => {
    const card = document.createElement('div');
    card.className = 'wallet-card';
    card.dataset.idx = idx;

    const sparkRow = document.createElement('div');
    sparkRow.className = 'spark-row';
    wallet.amounts.forEach((amt) => {
      const bar = document.createElement('div');
      bar.className = 'spark-bar';
      bar.style.height = clamp((amt / globalMax) * 100, 6, 100) + '%';
      sparkRow.appendChild(bar);
    });

    const gapRow = document.createElement('div');
    gapRow.className = 'gap-row';
    wallet.gaps.forEach((g) => {
      const span = document.createElement('span');
      span.textContent = g.toFixed(2) + 's';
      gapRow.appendChild(span);
    });

    card.innerHTML = `<span class="wallet-flag-icon">🚩</span><div class="wallet-address">${truncateAddress(wallet.address)}</div>`;
    card.appendChild(sparkRow);
    card.appendChild(gapRow);

    card.addEventListener('click', () => {
      if (state.scanFlags.has(idx)) {
        state.scanFlags.delete(idx);
        card.classList.remove('flagged');
      } else {
        state.scanFlags.add(idx);
        card.classList.add('flagged');
        playFlag();
      }
    });

    grid.appendChild(card);
  });

  scanTimeTotal = gameCase.scanTime;
  scanTimeLeft = gameCase.scanTime;
  updateScanTimerUI();
  startScanTimerInterval();

  showScreen('screen-scan');
}

function startScanTimerInterval() {
  clearInterval(scanTimerInterval);
  scanTimerInterval = setInterval(() => {
    scanTimeLeft -= 0.1;
    updateScanTimerUI();
    if (scanTimeLeft <= 0) {
      clearInterval(scanTimerInterval);
      finishScan();
    }
  }, 100);
}

function updateScanTimerUI() {
  const pct = clamp((scanTimeLeft / scanTimeTotal) * 100, 0, 100);
  const fill = document.getElementById('scan-timer-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('danger', pct < 30);
  document.getElementById('scan-timer-seconds').textContent = Math.max(0, scanTimeLeft).toFixed(1);
}

function finishScan() {
  clearInterval(scanTimerInterval);
  computeScanResults(state.currentCase);
}

function useAdTip() {
  if (state.adTipUsed) return;
  const gameCase = state.currentCase;
  const btn = document.getElementById('btn-ad-tip');

  const unflaggedBots = gameCase.wallets
    .map((wallet, idx) => ({ wallet, idx }))
    .filter(({ wallet, idx }) => wallet.isBot && !state.scanFlags.has(idx));

  if (unflaggedBots.length === 0) {
    const original = btn.textContent;
    btn.textContent = "Already got 'em all";
    setTimeout(() => { btn.textContent = original; }, 1200);
    return;
  }

  btn.disabled = true;
  clearInterval(scanTimerInterval); // pause the clock while the "ad" plays — fair pause, same as a real rewarded break

  AdService.showRewarded('Call a Contact', () => {
    const pick = choice(unflaggedBots);
    state.scanFlags.add(pick.idx);
    const card = document.querySelector(`#wallet-grid [data-idx="${pick.idx}"]`);
    if (card) card.classList.add('flagged', 'tipped');
    playFlag();
    state.adTipUsed = true;
    btn.textContent = '📞 Lead used';
  }, () => {
    if (!state.adTipUsed) btn.disabled = false;
    startScanTimerInterval();
  });
}

/* ---------------- Scan results ---------------- */

function computeScanResults(gameCase) {
  const list = document.getElementById('scan-results-list');
  list.innerHTML = '';

  let hits = 0;
  let falseFlags = 0;
  let missed = 0;

  const grid = document.getElementById('wallet-grid');

  gameCase.wallets.forEach((wallet, idx) => {
    const flagged = state.scanFlags.has(idx);
    const card = grid.querySelector(`[data-idx="${idx}"]`);
    const row = document.createElement('div');

    if (wallet.isBot && flagged) {
      hits++;
      row.className = 'scan-result-row hit';
      row.innerHTML = `<span>${truncateAddress(wallet.address)}</span><span>✅ Confirmed bot / sniper wallet</span>`;
      if (card) { card.classList.add('correct'); addVerdict(card, 'bot'); }
    } else if (wallet.isBot && !flagged) {
      missed++;
      row.className = 'scan-result-row miss';
      row.innerHTML = `<span>${truncateAddress(wallet.address)}</span><span>⚠️ Missed — was actually a bot</span>`;
      if (card) { card.classList.add('wrong'); addVerdict(card, 'bot'); }
    } else if (!wallet.isBot && flagged) {
      falseFlags++;
      row.className = 'scan-result-row false-flag';
      row.innerHTML = `<span>${truncateAddress(wallet.address)}</span><span>❌ False flag — organic trader</span>`;
      if (card) { card.classList.add('wrong'); addVerdict(card, 'organic'); }
    } else {
      row.className = 'scan-result-row';
      row.innerHTML = `<span>${truncateAddress(wallet.address)}</span><span>— Organic trader, correctly ignored</span>`;
      if (card) { addVerdict(card, 'organic'); }
    }
    list.appendChild(row);
  });

  const accuracy = gameCase.botCount > 0 ? clamp((hits - falseFlags) / gameCase.botCount, 0, 1) : 0;
  state.intelGood = accuracy >= 0.6;
  state.lastScanStats = { hits, falseFlags, missed, botCount: gameCase.botCount };

  const bonus = hits * 15 - falseFlags * 8;
  state.bankroll = Math.max(0, state.bankroll + bonus);
  updateHud();

  const summary = document.getElementById('scan-results-summary');
  summary.innerHTML = `You flagged ${hits} of ${gameCase.botCount} bot wallets correctly` +
    (falseFlags > 0 ? `, with ${falseFlags} false accusation(s).` : '.') +
    `<br>Field intel: ` +
    (state.intelGood
      ? `<span class="intel-good">SOLID.</span> You'll get a heads-up before anything shady goes down.`
      : `<span class="intel-bad">SHAKY.</span> You're flying blind on this one. Good luck, detective.`) +
    `<br>Detective bonus: ` +
    (bonus >= 0
      ? `<span class="intel-good">+${formatMoney(bonus)}</span> added to your bankroll.`
      : `<span class="intel-bad">${formatMoney(bonus)}</span> — sloppy accusations cost you.`);

  const toBuyBtn = document.getElementById('btn-to-buy');
  toBuyBtn.textContent = state.bankroll <= 0 ? 'See Case File' : 'Proceed to Buy Screen';

  showScreen('screen-scan-results');
}

function addVerdict(card, kind) {
  const v = document.createElement('div');
  v.className = 'wallet-verdict ' + kind;
  v.textContent = kind === 'bot' ? 'BOT / SNIPER PATTERN' : 'ORGANIC TRADER';
  card.appendChild(v);
}

/* ---------------- Live wallet activity feed (gmgn-style ticker) ---------------- */

const KOL_TAGS = [
  { cls: 'smart', label: 'Smart Money' },
  { cls: 'whale', label: 'Whale' },
  { cls: 'sniper', label: 'Sniper' },
  { cls: 'kol', label: 'KOL' },
];

const KOL_HANDLES = ['@GigaChad_Calls', '@SolanaSensei', '@RugRadarTom', '@AnonWhale88', '@DegenOracle',
  '@ChartWizard', '@InsiderAlpha', '@MoonMathGuy', '@PumpProphet', '@CalloutKing'];

const KOL_JOKE_ROWS = [
  "🐕 Anonymous wallet bought $0.03 — that's like, one Doge",
  '👻 Dev wallet balance: 0.00 SOL',
  '🪨 Wallet holds 400 NFTs of rocks',
  '🧻 Someone just paperhanded 2 minutes in',
  '🔮 Wallet labeled "not_a_rug.sol" just bought in',
  '🐋 Whale wallet renamed itself to "totally_not_the_dev"',
];

function spawnKolRow() {
  const rowsEl = document.getElementById('kol-feed-rows');
  if (!rowsEl) return;

  const row = document.createElement('div');
  row.className = 'kol-row';

  if (Math.random() < 0.1) {
    row.innerHTML = `<span class="kol-joke">${choice(KOL_JOKE_ROWS)}</span>`;
  } else {
    const tag = choice(KOL_TAGS);
    const isBuy = Math.random() < 0.78;
    const label = tag.cls === 'kol' ? choice(KOL_HANDLES) : truncateAddress(randomBase58(44));
    const amount = randInt(300, 40000);
    row.innerHTML = `<span class="kol-tag ${tag.cls}">${tag.label}</span>` +
      `<span class="kol-addr">${label}</span>` +
      `<span class="kol-side ${isBuy ? 'buy' : 'sell'}">${isBuy ? 'BUY' : 'SELL'}</span>` +
      `<span class="kol-amt">${formatMoney(amount)}</span>`;
  }

  rowsEl.insertBefore(row, rowsEl.firstChild);
  while (rowsEl.children.length > 8) rowsEl.removeChild(rowsEl.lastChild);
}

function scheduleKolRow(h) {
  if (!h || h.resolved) return;
  h.kolTimeout = setTimeout(() => {
    if (!h || h.resolved) return;
    spawnKolRow();
    scheduleKolRow(h);
  }, rand(500, 1400));
}

/* ---------------- Buy screen ---------------- */

function setStake(amount) {
  const bankroll = Math.max(1, Math.floor(state.bankroll));
  state.stake = clamp(Math.round(amount) || 1, 1, bankroll);
  document.getElementById('stake-slider').value = state.stake;
  document.getElementById('buy-amount').textContent = formatMoney(state.stake);
}

function setupBuyScreen(gameCase) {
  document.getElementById('buy-coin-name').textContent = gameCase.coinName;
  const bankroll = Math.max(1, Math.floor(state.bankroll));
  const slider = document.getElementById('stake-slider');
  slider.min = 1;
  slider.max = bankroll;
  const defaultStake = clamp(state.stake || Math.min(100, bankroll), 1, bankroll);
  setStake(defaultStake);
  showScreen('screen-buy');
}

/* ---------------- Hold screen (core reaction game) ---------------- */

function showHoldToast(text) {
  const el = document.getElementById('hold-toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(showHoldToast.timeout);
  showHoldToast.timeout = setTimeout(() => el.classList.add('hidden'), 1800);
}

function updateHoldButtons() {
  const h = state.hold;
  if (!h) return;
  const halfBtn = document.getElementById('btn-sell-half');
  const sellBtn = document.getElementById('btn-sell');
  const canPartial = h.remainingStake > 5 && h.partialSellCount < 3;
  halfBtn.disabled = !canPartial;
  sellBtn.textContent = h.partialSellCount > 0 ? `SELL REST (${formatMoney(h.remainingStake)})` : 'SELL';
}

function setupHoldScreen(gameCase) {
  CrazyGamesLifecycle.gameplayStart();
  document.getElementById('hold-coin-name').textContent = gameCase.coinName;
  document.getElementById('warning-banner').classList.add('hidden');
  document.getElementById('rug-flash').classList.add('hidden');
  document.getElementById('hold-toast').classList.add('hidden');
  const multEl = document.getElementById('hold-multiplier');
  multEl.classList.remove('falling');
  multEl.textContent = '1.00x';
  document.getElementById('hold-pnl-preview').textContent = '+$0';
  document.getElementById('kol-feed-rows').innerHTML = '';

  showScreen('screen-hold');

  const canvas = document.getElementById('hold-canvas');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const warningLead = rand(300, 900);

  state.hold = {
    startTime: performance.now(),
    resolved: false,
    warningShown: false,
    warningLead,
    points: [],
    ctx,
    canvasWidth: rect.width,
    canvasHeight: rect.height,
    rafId: null,
    kolTimeout: null,
    remainingStake: state.stake,
    realizedProfit: 0,
    partialSellCount: 0,
  };

  updateHoldButtons();
  state.hold.rafId = requestAnimationFrame(holdLoop);
  scheduleKolRow(state.hold);
}

function computeMultiplier(gameCase, ts) {
  const m = 1 + gameCase.growthRate * ts
    + 0.12 * Math.sin(0.9 * ts + gameCase.wavePhase1)
    + 0.05 * Math.sin(3.2 * ts + gameCase.wavePhase2);
  return Math.max(0.35, m);
}

function holdLoop(now) {
  const h = state.hold;
  const gameCase = state.currentCase;
  if (!h || h.resolved) return;

  const elapsed = now - h.startTime;
  const ts = elapsed / 1000;
  const m = computeMultiplier(gameCase, ts);

  h.points.push({ t: elapsed, m });
  const cutoff = elapsed - 8000;
  while (h.points.length && h.points[0].t < cutoff) h.points.shift();

  drawChart(h, gameCase, elapsed);

  const multEl = document.getElementById('hold-multiplier');
  multEl.textContent = m.toFixed(2) + 'x';
  multEl.classList.toggle('falling', m < 1);
  const pnl = h.realizedProfit + h.remainingStake * (m - 1);
  const pnlEl = document.getElementById('hold-pnl-preview');
  pnlEl.textContent = (pnl >= 0 ? '+' : '') + formatMoney(pnl);

  if (state.intelGood && !h.warningShown && elapsed >= gameCase.rugTime - h.warningLead && elapsed < gameCase.rugTime) {
    h.warningShown = true;
    document.getElementById('warning-banner').classList.remove('hidden');
    playWarningBlip();
  }

  if (elapsed >= gameCase.rugTime) {
    triggerRug();
    return;
  }

  h.rafId = requestAnimationFrame(holdLoop);
}

function drawChart(h, gameCase, elapsedNow) {
  const ctx = h.ctx;
  const w = h.canvasWidth;
  const height = h.canvasHeight;
  ctx.clearRect(0, 0, w, height);

  if (h.points.length < 2) return;

  const windowMs = 8000;
  const tMin = elapsedNow - windowMs;
  const tMax = elapsedNow;

  let minM = Infinity, maxM = -Infinity;
  h.points.forEach((p) => { if (p.m < minM) minM = p.m; if (p.m > maxM) maxM = p.m; });
  if (minM === maxM) { minM -= 0.5; maxM += 0.5; }
  const pad = (maxM - minM) * 0.15;
  minM -= pad; maxM += pad;

  const xOf = (t) => ((t - tMin) / (tMax - tMin)) * w;
  const yOf = (m) => height - ((m - minM) / (maxM - minM)) * height;

  // baseline at 1.0x
  if (minM < 1 && maxM > 1) {
    ctx.strokeStyle = 'rgba(242,193,78,0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, yOf(1));
    ctx.lineTo(w, yOf(1));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#39ff88';
  ctx.shadowColor = 'rgba(57,255,136,0.6)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  h.points.forEach((p, i) => {
    const x = xOf(p.t);
    const y = yOf(p.m);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function stopHoldLoop() {
  const h = state.hold;
  if (h) {
    h.resolved = true;
    if (h.rafId) cancelAnimationFrame(h.rafId);
    if (h.kolTimeout) clearTimeout(h.kolTimeout);
  }
}

function triggerRug() {
  const h = state.hold;
  const gameCase = state.currentCase;
  if (!h || h.resolved) return;
  stopHoldLoop();

  playSadTrombone();
  document.getElementById('rug-flash').classList.remove('hidden');
  document.getElementById('warning-banner').classList.add('hidden');

  setTimeout(() => {
    document.getElementById('rug-flash').classList.add('hidden');
    resolveOutcome({ rugged: true, multiplier: 0 });
  }, 550);
}

function handleSell() {
  const h = state.hold;
  const gameCase = state.currentCase;
  if (!h || h.resolved) return;
  const elapsed = performance.now() - h.startTime;
  const m = computeMultiplier(gameCase, elapsed / 1000);
  stopHoldLoop();
  playCashRegister();
  resolveOutcome({ rugged: false, multiplier: m });
}

function handlePartialSell() {
  const h = state.hold;
  const gameCase = state.currentCase;
  if (!h || h.resolved) return;
  if (h.remainingStake <= 5 || h.partialSellCount >= 3) return;

  const elapsed = performance.now() - h.startTime;
  const m = computeMultiplier(gameCase, elapsed / 1000);
  const chunk = h.remainingStake / 2;
  const profit = chunk * (m - 1);

  h.remainingStake -= chunk;
  h.realizedProfit += profit;
  h.partialSellCount += 1;
  state.bankroll += profit;
  state.bestMultiplierRun = Math.max(state.bestMultiplierRun, m);

  playCashRegister();
  updateHud();
  updateHoldButtons();
  showHoldToast(`✂️ Sold half at ${m.toFixed(2)}x (${profit >= 0 ? '+' : ''}${formatMoney(profit)} banked)`);
}

/* ---------------- Result / progression ---------------- */

function refreshResultButtons() {
  const nextBtn = document.getElementById('btn-next-case');
  const retireBtn = document.getElementById('btn-retire');
  if (state.bankroll <= 0) {
    nextBtn.classList.add('hidden');
    retireBtn.textContent = 'See Case File';
  } else {
    nextBtn.classList.remove('hidden');
    retireBtn.textContent = 'Retire & Bank It';
  }
}

const WIN_HEADLINES = ['CASHED OUT', 'BAGS SECURED', 'LFG!', 'CALLED IT', 'PRINTER GO BRRR'];
const RUG_HEADLINES = ['RUGGED!', 'NGMI', 'REKT', 'GG NO RE', 'LIQUIDITY: GONE'];

const WIN_TAGLINES = [
  'wen lambo?', 'Few understand this.', 'Number go up technology.', 'This is the way.',
  "DYOR? Nah, I vibed.", 'Screenshotting this for the group chat.', 'Not financial advice. Just vibes.',
];

const RUG_TAGLINES = [
  'I told you so.', 'NGMI. It happens to the best of us.', "Should've zoomed out.",
  'This is not financial advice. Clearly.', 'The chart giveth, the chart taketh away.', 'Add it to the list.',
];

function computeAchievementBadge(rugged, multiplier, partialSellCount, totalProfit) {
  const badges = [];
  if (!rugged) {
    if (multiplier >= 6) badges.push('🏎️ Wen Lambo');
    else if (multiplier >= 3) badges.push('💎 Diamond Hands');
    else if (multiplier < 1.2) badges.push('😅 Paper Hands');
    const s = state.lastScanStats;
    if (s && s.botCount > 0 && s.hits === s.botCount && s.falseFlags === 0) badges.push('🎯 Sharp Shooter');
  }
  if (partialSellCount > 0 && totalProfit > 0) badges.push('✂️ Smart Exit');
  return badges.join(' · ');
}

function resolveOutcome({ rugged, multiplier }) {
  CrazyGamesLifecycle.gameplayStop();
  const gameCase = state.currentCase;
  const h = state.hold;
  const remainingStake = h ? h.remainingStake : state.stake;
  const realizedProfit = h ? h.realizedProfit : 0;
  const partialSellCount = h ? h.partialSellCount : 0;

  let legProfit;
  if (rugged) {
    legProfit = -remainingStake;
    state.streak = 0;
  } else {
    legProfit = remainingStake * (multiplier - 1);
    state.casesSolved += 1;
    state.heat += 1;
    state.streak += 1;
    state.bestMultiplierRun = Math.max(state.bestMultiplierRun, multiplier);
  }

  state.bankroll += legProfit;
  const totalProfit = realizedProfit + legProfit;

  const headlineEl = document.getElementById('result-headline');
  headlineEl.textContent = rugged ? choice(RUG_HEADLINES) : choice(WIN_HEADLINES);
  headlineEl.classList.toggle('rugged', rugged);
  headlineEl.classList.toggle('busted', false);

  let detail;
  if (rugged) {
    detail = partialSellCount > 0
      ? `The dev pulled the rug on ${gameCase.coinName} — but you'd already banked ${formatMoney(realizedProfit)} before the rest got rugged.`
      : `The dev pulled the rug on ${gameCase.coinName}. Liquidity: gone. Dignity: gone.`;
  } else {
    detail = partialSellCount > 0
      ? `You sold in ${partialSellCount + 1} chunks, cashing out the rest of ${gameCase.coinName} at ${multiplier.toFixed(2)}x.`
      : `You sold ${gameCase.coinName} at ${multiplier.toFixed(2)}x.`;
  }
  document.getElementById('result-detail').textContent = detail;
  document.getElementById('result-tagline').textContent = choice(rugged ? RUG_TAGLINES : WIN_TAGLINES);

  const pnlEl = document.getElementById('result-pnl');
  pnlEl.textContent = (totalProfit >= 0 ? '+' : '') + formatMoney(totalProfit);
  pnlEl.classList.toggle('negative', totalProfit < 0);

  document.getElementById('result-bankroll').textContent = formatMoney(state.bankroll);

  const badgeEl = document.getElementById('result-badge');
  const badgeText = computeAchievementBadge(rugged, multiplier, partialSellCount, totalProfit);
  badgeEl.textContent = badgeText;
  badgeEl.classList.toggle('hidden', !badgeText);

  const streakEl = document.getElementById('streak-bonus-line');
  if (!rugged && state.streak > 0 && state.streak % 3 === 0) {
    const streakBonus = 50;
    state.bankroll += streakBonus;
    streakEl.textContent = `🔥 Hot Streak x${state.streak}! +${formatMoney(streakBonus)} bonus`;
    streakEl.classList.remove('hidden');
    document.getElementById('result-bankroll').textContent = formatMoney(state.bankroll);
  } else {
    streakEl.classList.add('hidden');
  }

  const secondChanceBtn = document.getElementById('btn-second-chance');
  if (rugged) {
    secondChanceBtn.classList.remove('hidden');
    secondChanceBtn.disabled = false;
    secondChanceBtn.textContent = '📼 Watch Ad: Recover 50%';
  } else {
    secondChanceBtn.classList.add('hidden');
  }

  updateHud();
  maybeSaveHighScore();
  refreshResultButtons();

  showScreen('screen-result');
}

function useSecondChance() {
  const btn = document.getElementById('btn-second-chance');
  btn.disabled = true;
  const h = state.hold;
  const lostStake = h ? h.remainingStake : state.stake;
  const realizedProfit = h ? h.realizedProfit : 0;

  AdService.showRewarded('Second Chance', () => {
    const refund = lostStake * 0.5;
    state.bankroll += refund;

    const newTotal = realizedProfit - lostStake + refund;
    const pnlEl = document.getElementById('result-pnl');
    pnlEl.textContent = (newTotal >= 0 ? '+' : '') + formatMoney(newTotal);
    pnlEl.classList.toggle('negative', newTotal < 0);

    document.getElementById('result-bankroll').textContent = formatMoney(state.bankroll);
    document.getElementById('result-detail').textContent += ' A contact spotted the exit and got you a 50% refund.';
    btn.textContent = 'Recovered';

    updateHud();
    maybeSaveHighScore();
    refreshResultButtons();
  }, () => {
    if (btn.textContent !== 'Recovered') btn.disabled = false;
  });
}

function startNewCase() {
  state.currentCase = generateCase(state.heat);
  updateHud();
  startBriefing(state.currentCase);
}

function goToGameOver() {
  document.getElementById('gameover-cases').textContent = state.casesSolved;
  maybeSaveHighScore();
  recordHallOfFameEntry();
  showScreen('screen-gameover');
}

function goToRetired() {
  document.getElementById('retired-bankroll').textContent = formatMoney(state.bankroll);
  document.getElementById('retired-cases').textContent = state.casesSolved;
  maybeSaveHighScore();
  recordHallOfFameEntry();
  showScreen('screen-retired');
}

function resetRun() {
  state.bankroll = 1000;
  state.heat = 0;
  state.casesSolved = 0;
  state.streak = 0;
  state.adTipUsed = false;
  state.lastScanStats = null;
  state.bestMultiplierRun = 1;
  state.currentCase = null;
  state.scanFlags = new Set();
  document.getElementById('hud').classList.add('hidden');
  renderHighScoreLine();
  showScreen('screen-title');
}

/* ---------------- Easter eggs ---------------- */

let globalToastTimeout = null;
function showGlobalToast(text) {
  const el = document.getElementById('global-toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(globalToastTimeout);
  globalToastTimeout = setTimeout(() => el.classList.add('hidden'), 2200);
}

let easterEggKeyBuffer = '';
function handleEasterEggKeydown(e) {
  if (e.key.length !== 1) return;
  easterEggKeyBuffer = (easterEggKeyBuffer + e.key.toLowerCase()).slice(-10);
  if (easterEggKeyBuffer.endsWith('wagmi')) {
    easterEggKeyBuffer = '';
    ensureAudio();
    playCashRegister();
    showGlobalToast('🙌 WAGMI ENERGY ACTIVATED');
  } else if (easterEggKeyBuffer.endsWith('ngmi')) {
    easterEggKeyBuffer = '';
    ensureAudio();
    playSadTrombone();
    showGlobalToast('📉 NGMI... it happens to the best of us.');
  }
}

let badgeClickTimes = [];
function handleBadgeClick() {
  const now = Date.now();
  badgeClickTimes.push(now);
  badgeClickTimes = badgeClickTimes.filter((t) => now - t < 2000);
  if (badgeClickTimes.length >= 5) {
    badgeClickTimes = [];
    const el = document.getElementById('easter-egg-line');
    el.textContent = "🍜 You found the detective's secret ramen stash. Carry on.";
    el.classList.remove('hidden');
    playFlag();
  }
}

/* ---------------- Wire up events ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  renderHighScoreLine();
  document.addEventListener('keydown', handleEasterEggKeydown);
  document.querySelector('.badge').addEventListener('click', handleBadgeClick);

  document.getElementById('stake-slider').addEventListener('input', (e) => {
    setStake(parseInt(e.target.value, 10) || 1);
  });

  document.querySelectorAll('.stake-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      playClick();
      const pct = parseInt(btn.dataset.pct, 10);
      setStake(Math.round(state.bankroll * pct / 100));
    });
  });

  document.getElementById('btn-sell-half').addEventListener('click', () => {
    handlePartialSell();
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    ensureAudio();
    playClick();
    document.getElementById('hud').classList.remove('hidden');
    state.bankroll = 1000;
    state.heat = 0;
    state.casesSolved = 0;
    startNewCase();
  });

  document.getElementById('btn-begin-scan').addEventListener('click', () => {
    playClick();
    setupScanScreen(state.currentCase);
  });

  document.getElementById('btn-submit-scan').addEventListener('click', () => {
    playClick();
    finishScan();
  });

  document.getElementById('btn-ad-tip').addEventListener('click', () => {
    playClick();
    useAdTip();
  });

  document.getElementById('btn-to-buy').addEventListener('click', () => {
    playClick();
    if (state.bankroll <= 0) {
      goToGameOver();
    } else {
      setupBuyScreen(state.currentCase);
    }
  });

  document.getElementById('btn-buy').addEventListener('click', () => {
    playClick();
    setupHoldScreen(state.currentCase);
  });

  document.getElementById('btn-sell').addEventListener('click', () => {
    handleSell();
  });

  document.getElementById('btn-second-chance').addEventListener('click', () => {
    playClick();
    useSecondChance();
  });

  document.getElementById('btn-next-case').addEventListener('click', () => {
    playClick();
    if (state.bankroll <= 0) {
      goToGameOver();
    } else {
      startNewCase();
    }
  });

  document.getElementById('btn-retire').addEventListener('click', () => {
    playClick();
    if (state.bankroll <= 0) {
      goToGameOver();
    } else {
      goToRetired();
    }
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    playClick();
    resetRun();
  });

  document.getElementById('btn-restart-2').addEventListener('click', () => {
    playClick();
    resetRun();
  });
});
