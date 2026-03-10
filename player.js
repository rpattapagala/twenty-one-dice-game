import { showSetup, showBoard } from "./menu.js";
const fields = document.getElementsByClassName("fieldset")[0];
const values = [""];

export class Player {
    constructor(name, score, turns, wins) {
        this.name = name;
        this.score = score;
        this.turns = turns;
        this.wins = wins;
    }
}

function render() {
    fields.innerHTML = "";

    values.forEach((value, index) => {
        const input = document.createElement("input");
        input.type = "text";
        input.value = value;
        input.placeholder = `Player ${index + 1}`;

        input.addEventListener("input", (e) => {
            values[index] = e.target.value;
        });

        fields.appendChild(input);
        fields.appendChild(document.createElement("br"));
        fields.appendChild(document.createElement("br"));
    });
}

const button = document.getElementById("add-player");
button.addEventListener("click", () => {
    values.push("");
    render();
});

const start = document.getElementById("start");
start.addEventListener("click", () => {
    const players = values.map((value, index) => {
        const trimmedValue = value.trim();
        return trimmedValue || `Player ${index + 1}`;
    });

    showBoard(players);
});


render();
showSetup();


