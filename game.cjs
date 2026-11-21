const { randomInt } = require('node:crypto');

class Game {
    constructor(players, seconds, changed, random = () => randomInt(1, 7)) {
        this.players = players.map(p => ({ id: p.id, name: p.name, score: 0, turns: 0, wins: 0 }));
        this.seconds = seconds;
        this.changed = changed;
        this.random = random;
        this.current = 0;
        this.dice = [6, 6];
        this.roundOver = false;
        this.rolling = [];
        this.message = '';
        this.nextRound(0);
    }
    snapshot() {
        return { players: this.players, seconds: this.seconds, current: this.current, dice: this.dice,
            roundOver: this.roundOver, rolling: this.rolling, message: this.message,
            rolls: this.rolls, limit: this.limit, deadline: this.deadline };
    }
    nextRound(leader = this.leader) {
        this.players.forEach(p => { p.score = 0; p.turns = 0; });
        this.current = leader;
        this.rolls = 0;
        this.limit = 3;
        this.roundOver = false;
        this.message = '';
        this.startClock();
    }
    startClock() {
        clearTimeout(this.clock);
        this.expired = false;
        this.deadline = Date.now() + this.seconds * 1000;
        this.clock = setTimeout(() => this.expire(), this.seconds * 1000);
    }
    expire() {
        if (this.roundOver) return;
        clearTimeout(this.clock);
        this.expired = true;
        if (this.rolling.length) return;
        if (!this.rolls) this.roll([0, 1]);
        else { this.endTurn(); this.changed(); }
    }
    action(id, action) {
        if (this.roundOver || this.rolling.length || this.players[this.current].id !== id) return false;
        if (Date.now() >= this.deadline) { this.expire(); return false; }
        if (action === 'end') {
            if (!this.rolls) return false;
            this.endTurn(); this.changed(); return true;
        }
        const choices = { left: [0], both: [0, 1], right: [1] };
        const indices = Object.hasOwn(choices, action) ? choices[action] : null;
        if (!indices || (!this.rolls && indices.length === 1)) return false;
        this.roll(indices);
        return true;
    }
    roll(indices) {
        this.rolling = indices;
        this.changed();
        this.rollTimer = setTimeout(() => {
            indices.forEach(i => { this.dice[i] = this.random(); });
            this.rolling = [];
            const [a, b] = this.dice;
            const score = a === b ? a * 100 : Math.max(a, b) * 10 + Math.min(a, b);
            this.players[this.current].score = score;
            this.rolls++;
            if (score === 21 || this.rolls >= this.limit || this.expired || Date.now() >= this.deadline) this.endTurn();
            this.changed();
        }, 560);
    }
    endTurn() {
        this.players[this.current].turns = this.rolls;
        if (this.players.filter(p => p.turns).length === 1) this.limit = this.rolls;
        if (this.players.every(p => p.turns)) {
            clearTimeout(this.clock);
            const rank = p => p.score === 21 ? 1000 : p.score;
            const best = Math.max(...this.players.map(rank));
            const winners = this.players.filter(p => rank(p) === best);
            winners.forEach(p => p.wins++);
            this.leader = this.players.indexOf(winners[0]);
            this.message = `Round winner: ${winners.map(p => p.name).join(', ')}.`;
            this.roundOver = true;
            this.deadline = 0;
        } else {
            do { this.current = (this.current + 1) % this.players.length; } while (this.players[this.current].turns);
            this.rolls = 0;
            this.startClock();
        }
    }
    dispose() { clearTimeout(this.clock); clearTimeout(this.rollTimer); }
}
module.exports = { Game };
