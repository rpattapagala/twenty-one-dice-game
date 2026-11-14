# twenty-one-dice-game

![img.png](images/img.png)

The objective of the game is to score the highest roll in a set of a maximum of three rolls.

Start with one player to play against an automatic CPU opponent. Add more players to play together locally without a CPU. The CPU follows the same roll limit, and controls are disabled during its turn.

Before starting, choose a turn time limit of 15 seconds, 30 seconds (default), or a custom whole number from 1 to 3600 seconds. The countdown resets for each player, including the CPU. When time expires, the turn ends with the current score. A roll already in progress finishes first; if no rolls were made, both dice roll automatically before the turn ends.

At round end, the timer stops and the results stay visible. Click **Next Round** to begin again, with the winner leading.

## The turn order
The turn starts with a round leader, they will roll the dice separately or both for a maximum of three rolls, after those rolls the turn will advance. 

The number of rolls used by the first person in the round determines the number of rolls that other players can use.

The player with the highest score at the end of the round wins the round

## Dice Scoring
In scoring, the higher number always goes first, a `[3][5]` is actually a scored `[5][3]` because the five can be placed before the three. 

Doubles are 100s, `[4][4] = [400]` 

The special roll is `[2][1]` which counts as the highest roll.

