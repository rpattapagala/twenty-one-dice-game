import { getPlayerList } from "./menu.js";
import { Player } from "./player.js";

const players = [];
let currentPlayerIndex = 0;
let currentTurnRolls = 0;
let roundRollLimit = 3;
let cpuTimer = null;
let rollTimer = null;
let faceTimer = null;
let isRolling = false;
let turnSeconds = 30;
let turnTimer = null;
let turnDeadline = 0;
let turnExpired = false;
let roundOver = false;
let nextRoundLeader = 0;

function startTurnTimer() {
    clearInterval(turnTimer);
    turnExpired = false;
    turnDeadline = Date.now() + turnSeconds * 1000;
    turnTimer = setInterval(updateTurnTimer, 50);
    updateTurnTimer();
}

function updateTurnTimer() {
    if (roundOver) return;
    const remaining = Math.max(0, turnDeadline - Date.now());
    const timer = document.getElementById("turn-timer");
    timer.textContent = `${(remaining / 1000).toFixed(1)}s remaining`;
    timer.classList.toggle("is-urgent", remaining <= 1000);
    if (remaining > 0 || turnExpired) return;

    turnExpired = true;
    clearInterval(turnTimer);
    clearTimeout(cpuTimer);
    if (isRolling) return; // Finish the roll already in progress before ending the turn.
    if (currentTurnRolls === 0) rollBothDice();
    else endCurrentTurn();
}

function takeCpuTurn() {
    const player = getCurrentPlayer();
    updateTurnTimer();
    if (roundOver || !player?.isCpu || turnExpired || player !== getCurrentPlayer()) return;

    if (currentTurnRolls === 0) {
        rollBothDice();
        return;
    }

    const opponents = players.filter((opponent) => opponent !== player && opponent.turns > 0);
    const beatsOpponents = opponents.length > 0 && opponents.every((opponent) =>
        opponent.score !== 21 && player.score > opponent.score);
    if (beatsOpponents || (opponents.length === 0 && player.score >= 100)) {
        endCurrentTurn();
        return;
    }

    const images = document.querySelectorAll("img");
    const left = getDieValue(images[0]);
    const right = getDieValue(images[1]);
    if (left === right) rollBothDice();
    else if (left < right) rollLeftDie();
    else rollRightDie();
}

function getRandomDieValue() {
    return Math.floor(Math.random() * 6) + 1;
}

function getDieValue(image) {
    const match = image.getAttribute("src").match(/dice(\d)\.png$/);
    return match ? Number(match[1]) : 6;
}

function setDieImage(image, value) {
    image.setAttribute("src", `./images/dice${value}.png`);
}

function getCurrentPlayer() {
    return players[currentPlayerIndex] ?? null;
}

function getScoreFromDice(leftDie, rightDie) {
    if (leftDie === rightDie) {
        return leftDie * 100;
    }

    return Math.max(leftDie, rightDie) * 10 + Math.min(leftDie, rightDie);
}

function renderStatus(prefix = "") {
    clearTimeout(cpuTimer);
    const cpuTurn = Boolean(getCurrentPlayer()?.isCpu);
    ["button1", "button2", "button3", "button4"].forEach((id) => {
        document.getElementById(id).disabled = roundOver || cpuTurn || isRolling;
    });
    const statusBoard = document.getElementById("status-board");
    const badges = players
        .map((player, index) => {
            const activeClass = index === currentPlayerIndex ? " is-active" : "";
            const rollCap = player.turns === 0 ? roundRollLimit : player.turns;
            const rollLabel = index === currentPlayerIndex ? `${currentTurnRolls}/${rollCap} Rolls` : `${player.turns} Rolls`;
            return `
                <div class="player-badge${activeClass}">
                    <div class="player-badge__name">${player.name}</div>
                    <div class="player-badge__stats">
                        <span class="player-chip">${player.wins} Wins</span>
                        <span class="player-chip">${rollLabel}</span>
                        <span class="player-chip">${player.score} Score</span>
                    </div>
                </div>
            `;
        })
        .join("");

    document.body.style.backgroundColor = "#14213d";
    statusBoard.innerHTML = `${prefix ? `<div class="status-message">${prefix}</div>` : ""}${badges}`;
    if (!roundOver && cpuTurn && !isRolling && !turnExpired) cpuTimer = setTimeout(takeCpuTurn, 800);
}

function startNextRound(startingPlayerIndex = 0, message = "") {
    roundOver = false;
    document.getElementById("next-round").hidden = true;
    players.forEach((player) => {
        player.score = 0;
        player.turns = 0;
    });

    currentPlayerIndex = startingPlayerIndex;
    currentTurnRolls = 0;
    roundRollLimit = 3;
    startTurnTimer();
    renderStatus(message);
}

