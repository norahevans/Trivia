const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Disable caching for development
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static('public'));

// Player names - customize these for your family!
const PLAYER_NAMES = [
  'Norah', 'Erin', 'Opa', 'Oma', 'Jeff',
  'Liz', 'Amanda', 'Bill', 'Ren',
  'Lilah', 'AJ', 'Silas', 'Georgia'
];

// Default questions
const defaultQuestions = require('./questions.json');

// ============ STORAGE LAYER ============
// Uses Upstash Redis if configured, otherwise falls back to local file

let redis = null;
const SAVE_FILE = path.join(__dirname, 'gamedata.json');
const REDIS_KEY = 'trivia_game_state';

// Check if Upstash Redis is configured
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const { Redis } = require('@upstash/redis');
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log('☁️  Using Upstash Redis for persistent storage');
} else {
  console.log('📁 Using local file for storage (gamedata.json)');
}

// Load game state
async function loadGameState() {
  try {
    if (redis) {
      // Load from Redis
      const saved = await redis.get(REDIS_KEY);
      if (saved) {
        console.log('📂 Loaded saved game state from Redis');
        return saved;
      }
    } else {
      // Load from file
      if (fs.existsSync(SAVE_FILE)) {
        const data = fs.readFileSync(SAVE_FILE, 'utf8');
        const saved = JSON.parse(data);
        console.log('📂 Loaded saved game state from file');
        return saved;
      }
    }
  } catch (err) {
    console.error('Error loading save:', err);
  }
  
  // Return default state
  return getDefaultState();
}

function getDefaultState() {
  const scores = {};
  PLAYER_NAMES.forEach(name => {
    scores[name] = 0;
  });
  
  return {
    scores: scores,
    questions: defaultQuestions.map((q, i) => ({ id: i, text: q, used: false, submittedBy: 'Default' })),
    nextQuestionId: defaultQuestions.length,
    questionsAnswered: 0
  };
}

// Save game state
async function saveGameState() {
  try {
    const saveData = {
      scores: gameState.scores,
      questions: gameState.questions,
      nextQuestionId: gameState.nextQuestionId,
      questionsAnswered: gameState.questionsAnswered
    };
    
    if (redis) {
      // Save to Redis
      await redis.set(REDIS_KEY, saveData);
      console.log('💾 Game state saved to Redis');
    } else {
      // Save to file
      fs.writeFileSync(SAVE_FILE, JSON.stringify(saveData, null, 2));
      console.log('💾 Game state saved to file');
    }
  } catch (err) {
    console.error('Error saving game state:', err);
  }
}

// ============ GAME STATE ============

let gameState = {
  players: {},
  judge: null,
  currentQuestion: null,
  answers: {},
  groupedAnswers: {},
  scores: {},
  phase: 'lobby',
  questions: [],
  nextQuestionId: 0,
  questionsAnswered: 0
};

// Initialize game state from storage
async function initializeGame() {
  const saved = await loadGameState();
  
  // Merge saved data with session defaults
  gameState = {
    players: {},
    judge: null,
    currentQuestion: null,
    answers: {},
    groupedAnswers: {},
    phase: 'lobby',
    // These come from saved data
    scores: saved.scores || getDefaultState().scores,
    questions: saved.questions || getDefaultState().questions,
    nextQuestionId: saved.nextQuestionId || defaultQuestions.length,
    questionsAnswered: saved.questionsAnswered || 0
  };
  
  console.log(`📊 ${gameState.questions.filter(q => !q.used).length} questions available, ${gameState.questionsAnswered} answered so far`);
}

// ============ SOCKET HANDLERS ============

