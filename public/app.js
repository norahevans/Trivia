const socket = io();

// DOM Elements
const screens = {
  playerSelect: document.getElementById('playerSelect'),
  lobby: document.getElementById('lobby'),
  questionScreen: document.getElementById('questionScreen'),
  judgingScreen: document.getElementById('judgingScreen'),
  resultsScreen: document.getElementById('resultsScreen')
};

// State
let currentPlayer = null;
let isJudge = false;
let gameState = null;
let selectedCorrectGroups = new Set();
let currentFilter = 'available';

// Player selection
const playerButtonsContainer = document.getElementById('playerButtons');
const judgeBtn = document.getElementById('judgeBtn');

judgeBtn.addEventListener('click', () => {
  const password = prompt('Enter the judge password:');
  if (password) {
    socket.emit('becomeJudge', password);
  }
});

// Handle judge authentication result
socket.on('judgeAuthResult', (result) => {
  if (result.success) {
    isJudge = true;
  } else {
    alert(result.message || 'Wrong password!');
  }
});

// Lobby elements
const lobbyTitle = document.getElementById('lobbyTitle');
const playerList = document.getElementById('playerList');
const judgeControls = document.getElementById('judgeControls');
const waitingMsg = document.getElementById('waitingMsg');
const questionSubmitLobby = document.getElementById('questionSubmitLobby');

// Question submission - set up all forms
document.querySelectorAll('.submit-question-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const input = this.parentElement.querySelector('.new-question-input');
    submitQuestion(input);
  });
});

document.querySelectorAll('.new-question-input').forEach(input => {
  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      submitQuestion(this);
    }
  });
});

function submitQuestion(inputElement) {
  const text = inputElement.value.trim();
  if (text) {
    socket.emit('submitQuestion', text);
    inputElement.value = '';
    // Show brief feedback
    const btn = inputElement.parentElement.querySelector('.submit-question-btn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Added!';
    btn.style.background = 'var(--success)';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 1500);
  }
}

// Question filters
const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderQuestionList();
  });
});

// Question list
const questionList = document.getElementById('questionList');
const availableCount = document.getElementById('availableCount');
const usedCount = document.getElementById('usedCount');
const allCount = document.getElementById('allCount');

// Judge actions
const resetScoresBtn = document.getElementById('resetScoresBtn');
const fullResetBtn = document.getElementById('fullResetBtn');

resetScoresBtn.addEventListener('click', () => {
  if (confirm('Reset all scores to 0? Questions will remain.')) {
    socket.emit('resetScores');
  }
});

fullResetBtn.addEventListener('click', () => {
  if (confirm('This will reset ALL scores AND restore default questions. Custom questions will be deleted. Continue?')) {
    socket.emit('fullReset');
  }
});

// Question screen elements
const questionNumber = document.getElementById('questionNumber');
const questionBy = document.getElementById('questionBy');
const questionText = document.getElementById('questionText');
const answerSection = document.getElementById('answerSection');
const answerInput = document.getElementById('answerInput');
const submitAnswerBtn = document.getElementById('submitAnswer');
const judgeQuestionView = document.getElementById('judgeQuestionView');
const answeredList = document.getElementById('answeredList');
const forceJudgeBtn = document.getElementById('forceJudgeBtn');
const waitingForOthers = document.getElementById('waitingForOthers');
const waitingList = document.getElementById('waitingList');

submitAnswerBtn.addEventListener('click', submitAnswer);
answerInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') submitAnswer();
});

forceJudgeBtn.addEventListener('click', () => {
  socket.emit('forceJudging');
});

function submitAnswer() {
  const answer = answerInput.value.trim();
  if (answer) {
    socket.emit('submitAnswer', answer);
    answerInput.value = '';
    submitAnswerBtn.disabled = true;
  }
}