function finishRound() {
    const maxScore = Math.max(...players.map((player) => player.score));
    const twentyOne = players.filter((player) => player.score === 21);
    let winners = players.filter((player) => player.score === maxScore);
    if(twentyOne.length > 0) {
        winners = twentyOne;
    }

    winners.forEach((player) => {
        player.wins += 1;
    });

    const winnerNames = winners.map((player) => player.name).join(", ");
    roundOver = true;
    nextRoundLeader = players.indexOf(winners[0]);
    clearInterval(turnTimer);
    clearTimeout(cpuTimer);
    const timer = document.getElementById("turn-timer");
    timer.textContent = "Round complete";
    timer.classList.remove("is-urgent");
    document.getElementById("next-round").hidden = false;
    renderStatus(`Round winner: ${winnerNames}.`);
}

function advanceTurn() {
    if (players.every((player) => player.turns > 0)) {
        finishRound();
        return;
    }

    let nextIndex = (currentPlayerIndex + 1) % players.length;

    while (players[nextIndex].turns > 0) {
        nextIndex = (nextIndex + 1) % players.length;
    }

    currentPlayerIndex = nextIndex;
    currentTurnRolls = 0;
    startTurnTimer();
    renderStatus();
}

function recordRoll(rolledScore) {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) {
        return;
    }

    currentPlayer.score = rolledScore;
    currentTurnRolls += 1;

    const reachedRollLimit = currentTurnRolls >= roundRollLimit;

    if (rolledScore === 21 || reachedRollLimit || turnExpired || Date.now() >= turnDeadline) {
        endCurrentTurn();
        return;
    }

    renderStatus();
}

function endCurrentTurn() {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer || currentTurnRolls === 0) {
        return;
    }

    currentPlayer.turns = currentTurnRolls;
    if (players.filter((player) => player.turns > 0).length === 1) {
        roundRollLimit = currentTurnRolls;
    }

    advanceTurn();
}

export function newGame(seconds = 30) {
    clearInterval(turnTimer);
    turnSeconds = Number.isFinite(seconds) && seconds >= 1 && seconds <= 3600 ? seconds : 30;
    clearTimeout(cpuTimer);
    clearTimeout(rollTimer);
    clearInterval(faceTimer);
    isRolling = false;
    document.querySelectorAll("img").forEach((image) => image.classList.remove("is-rolling"));
    const playerNames = getPlayerList();
    players.length = 0;
    playerNames.forEach((name) => {
        players.push(new Player(name, 0, 0, 0));
    });
    if (players.length === 1) {
        players.push(new Player("CPU", 0, 0, 0, true));
    }

    if (players.length === 0) {
        return;
    }

    setDieImage(document.querySelectorAll("img")[0], 6);
    setDieImage(document.querySelectorAll("img")[1], 6);
    startNextRound(0);
}

function isFirstTurn() {
    return currentTurnRolls === 0;
}

function rollDice(indices) {
    if (roundOver || isRolling || !getCurrentPlayer()) return;
    if (indices.length === 1 && isFirstTurn()) return;

    const images = document.querySelectorAll("img");
    isRolling = true;
    renderStatus();
    indices.forEach((index) => images[index].classList.add("is-rolling"));
    faceTimer = setInterval(() => {
        indices.forEach((index) => setDieImage(images[index], getRandomDieValue()));
    }, 80);

    rollTimer = setTimeout(() => {
        clearInterval(faceTimer);
        indices.forEach((index) => {
            images[index].classList.remove("is-rolling");
            setDieImage(images[index], getRandomDieValue());
        });
        isRolling = false;
        const leftDie = getDieValue(images[0]);
        const rightDie = getDieValue(images[1]);
        setDiceLabel(leftDie, rightDie);
        recordRoll(getScoreFromDice(leftDie, rightDie));
    }, 560);
}

function rollLeftDie() {
    rollDice([0]);
}

function rollBothDice() {
    rollDice([0, 1]);
}

function rollRightDie() {
    rollDice([1]);
}

function endTurnEarly() {
    endCurrentTurn();
}

function setDiceLabel(leftDie, rightDie) {
    const score = getScoreFromDice(leftDie, rightDie);
    if(score !== 21) {
        document.querySelector("h1").innerHTML = String(score);
    }
    else {
        document.querySelector("h1").innerHTML = "Twenty One!";
    }
}

for (const [id, action] of Object.entries({
    button1: rollLeftDie,
    button2: rollBothDice,
    button3: rollRightDie,
    button4: endTurnEarly,
})) {
    document.getElementById(id).addEventListener("click", () => {
        if (roundOver) return;
        const player = getCurrentPlayer();
        if (Date.now() >= turnDeadline) {
            updateTurnTimer();
            return;
        }
        if (!isRolling && !turnExpired && player && !player.isCpu) action();
    });
}

document.getElementById("next-round").addEventListener("click", () => {
    if (roundOver) startNextRound(nextRoundLeader);
});
