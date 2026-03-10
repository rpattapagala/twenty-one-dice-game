import { getPlayerList } from "./menu.js";
import { Player } from "./player.js";

const players = [];
let currentPlayerIndex = 0;
let roundLimit = 3;
let roundStarted = false;

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
    const statusBoard = document.getElementById("status-board");
    const badges = players
        .map((player, index) => {
            const activeClass = index === currentPlayerIndex ? " is-active" : "";
            return `
                <div class="player-badge${activeClass}">
                    <div class="player-badge__name">${player.name}</div>
                    <div class="player-badge__stats">
                        <span class="player-chip">${player.wins} Wins</span>
                        <span class="player-chip">${player.turns} Turn</span>
                        <span class="player-chip">${player.score} Score</span>
                    </div>
                </div>
            `;
        })
        .join("");

    document.body.style.backgroundColor = "#14213d";
    statusBoard.innerHTML = `${prefix ? `<div class="status-message">${prefix}</div>` : ""}${badges}`;
}

function startNextRound(startingPlayerIndex = 0) {
    players.forEach((player) => {
        player.score = 0;
        player.turns = 0;
    });

    roundLimit = 3;
    currentPlayerIndex = startingPlayerIndex;
    roundStarted = true;
    renderStatus();
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
    renderStatus(`Round winner: ${winnerNames}.`);
    startNextRound(players.indexOf(winners[0]));
}

function advanceTurn() {
    if (players.every((player) => player.turns >= roundLimit)) {
        finishRound();
        return;
    }

    let nextIndex = currentPlayerIndex;

    while (players[nextIndex].turns >= roundLimit) {
        nextIndex = (nextIndex + 1) % players.length;
    }

    currentPlayerIndex = nextIndex;
    renderStatus();
}

function completeTurn(rolledScore) {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) {
        return;
    }

    currentPlayer.score = rolledScore;
    currentPlayer.turns += 1;
    advanceTurn();
}

export function newGame() {
    const playerNames = getPlayerList();
    if (!roundStarted) {
        players.length = 0;
        playerNames.forEach((name) => {
            players.push(new Player(name, 0, 0, 0));
        });
    }

    if (players.length === 0) {
        return;
    }

    setDieImage(document.querySelectorAll("img")[0], 6);
    setDieImage(document.querySelectorAll("img")[1], 6);
    startNextRound(0);
}

function rollLeftDie() {
    const image1 = document.querySelectorAll("img")[0];
    const image2 = document.querySelectorAll("img")[1];
    const leftDie = getRandomDieValue();
    const rightDie = getDieValue(image2);

    setDieImage(image1, leftDie);
    setDiceLabel(leftDie, rightDie);
    completeTurn(getScoreFromDice(leftDie, rightDie));
}

function rollBothDice() {
    const image1 = document.querySelectorAll("img")[0];
    const image2 = document.querySelectorAll("img")[1];
    const leftDie = getRandomDieValue();
    const rightDie = getRandomDieValue();

    setDieImage(image1, leftDie);
    setDieImage(image2, rightDie);
    setDiceLabel(leftDie, rightDie);
    completeTurn(getScoreFromDice(leftDie, rightDie));
}

function rollRightDie() {
    const image1 = document.querySelectorAll("img")[0];
    const image2 = document.querySelectorAll("img")[1];
    const leftDie = getDieValue(image1);
    const rightDie = getRandomDieValue();

    setDieImage(image2, rightDie);
    setDiceLabel(leftDie, rightDie);
    completeTurn(getScoreFromDice(leftDie, rightDie));
}

function endTurnEarly() {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) {
        return;
    }

    roundLimit = Math.min(roundLimit, Math.max(currentPlayer.turns, 1));
    advanceTurn();
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

document.getElementById("button1").addEventListener("click", rollLeftDie);
document.getElementById("button2").addEventListener("click", rollBothDice);
document.getElementById("button3").addEventListener("click", rollRightDie);
document.getElementById("button4").addEventListener("click", endTurnEarly);