// Judging screen elements
const questionReminder = document.getElementById('questionReminder');
const answerGroups = document.getElementById('answerGroups');
const judgeButtons = document.getElementById('judgeButtons');
const confirmJudgmentBtn = document.getElementById('confirmJudgment');
const playerJudgingView = document.getElementById('playerJudgingView');

confirmJudgmentBtn.addEventListener('click', () => {
  socket.emit('judgeAnswers', Array.from(selectedCorrectGroups));
});

// Results screen elements
const roundResults = document.getElementById('roundResults');
const scoresFull = document.getElementById('scoresFull');
const judgeResultControls = document.getElementById('judgeResultControls');
const playerResultWait = document.getElementById('playerResultWait');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');

nextQuestionBtn.addEventListener('click', () => {
  socket.emit('returnToLobby');
});

// Mini scoreboard
const scoresMini = document.getElementById('scoresMini');
const questionsAnsweredEl = document.getElementById('questionsAnswered');

// Socket event handlers
socket.on('gameState', (state) => {
  gameState = state;
  updateUI();
});

function updateUI() {
  if (!gameState) return;

  // Check if we're the judge
  isJudge = socket.id === gameState.judge;
  
  // Check if we're a player
  currentPlayer = gameState.players[socket.id] || null;

  // Update player selection buttons
  updatePlayerButtons();

  // Show appropriate screen
  if (!currentPlayer && !isJudge) {
    showScreen('playerSelect');
  } else if (gameState.phase === 'lobby') {
    showScreen('lobby');
    updateLobby();
  } else if (gameState.phase === 'answering') {
    showScreen('questionScreen');
    updateQuestionScreen();
  } else if (gameState.phase === 'judging') {
    showScreen('judgingScreen');
    updateJudgingScreen();
  } else if (gameState.phase === 'results') {
    showScreen('resultsScreen');
    updateResultsScreen();
  }

  // Update mini scoreboard
  updateMiniScoreboard();
}

function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

function updatePlayerButtons() {
  playerButtonsContainer.innerHTML = '';
  
  const takenPlayers = Object.values(gameState.players);
  const availablePlayers = gameState.availablePlayers || [];
  const allNames = [...new Set([...takenPlayers, ...availablePlayers])];
  
  allNames.sort();
  
  allNames.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'player-btn';
    btn.textContent = name;
    
    if (takenPlayers.includes(name)) {
      btn.classList.add('taken');
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => {
        socket.emit('selectPlayer', name);
        currentPlayer = name;
      });
    }
    
    playerButtonsContainer.appendChild(btn);
  });
}

function updateLobby() {
  const players = Object.values(gameState.players);
  
  lobbyTitle.textContent = isJudge 
    ? `You are the Judge! (${players.length} player${players.length !== 1 ? 's' : ''} joined)`
    : `Welcome, ${currentPlayer}!`;

  // Show player tags
  playerList.innerHTML = '';
  
  if (gameState.judge) {
    const judgeTag = document.createElement('span');
    judgeTag.className = 'player-tag judge-tag';
    judgeTag.textContent = '🧑‍⚖️ Judge';
    playerList.appendChild(judgeTag);
  }
  
  players.forEach(name => {
    const tag = document.createElement('span');
    tag.className = 'player-tag';
    tag.textContent = name;
    playerList.appendChild(tag);
  });

  // Update question counts
  const available = gameState.questions.filter(q => !q.used).length;
  const used = gameState.questions.filter(q => q.used).length;
  availableCount.textContent = available;
  usedCount.textContent = used;
  allCount.textContent = gameState.questions.length;

  // Show/hide controls based on role
  if (isJudge) {
    judgeControls.classList.remove('hidden');
    waitingMsg.classList.add('hidden');
    questionSubmitLobby.classList.add('hidden'); // Judge can't submit questions
    renderQuestionList();
  } else {
    judgeControls.classList.add('hidden');
    questionSubmitLobby.classList.remove('hidden'); // Players can submit questions
    waitingMsg.classList.remove('hidden');
  }
}

