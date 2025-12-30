# 🎯 Family Trivia Night

A fun, real-time trivia game for your family to play together — even over multiple days!

## Features

- **13 Players** - Everyone picks their name to join
- **Judge Role** - One person acts as the judge to pick questions and score answers
- **Submit Questions** - Anyone can add new trivia questions during the game
- **Choose Questions** - Judge picks which question to ask (not forced to go in order)
- **Persistent Storage** - Scores and questions are saved between sessions
- **Real-time Sync** - All players see the same game state instantly
- **Answer Grouping** - Similar answers are grouped together for easy judging
- **Live Scoreboard** - Track scores throughout the game

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

### 3. Play!

- Open `http://localhost:3000` in your browser
- Share this URL with everyone on the same WiFi network
- One person clicks "I'm the Judge!"
- Everyone else picks their name
- The judge picks questions to ask!

## How to Play

1. **Setup**: One person becomes the Judge, everyone else picks their name
2. **Submit Questions**: Anyone can add questions using the form at any time
3. **Pick a Question**: The Judge browses available questions and picks one to ask
4. **Answers**: Everyone types their answer and submits
5. **Judging**: Once all answers are in, the Judge sees them grouped by similarity
6. **Scoring**: The Judge clicks on correct answer groups, then confirms
7. **Next Round**: Judge picks the next question from the pool
8. **Play Over Days**: Come back tomorrow - scores and questions are saved!

## Playing Over Multiple Days

Your game automatically saves:
- ✅ All player scores
- ✅ All questions (default + submitted)
- ✅ Which questions have been used
- ✅ Total questions answered

Just stop the server when you're done for the day, and start it again tomorrow. Everyone picks their names again, and the Judge can continue right where you left off!

## Customizing

### Player Names

Edit the `PLAYER_NAMES` array in `server.js` to use your family members' actual names:

```javascript
const PLAYER_NAMES = [
  'Mom', 'Dad', 'Grandma', 'Grandpa', 'Uncle Joe',
  'Aunt Mary', 'Cousin Tim', 'Cousin Sarah', 'Brother',
  'Sister', 'Nephew', 'Niece', 'Family Friend'
];
```

### Starting Questions

Edit `questions.json` to customize the starting question pool. These reset when you do a "Full Reset".

## Judge Controls

The Judge has special powers:

- **Pick Questions**: Browse available, used, or all questions
- **Delete Questions**: Remove any question from the pool
- **Reset Questions**: Mark used questions as available again
- **Reset Scores**: Zero out all scores but keep questions
- **Full Reset**: Reset everything to starting state

## Data Storage

Game data is saved to `gamedata.json` in the project folder. This file is automatically created and updated as you play. Delete it to start completely fresh.

## Tips

- Submit fun personal questions about family history!
- The Judge should read questions out loud for more fun
- Answers are case-insensitive when grouped
- The Judge can skip waiting if some players are slow
- Use "Reset Scores" between game nights to keep custom questions

Enjoy your Family Trivia Night! 🎉