io.on('connection', (socket) => {
  console.log('A user connected');
  
  // Send current game state to new connection
  socket.emit('gameState', getClientState());

  // Player selects their name
  socket.on('selectPlayer', (playerName) => {
    if (PLAYER_NAMES.includes(playerName) && !Object.values(gameState.players).includes(playerName) && playerName !== gameState.judge) {
      gameState.players[socket.id] = playerName;
      broadcastState();
    }
  });

  // Player becomes judge
  socket.on('becomeJudge', () => {
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
    }
    gameState.judge = socket.id;
    broadcastState();
  });

  // Anyone can submit a question
  socket.on('submitQuestion', (questionText) => {
    const submitterName = gameState.players[socket.id] || (socket.id === gameState.judge ? 'Judge' : 'Anonymous');
    const question = {
      id: gameState.nextQuestionId++,
      text: questionText.trim(),
      used: false,
      submittedBy: submitterName
    };
    gameState.questions.push(question);
    saveGameState();
    broadcastState();
  });

  // Judge selects a question to ask
  socket.on('selectQuestion', (questionId) => {
    if (socket.id === gameState.judge) {
      const question = gameState.questions.find(q => q.id === questionId);
      if (question && !question.used) {
        question.used = true;
        gameState.currentQuestion = {
          id: question.id,
          text: question.text,
          submittedBy: question.submittedBy,
          used: question.used
        };
        gameState.answers = {};
        gameState.groupedAnswers = {};
        gameState.phase = 'answering';
        console.log('Selected question:', gameState.currentQuestion);
        saveGameState();
        broadcastState();
      }
    }
  });

  // Player submits an answer
  socket.on('submitAnswer', (answer) => {
    const playerName = gameState.players[socket.id];
    if (playerName && gameState.phase === 'answering') {
      gameState.answers[playerName] = answer.trim();
      broadcastState();
      
      // Check if all players have answered
      const activePlayers = Object.values(gameState.players);
      const answeredPlayers = Object.keys(gameState.answers);
      if (activePlayers.every(p => answeredPlayers.includes(p))) {
        groupAnswers();
        gameState.phase = 'judging';
        broadcastState();
      }
    }
  });

  // Judge forces move to judging phase
  socket.on('forceJudging', () => {
    if (socket.id === gameState.judge && gameState.phase === 'answering') {
      groupAnswers();
      gameState.phase = 'judging';
      broadcastState();
    }
  });

  // Judge marks answer groups as correct/incorrect
  socket.on('judgeAnswers', (correctGroups) => {
    if (socket.id === gameState.judge && gameState.phase === 'judging') {
      correctGroups.forEach(groupKey => {
        const players = gameState.groupedAnswers[groupKey];
        if (players) {
          players.forEach(playerName => {
            gameState.scores[playerName] = (gameState.scores[playerName] || 0) + 1;
          });
        }
      });
      gameState.questionsAnswered++;
      gameState.phase = 'results';
      saveGameState();
      broadcastState();
    }
  });

  // Return to lobby (to pick next question)
  socket.on('returnToLobby', () => {
    if (socket.id === gameState.judge) {
      gameState.currentQuestion = null;
      gameState.answers = {};
      gameState.groupedAnswers = {};
      gameState.phase = 'lobby';
      broadcastState();
    }
  });

  // Reset scores only
  socket.on('resetScores', () => {
    if (socket.id === gameState.judge) {
      PLAYER_NAMES.forEach(name => {
        gameState.scores[name] = 0;
      });
      gameState.questionsAnswered = 0;
      saveGameState();
      broadcastState();
    }
  });

  // Full reset including questions
  socket.on('fullReset', () => {
    if (socket.id === gameState.judge) {
      PLAYER_NAMES.forEach(name => {
        gameState.scores[name] = 0;
      });
      gameState.questions = defaultQuestions.map((q, i) => ({ id: i, text: q, used: false, submittedBy: 'Default' }));
      gameState.nextQuestionId = defaultQuestions.length;
      gameState.questionsAnswered = 0;
      gameState.currentQuestion = null;
      gameState.answers = {};
      gameState.groupedAnswers = {};
      gameState.phase = 'lobby';
      saveGameState();
      broadcastState();
    }
  });

  // Mark question as unused (so it can be asked again)
  socket.on('resetQuestion', (questionId) => {
    if (socket.id === gameState.judge) {
      const question = gameState.questions.find(q => q.id === questionId);
      if (question) {
        question.used = false;
        saveGameState();
        broadcastState();
      }
    }
  });

  // Delete a question
  socket.on('deleteQuestion', (questionId) => {
    if (socket.id === gameState.judge) {
      gameState.questions = gameState.questions.filter(q => q.id !== questionId);
      saveGameState();
      broadcastState();
    }
  });

  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
    }
    if (gameState.judge === socket.id) {
      gameState.judge = null;
    }
    broadcastState();
  });
});

function groupAnswers() {
  gameState.groupedAnswers = {};
  Object.entries(gameState.answers).forEach(([player, answer]) => {
    const normalizedAnswer = answer.toLowerCase().trim();
    if (!gameState.groupedAnswers[normalizedAnswer]) {
      gameState.groupedAnswers[normalizedAnswer] = [];
    }
    gameState.groupedAnswers[normalizedAnswer].push(player);
  });
}

function getClientState() {
  return {
    players: gameState.players,
    judge: gameState.judge,
    currentQuestion: gameState.currentQuestion,
    answers: gameState.answers,
    groupedAnswers: gameState.groupedAnswers,
    scores: gameState.scores,
    phase: gameState.phase,
    questions: gameState.questions,
    questionsAnswered: gameState.questionsAnswered,
    availablePlayers: PLAYER_NAMES.filter(name => !Object.values(gameState.players).includes(name))
  };
}

function broadcastState() {
  io.emit('gameState', getClientState());
}

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

// Initialize then start
initializeGame().then(() => {
  server.listen(PORT, () => {
    console.log(`🎮 Trivia server running on port ${PORT}`);
  });
});
