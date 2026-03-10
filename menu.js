import {newGame} from "./dice.js";

const fieldset = document.getElementsByClassName("fieldset")[0];
const menuButtons = document.getElementsByClassName("menu-buttons")[0];
const board = document.getElementsByClassName("board")[0];
let playerList = [];

export function showSetup() {
    fieldset.hidden = false;
    menuButtons.hidden = false;
    board.hidden = true;
}

export function showBoard(values) {
    fieldset.hidden = true;
    menuButtons.hidden = true;
    board.hidden = false;
    playerList = values.slice();
    newGame();
}

export function getPlayerList() {
    return playerList;
}
