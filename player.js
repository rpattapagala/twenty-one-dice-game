import { showSetup, showBoard } from "./menu.js";
const fields = document.getElementsByClassName("fieldset")[0];
const values = [""];

export class Player {
    constructor(name, score, turns, wins, isCpu = false) {
        this.name = name;
        this.score = score;
        this.turns = turns;
        this.wins = wins;
        this.isCpu = isCpu;
    }
}

function render() {
    fields.innerHTML = "";

    values.forEach((value, index) => {
        const input = document.createElement("input");
        input.type = "text";
        input.value = value;
        input.placeholder = `Player ${index + 1}`;
        input.setAttribute("aria-label", `Player ${index + 1} name`);

        input.addEventListener("input", (e) => {
            values[index] = e.target.value;
        });

        fields.appendChild(input);
    });
}

const button = document.getElementById("add-player");
button.addEventListener("click", () => {
    values.push("");
    render();
    fields.lastElementChild.focus();
});

const start = document.getElementById("start");
const turnLimit = document.getElementById("turn-limit");
const customTurnLimit = document.getElementById("custom-turn-limit");
turnLimit.addEventListener("change", () => {
    const custom = turnLimit.value === "custom";
    document.getElementById("custom-time-setting").hidden = !custom;
    customTurnLimit.disabled = !custom;
});
start.addEventListener("click", () => {
    if (turnLimit.value === "custom" && !customTurnLimit.reportValidity()) return;
    const seconds = Number(turnLimit.value === "custom" ? customTurnLimit.value : turnLimit.value);
    const players = values.map((value, index) => {
        const trimmedValue = value.trim();
        return trimmedValue || `Player ${index + 1}`;
    });

    showBoard(players, seconds);
    document.getElementById('online-panel').hidden = true;
    document.getElementById('button2').focus();
});


render();
showSetup();


