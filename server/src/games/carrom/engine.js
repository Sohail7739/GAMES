import { GameEngine } from '../../engine/GameEngine.js';

// Board geometry (centimetres). Half-extent of the playable square.
const H = 37;
const R = 1.6; // coin radius
const SR = 2.1; // striker radius
const POCKET_R = 2.6;
const FRICTION = 0.985;
const WALL_RESTITUTION = 0.82;
const DT = 1 / 120;
const MAX_SPEED = 220;

function pockets() {
  const c = [H, -H];
  return [
    { x: H, y: H },
    { x: H, y: -H },
    { x: -H, y: H },
    { x: -H, y: -H },
    { x: 0, y: H },
    { x: 0, y: -H },
    { x: H, y: 0 },
    { x: -H, y: 0 },
  ];
}

export class CarromEngine extends GameEngine {
  static meta = {
    code: 'carrom',
    name: 'Carrom',
    nameAr: 'كاروم',
    category: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    defaultConfig: {
      coinsPerPlayer: 9,
      queenBonus: 3,
      strikerLimit: 20,
    },
  };

  onStart() {
    const n = this.players.length;
    this.teams = n === 2 ? [[this.players[0].seat], [this.players[1].seat]] : [[this.players[0].seat, this.players[2].seat], [this.players[1].seat, this.players[3].seat]];
    this.teamOfSeat = {};
    this.players.forEach((p, i) => {
      this.teamOfSeat[p.seat] = i < 2 ? 0 : 1;
    });
    this.coins = {
      white: this.spawnCoins('white', this.config.coinsPerPlayer),
      black: this.spawnCoins('black', this.config.coinsPerPlayer),
      queen: { id: 'queen', color: 'red', x: 0, y: 0, pocketed: false, pockets: 0 },
    };
    this.striker = { x: 0, y: -30, vx: 0, vy: 0 };
    this.currentTeam = 0;
    this.shooter = this.teams[0][0];
    this.phase = 'aim';
    this.shots = { 0: 0, 1: 0 };
    this.lastShot = null;
    this.foul = false;
    this.queenCovered = false;
    this.queenHolder = null;
    this.strikerPocketed = false;
    this.winner = null;
    this.setCurrent(this.shooter);
  }

  spawnCoins(color, count) {
    const ring = 10;
    const inner = 5;
    const arr = [];
    for (let i = 0; i < count; i++) {
      const idx = i;
      const r = idx < count / 2 ? ring : inner;
      const angle = ((idx % Math.ceil(count / 2)) / Math.ceil(count / 2)) * Math.PI * 2 + (idx >= count / 2 ? Math.PI / Math.ceil(count / 2) : 0);
      arr.push({
        id: `${color}-${i}`,
        color,
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        pocketed: false,
        pocketId: null,
      });
    }
    return arr;
  }

  allBodies() {
    const bodies = [{ id: 'striker', x: this.striker.x, y: this.striker.y, vx: this.striker.vx, vy: this.striker.vy, r: SR, kind: 'striker' }];
    for (const c of [...this.coins.white, ...this.coins.black]) {
      if (!c.pocketed) bodies.push({ id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, r: R, kind: 'coin', coin: c });
    }
    if (!this.coins.queen.pocketed) {
      const q = this.coins.queen;
      bodies.push({ id: 'queen', x: q.x, y: q.y, vx: q.vx, vy: q.vy, r: R, kind: 'queen', coin: q });
    }
    return bodies;
  }

  teamColor(team) {
    return team === 0 ? 'white' : 'black';
  }

  teamRemaining(team) {
    const color = this.teamColor(team);
    return this.coins[color].filter((c) => !c.pocketed).length;
  }

  validateAction(playerId, action) {
    const seat = this.playerById(playerId)?.seat;
    if (seat === undefined) return 'Not a player';
    if (this.status !== 'running') return 'Match not running';
    if (this.phase !== 'aim') return 'Shot already in progress';
    if (seat !== this.shooter) return 'Not your shot';
    if (action.type !== 'shoot') return 'Invalid action';
    if (this.shots[this.currentTeam] >= this.config.strikerLimit) return 'Striker limit reached';
    const { power, angle } = action;
    if (power < 0.05 || power > 1) return 'Power out of range';
    if (typeof angle !== 'number') return 'Angle required';
    return null;
  }

