import {newGame} from "./dice.js";

const localPanel = document.getElementById("local-panel");
const board = document.getElementsByClassName("board")[0];
let playerList = [];

export function showSetup() {
    localPanel.hidden = false;
    board.hidden = true;
}

export function showBoard(values, turnSeconds = 30) {
    localPanel.hidden = true;
    board.hidden = false;
    playerList = values.slice();
    newGame(turnSeconds);
}

export function getPlayerList() {
    return playerList;
}
