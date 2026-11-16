// The DOM HUD: crosshair, hit marker, health, ammo, money, round, timer,
// bomb status, kill feed and the buy menu. It never touches the simulation;
// main.js pushes numbers in and reads callbacks out.
const COPY = {
  start: { title: 'TIDEBREAK', copy: 'Night Docks — Tidebreakers attack, Dockwatch defends. Plant the spike at A or B, or wipe the enemy team. Click to play.', action: 'Click to play' },
  paused: { title: 'TIDEBREAK', copy: 'Paused. Click to resume.', action: 'Click to resume' },
  buy: { title: 'Buy phase', copy: 'Spend your money — 1 Rifle, 2 SMG, 3 Shotgun, 4 Sniper, 5 Frag. Then click to deploy.', action: 'Deploy' },
  round: { title: 'Round over', copy: '', action: 'Next round' },
  match: { title: 'Match over', copy: '', action: 'Play again' },
};

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const title = $('overlay-title');
  const copy = $('overlay-copy');
  const play = $('play');
  const ammo = $('ammo');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const health = $('health-value');
  const healthBar = $('health-bar');
  const money = $('money-value');
  const timer = $('timer-value');
  const score = $('score-value');
  const round = $('round-value');
  const weaponName = $('weapon-name');
  const bombStatus = $('bomb-status');
  const feed = $('feed');
  const hitmarker = $('hitmarker');
  const crosshair = $('crosshair');
  const damage = $('damage');
  const dmgNumber = $('dmg-number');
  const plantBar = $('plant-bar');
  const plantWrap = $('plant-wrap');
  const buy = $('buy');
  const modeLabel = $('mode-label');
  const modeNight = $('mode-night');
  const modeDay = $('mode-day');
  const modeRainOn = $('mode-rain-on');
  const modeRainOff = $('mode-rain-off');
  let currentMode = { time: 'night', rain: true };
  let hitTimer = 0;
  let dmgTimer = 0;
  let dmgNumTimer = 0;
  let last = {};

  function setText(el, key, value) {
    if (last[key] === value) return;
    last[key] = value;
    el.textContent = value;
  }

  return {
    setAmmo(mag, reserve) { setText(ammoMag, 'mag', String(mag)); setText(ammoReserve, 'res', `/ ${reserve}`); ammo.classList.toggle('empty', mag === 0); },
    setHealth(hp) {
      setText(health, 'hp', String(Math.max(0, Math.round(hp))));
      healthBar.style.width = `${Math.max(0, hp)}%`;
      healthBar.classList.toggle('low', hp <= 30);
    },
    setMoney(v) { setText(money, 'money', `$${v}`); },
    setTimer(s) { setText(timer, 'timer', `${Math.max(0, Math.ceil(s))}`); timer.classList.toggle('urgent', s <= 10); },
    setScore(v, c) { setText(score, 'score', `${v} — ${c}`); },
    setRound(r) { setText(round, 'round', `ROUND ${r}`); },
    setWeapon(name) { setText(weaponName, 'wpn', name); },
    setBomb(text, cls) { setText(bombStatus, 'bomb', text); bombStatus.className = cls || ''; },
    setCrosshair(spread) { crosshair.style.setProperty('--gap', `${4 + spread * 400}px`); },
    setAiming(aiming) { crosshair.classList.toggle('aiming', aiming); },
    // Mode readout in the top bar: "NIGHT • RAIN" / "DAY • CLEAR" etc.
    setMode(text) { setText(modeLabel, 'mode', text); },
    // Highlight the active mode buttons on the start screen.
    setModeButtons(m) {
      currentMode = { ...m };
      modeNight.classList.toggle('active', m.time === 'night');
      modeDay.classList.toggle('active', m.time === 'day');
      modeRainOn.classList.toggle('active', m.rain);
      modeRainOff.classList.toggle('active', !m.rain);
    },
    // The start-screen selector calls back with the new mode; main.js
    // applies it live (no reload) and echoes it back via setModeButtons.
    onModeChange(handler) {
      modeNight.addEventListener('click', () => handler({ ...currentMode, time: 'night' }));
      modeDay.addEventListener('click', () => handler({ ...currentMode, time: 'day' }));
      modeRainOn.addEventListener('click', () => handler({ ...currentMode, rain: true }));
      modeRainOff.addEventListener('click', () => handler({ ...currentMode, rain: false }));
    },
    // Floating damage number beside the crosshair: the exact damage of the
    // last hit, in amber, red on a kill.
    showDamage(dmg, killed) {
      dmgNumber.textContent = `−${dmg}`;
      dmgNumber.classList.toggle('kill', killed);
      dmgNumber.style.left = `${50 + (Math.random() * 6 - 3)}%`;
      dmgNumber.style.top = `${46 + (Math.random() * 4 - 2)}%`;
      dmgNumber.classList.add('on');
      clearTimeout(dmgNumTimer);
      dmgNumTimer = setTimeout(() => dmgNumber.classList.remove('on'), 420);
    },
    // Team-coloured kill line: killer in their team colour, victim in
    // theirs, a skull and "HEADSHOT" when it was one.
    feedKill(killer, victim, killerTeam, victimTeam, headshot) {
      const line = document.createElement('div');
      const kc = killerTeam === 'vanguard' ? 'var(--teal)' : 'var(--ember)';
      const vc = victimTeam === 'vanguard' ? 'var(--teal)' : 'var(--ember)';
      line.innerHTML = `<b style="color:${kc}">${killer}</b> ☠ <b style="color:${vc}">${victim}</b>${headshot ? ' <span style="color:var(--accent)">HEADSHOT</span>' : ''}`;
      feed.prepend(line);
      while (feed.children.length > 4) feed.removeChild(feed.lastChild);
      setTimeout(() => line.remove(), 6000);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => { hitmarker.classList.remove('on'); hitmarker.style.transform = ''; }, holdMs);
    },
    hurt() {
      damage.classList.add('on');
      clearTimeout(dmgTimer);
      dmgTimer = setTimeout(() => damage.classList.remove('on'), 220);
    },
    feedLine(text) {
      const line = document.createElement('div');
      line.textContent = text;
      feed.prepend(line);
      while (feed.children.length > 4) feed.removeChild(feed.lastChild);
      setTimeout(() => line.remove(), 6000);
    },
    setPlant(frac, label) {
      if (frac == null) { plantWrap.hidden = true; return; }
      plantWrap.hidden = false;
      plantBar.style.width = `${Math.round(frac * 100)}%`;
      $('plant-label').textContent = label;
    },
    showBuy(moneyVal, items) {
      buy.hidden = false;
      $('buy-money').textContent = `$${moneyVal}`;
      const list = $('buy-list');
      list.innerHTML = '';
      for (const item of items) {
        const li = document.createElement('li');
        li.innerHTML = `<kbd>${item.key}</kbd> <b>${item.name}</b> <span>$${item.price}</span>${item.owned ? ' — owned' : ''}`;
        list.appendChild(li);
      }
    },
    hideBuy() { buy.hidden = true; },
    showOverlay(mode, detail) {
      const text = COPY[mode];
      title.textContent = text.title;
      copy.textContent = detail ?? text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() { overlay.hidden = true; },
    onPlay(handler) { play.addEventListener('click', handler); },
  };
}