  onAction(playerId, action) {
    const seat = this.playerById(playerId).seat;
    this.phase = 'simulating';
    this.shots[this.currentTeam] += 1;
    const speed = MAX_SPEED * action.power;
    this.striker.vx = Math.cos(action.angle) * speed;
    this.striker.vy = Math.sin(action.angle) * speed;
    const sim = this.simulate();
    this.phase = 'aim';

    const pocketedCoins = sim.pocketed;
    const ownColor = this.teamColor(this.currentTeam);
    const own = pocketedCoins.filter((c) => c.color === ownColor).length;
    const opp = pocketedCoins.filter((c) => c.color !== ownColor && c.color !== 'red').length;
    const queenPocketed = pocketedCoins.some((c) => c.color === 'red');
    const strikerIn = sim.strikerIn;

    this.foul = strikerIn;
    let keepTurn = false;

    // Queen handling
    if (queenPocketed) {
      if (own > 0 || opp > 0) {
        // "covered" if a coin was pocketed with it — attribute to the shooter's team
        this.coins.queen.pocketed = true;
        this.queenCovered = true;
        this.queenHolder = this.currentTeam;
      } else {
        // queen not covered: return to center
        const q = this.coins.queen;
        q.pocketed = false;
        q.x = 0;
        q.y = 0;
        q.vx = 0;
        q.vy = 0;
        this.emit('match:announce', { seat, text: 'Queen returned to center' });
      }
    }

    // Striker pocketed: coins pocketed on this shot are returned to the board
    if (strikerIn) {
      for (const pc of pocketedCoins) {
        const coin = this.coins[pc.color].find((c) => c.id === pc.id) || this.coins.queen;
        coin.pocketed = false;
        coin.x = pc.x; // place near the centre
        coin.y = 0;
        coin.vx = 0;
        coin.vy = 0;
      }
      this.emit('match:announce', { seat, text: 'Foul! Striker pocketed' });
      keepTurn = false;
    } else if (own > 0) {
      keepTurn = true;
      this.emit('match:announce', { seat, text: `Pocketed ${own} own coin${own > 1 ? 's' : ''}` });
    } else if (opp > 0) {
      // opponent coin pocketed: opponent keeps the point, shooter loses turn
      this.emit('match:announce', { seat, text: `Pocketed opponent coin` });
      keepTurn = false;
    } else if (queenPocketed && !this.queenCovered) {
      keepTurn = false;
    }

    this.lastShot = {
      seat,
      power: action.power,
      angle: action.angle,
      pocketed: pocketedCoins.map((c) => ({ id: c.id, color: c.color })),
      strikerIn,
      foul: this.foul,
      trajectory: sim.trajectory,
    };

    // Win check: own coins gone + queen covered
    const ownRemaining = this.teamRemaining(this.currentTeam);
    const winner =
      ownRemaining === 0 && this.queenCovered && this.queenHolder === this.currentTeam ? this.currentTeam : null;

    this.emit('match:shot', {
      seat,
      power: action.power,
      angle: action.angle,
      pocketed: this.lastShot.pocketed,
      strikerIn,
      foul: this.foul,
      queenCovered: this.queenCovered,
      trajectory: sim.trajectory,
    });

    if (winner !== null) {
      this.winner = winner;
      const results = this.players.map((p) => {
        const team = this.teamOfSeat[p.seat];
        const points = this.teamRemaining(team) + (this.queenHolder === team ? this.config.queenBonus : 0);
        return {
          seat: p.seat,
          team,
          score: points,
          result: team === winner ? 'win' : 'loss',
          winner: team === winner,
          stats: { team: this.teamOfSeat[p.seat], remainingCoins: this.teamRemaining(team), queenCovered: this.queenCovered },
        };
      });
      return { finished: true, results };
    }

    if (keepTurn) {
      // next shooter within same team
      this.advanceShooterWithinTeam();
    } else {
      this.currentTeam = 1 - this.currentTeam;
      this.advanceShooterWithinTeam();
    }
    this.emit('match:turn', { seat: this.shooter, team: this.currentTeam });
    return {};
  }

  advanceShooterWithinTeam() {
    const team = this.teams[this.currentTeam];
    const idx = team.indexOf(this.shooter);
    this.shooter = team[(idx + 1) % team.length];
    this.setCurrent(this.shooter);
  }