function renderQuestionList() {
  let questions = gameState.questions;
  
  if (currentFilter === 'available') {
    questions = questions.filter(q => !q.used);
  } else if (currentFilter === 'used') {
    questions = questions.filter(q => q.used);
  }

  questionList.innerHTML = '';

  if (questions.length === 0) {
    questionList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>No ${currentFilter === 'available' ? 'available' : currentFilter === 'used' ? 'used' : ''} questions yet.</p>
        <p>Players can submit questions!</p>
      </div>
    `;
    return;
  }

  questions.forEach(q => {
    const item = document.createElement('div');
    item.className = `question-item ${q.used ? 'used' : ''}`;
    
    item.innerHTML = `
      <div class="question-item-content">
        <div class="question-item-text">${escapeHtml(q.text)}</div>
        <div class="question-item-meta">Submitted by: ${escapeHtml(q.submittedBy)}</div>
      </div>
      <div class="question-item-actions">
        ${!q.used ? `<button class="question-action-btn select" data-id="${q.id}">Ask This!</button>` : ''}
        ${q.used ? `<button class="question-action-btn reset" data-id="${q.id}">Reset</button>` : ''}
        <button class="question-action-btn delete" data-id="${q.id}">🗑️</button>
      </div>
    `;
    
    questionList.appendChild(item);
  });

  // Add event listeners
  questionList.querySelectorAll('.question-action-btn.select').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('selectQuestion', parseInt(btn.dataset.id));
    });
  });

  questionList.querySelectorAll('.question-action-btn.reset').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('resetQuestion', parseInt(btn.dataset.id));
    });
  });

  questionList.querySelectorAll('.question-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this question?')) {
        socket.emit('deleteQuestion', parseInt(btn.dataset.id));
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateQuestionScreen() {
  const q = gameState.currentQuestion;
  
  // Safety check - make sure we have a valid question object
  if (!q || typeof q !== 'object') {
    console.error('Invalid question:', q);
    questionNumber.textContent = 'Question';
    questionBy.textContent = '';
    questionText.textContent = 'Loading question...';
    return;
  }
  
  questionNumber.textContent = `Question #${gameState.questionsAnswered + 1}`;
  questionBy.textContent = q.submittedBy ? `Submitted by: ${q.submittedBy}` : '';
  questionText.textContent = q.text || 'No question text';

  const hasAnswered = gameState.answers[currentPlayer] !== undefined;
  const players = Object.values(gameState.players);
  const answeredPlayers = Object.keys(gameState.answers);
  const waitingPlayers = players.filter(p => !answeredPlayers.includes(p));

  if (isJudge) {
    // Judge view
    answerSection.classList.add('hidden');
    waitingForOthers.classList.add('hidden');
    judgeQuestionView.classList.remove('hidden');

    answeredList.innerHTML = '';
    answeredPlayers.forEach(name => {
      const tag = document.createElement('span');
      tag.className = 'answered-tag';
      tag.textContent = `✓ ${name}`;
      answeredList.appendChild(tag);
    });
    
    waitingPlayers.forEach(name => {
      const tag = document.createElement('span');
      tag.className = 'waiting-tag';
      tag.textContent = name;
      answeredList.appendChild(tag);
    });

    forceJudgeBtn.style.display = answeredPlayers.length > 0 ? 'inline-block' : 'none';
  } else {
    // Player view
    judgeQuestionView.classList.add('hidden');
    
    if (hasAnswered) {
      answerSection.classList.add('hidden');
      waitingForOthers.classList.remove('hidden');
      
      waitingList.innerHTML = '';
      waitingPlayers.forEach(name => {
        const tag = document.createElement('span');
        tag.className = 'waiting-tag';
        tag.textContent = name;
        waitingList.appendChild(tag);
      });
    } else {
      answerSection.classList.remove('hidden');
      waitingForOthers.classList.add('hidden');
      submitAnswerBtn.disabled = false;
    }
  }
}

function updateJudgingScreen() {
  const q = gameState.currentQuestion;
  questionReminder.textContent = (q && q.text) ? q.text : 'Question';
  selectedCorrectGroups.clear();

  answerGroups.innerHTML = '';
  
  const groups = Object.entries(gameState.groupedAnswers);
  
  groups.forEach(([answer, players]) => {
    const group = document.createElement('div');
    group.className = 'answer-group';
    group.dataset.answer = answer;
    
    group.innerHTML = `
      <div class="answer-content">
        <span class="answer-text">"${escapeHtml(answer)}"</span>
        <div class="answer-players">
          ${players.map(p => `<span class="answer-player-tag">${escapeHtml(p)}</span>`).join('')}
        </div>
      </div>
      <span class="correct-indicator">❌</span>
    `;
    
    if (isJudge) {
      group.addEventListener('click', () => {
        group.classList.toggle('correct');
        group.classList.toggle('incorrect', !group.classList.contains('correct'));
        const indicator = group.querySelector('.correct-indicator');
        
        if (group.classList.contains('correct')) {
          selectedCorrectGroups.add(answer);
          indicator.textContent = '✅';
        } else {
          selectedCorrectGroups.delete(answer);
          indicator.textContent = '❌';
        }
      });
      group.classList.add('incorrect');
    }
    
    answerGroups.appendChild(group);
  });

  if (isJudge) {
    judgeButtons.classList.remove('hidden');
    playerJudgingView.classList.add('hidden');
  } else {
    judgeButtons.classList.add('hidden');
    playerJudgingView.classList.remove('hidden');
  }
}

function updateResultsScreen() {
  // Show round results
  roundResults.innerHTML = '<h4>This Round</h4>';

  // Find which answers were marked correct
  const correctAnswersSet = new Set();
  document.querySelectorAll('.answer-group.correct').forEach(el => {
    correctAnswersSet.add(el.dataset.answer);
  });

  Object.entries(gameState.answers).forEach(([player, answer]) => {
    const normalizedAnswer = answer.toLowerCase().trim();
    const wasCorrect = correctAnswersSet.has(normalizedAnswer);
    
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <span class="result-player">${escapeHtml(player)}</span>
      <span class="result-answer">"${escapeHtml(answer)}"</span>
      <span class="result-points ${wasCorrect ? 'correct' : 'incorrect'}">
        ${wasCorrect ? '+1' : '0'}
      </span>
    `;
    roundResults.appendChild(item);
  });

  // Update full scoreboard
  updateFullScoreboard(scoresFull);

  // Show controls based on role
  if (isJudge) {
    judgeResultControls.classList.remove('hidden');
    playerResultWait.classList.add('hidden');
  } else {
    judgeResultControls.classList.add('hidden');
    playerResultWait.classList.remove('hidden');
  }
}

function updateMiniScoreboard() {
  questionsAnsweredEl.textContent = gameState.questionsAnswered;
  
  const scores = Object.entries(gameState.scores)
    .filter(([name, score]) => score > 0 || Object.values(gameState.players).includes(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  scoresMini.innerHTML = '';
  scores.forEach(([name, score]) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    row.innerHTML = `
      <span class="score-name">${escapeHtml(name)}</span>
      <span class="score-value">${score}</span>
    `;
    scoresMini.appendChild(row);
  });

  if (scores.length === 0) {
    scoresMini.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No scores yet</p>';
  }
}

function updateFullScoreboard(container) {
  const scores = Object.entries(gameState.scores)
    .filter(([name, score]) => score > 0 || Object.values(gameState.players).includes(name))
    .sort((a, b) => b[1] - a[1]);

  container.innerHTML = '';
  scores.forEach(([name, score]) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    row.innerHTML = `
      <span class="score-name">${escapeHtml(name)}</span>
      <span class="score-value">${score}</span>
    `;
    container.appendChild(row);
  });

  if (scores.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No scores yet</p>';
  }
}
