// One state object for the whole match. The simulation reads and writes only
// this; rendering reads it, never the other way round.
export const PHASE = { BUY: 'buy', LIVE: 'live', PLANTED: 'planted', OVER: 'over', MATCH: 'match' };

export function createState() {
  return {
    phase: PHASE.BUY,
    round: 1,
    winsToTake: 5,
    roundTime: 95,
    timeLeft: 95,
    buyTime: 10,
    score: { vanguard: 0, cinder: 0 },
    money: 800,
    kills: 0,
    deaths: 0,
    bomb: { state: 'idle', site: null, plantLeft: 0, defuseLeft: 0, timer: 30, x: 0, z: 0 },
    message: '',
    messageAt: 0,
    elapsed: 0,
    slowmo: 0, // round-end slow motion, seconds remaining
    winner: null,
    matchWinner: null,
  };
}

// Money rules, in one place so the HUD, the buy menu and the round end agree.
export const ECONOMY = {
  start: 800,
  kill: 300,
  roundWin: 325,
  roundLoss: 200,
  plant: 300,
  defuse: 300,
};