  simulate() {
    const bodies = this.allBodies();
    const byId = new Map(bodies.map((b) => [b.id, b]));
    const pocketed = [];
    let strikerIn = false;
    const trajectory = [];

    const step = () => {
      // wall collisions
      for (const b of bodies) {
        if (b.coin?.pocketed) continue;
        if (b.kind === 'queen' && this.coins.queen.pocketed) continue;
        if (Math.abs(b.x) > H - b.r) {
          b.x = Math.sign(b.x) * (H - b.r);
          b.vx *= -WALL_RESTITUTION;
        }
        if (Math.abs(b.y) > H - b.r) {
          b.y = Math.sign(b.y) * (H - b.r);
          b.vy *= -WALL_RESTITUTION;
        }
      }
      // coin-coin collisions (equal mass elastic)
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const c = bodies[j];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.r + c.r;
          if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = (minDist - dist) / 2;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            c.x += nx * overlap;
            c.y += ny * overlap;
            const relV = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
            if (relV > 0) {
              const imp = relV;
              a.vx -= imp * nx;
              a.vy -= imp * ny;
              c.vx += imp * nx;
              c.vy += imp * ny;
            }
          }
        }
      }
      // integrate + friction
      for (const b of bodies) {
        if (b.coin?.pocketed) continue;
        if (b.kind === 'queen' && this.coins.queen.pocketed) continue;
        b.x += b.vx * DT;
        b.y += b.vy * DT;
        b.vx *= FRICTION;
        b.vy *= FRICTION;
      }
      // pockets
      for (const pk of pockets()) {
        for (const b of bodies) {
          if (b.kind === 'striker') {
            if (Math.hypot(b.x - pk.x, b.y - pk.y) < POCKET_R) {
              b.x = 0;
              b.y = -30;
              b.vx = 0;
              b.vy = 0;
              strikerIn = true;
            }          } else if (!b.coin?.pocketed) {
            if (Math.hypot(b.x - pk.x, b.y - pk.y) < POCKET_R) {
              b.coin.pocketed = true;
              b.coin.pocketId = pk;
              pocketed.push(b.coin);
            }
          }
        }
      }
    };

    const moving = () => bodies.some((b) => Math.abs(b.vx) + Math.abs(b.vy) > 0.02);
    let steps = 0;
    const MAX_STEPS = 8 * 120;
    let lastSample = 0;
    while (moving() && steps < MAX_STEPS) {
      step();
      steps++;
      if (steps % 8 === 0 || steps > 920) {
        trajectory.push({
          striker: [this.striker.x, this.striker.y],
          coins: bodies.filter((b) => b.kind !== 'striker').map((b) => ({ id: b.coin.id, x: b.coin.x, y: b.coin.y, pocketed: b.coin.pocketed })),
        });
      }
    }

    // copy simulated positions back
    for (const b of bodies) {
      if (b.kind === 'striker') {
        this.striker.x = b.x;
        this.striker.y = b.y;
        this.striker.vx = 0;
        this.striker.vy = 0;
      } else if (!b.coin.pocketed) {
        b.coin.x = b.x;
        b.coin.y = b.y;
        b.coin.vx = 0;
        b.coin.vy = 0;
      }
    }

    return { pocketed, strikerIn, trajectory };
  }

  getState() {
    return {
      phase: this.phase,
      currentTeam: this.currentTeam,
      shooter: this.shooter,
      coins: {
        white: this.coins.white.map((c) => ({ id: c.id, x: c.x, y: c.y, pocketed: c.pocketed })),
        black: this.coins.black.map((c) => ({ id: c.id, x: c.x, y: c.y, pocketed: c.pocketed })),
        queen: { x: this.coins.queen.x, y: this.coins.queen.y, pocketed: this.coins.queen.pocketed },
      },
      striker: { x: this.striker.x, y: this.striker.y },
      scores: {
        white: this.teamRemaining(0),
        black: this.teamRemaining(1),
      },
      queenCovered: this.queenCovered,
      queenHolder: this.queenHolder,
      shots: this.shots,
      strikerLimit: this.config.strikerLimit,
      teams: this.teams,
      foul: this.foul,
      winner: this.winner,
      geometry: { H, R, SR, POCKET_R },
      lastShot: this.lastShot
        ? {
            seat: this.lastShot.seat,
            power: this.lastShot.power,
            angle: this.lastShot.angle,
            pocketed: this.lastShot.pocketed,
            strikerIn: this.lastShot.strikerIn,
            foul: this.lastShot.foul,
            trajectory: this.lastShot.trajectory.slice(0, 240),
          }
        : null,
    };
  }
}
