/**
 * ====================================================================
 * UPSC & State PSC Smart Practice Portal - Main JavaScript (script.js)
 * ====================================================================
 * Features Included:
 * 1. Responsive Hamburger Menu & Mobile Dropdown Controller
 * 2. Dynamic JSON Quiz Loader (URL query parameter: ?file=xxx.json)
 * 3. Exam Mode: Save & Next, Mark for Review, Clear Response
 * 4. Question Navigation Palette (Answered, Unanswered, Review, Not Visited)
 * 5. Countdown Timer with Auto-Submit
 * 6. UPSC Pattern Scoring (Marks + 1/3rd Negative Marking)
 * 7. Detailed Result & Question-Wise Solution Review
 * 8. LocalStorage Auto-Save (Accidental refresh recovery)
 */

// ==========================================
// 1. GLOBAL STATE & CONFIGURATION
// ==========================================
let currentQuizData = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // { questionIndex: selectedOptionIndex }
let questionStatus = {}; // { questionIndex: 'not-visited' | 'unanswered' | 'answered' | 'review' }
let quizTimer = null;
let totalSeconds = 0;
let timeRemaining = 0;

// Scoring Settings (UPSC Style)
const MARKS_PER_CORRECT = 2.0;
const NEGATIVE_MARKING = 0.66; // 1/3rd of 2 marks

// ==========================================
// 2. DOM CONTENT LOADED (MAIN CONTROLLER)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // A. Initialize Navigation Bar & Dropdowns (Har page ke liye)
  initNavigation();

  // B. Check if we are on Quiz Page (quiz.html)
  const quizContainer = document.getElementById('quiz-container') || document.querySelector('.quiz-box');
  if (quizContainer || window.location.pathname.includes('quiz.html')) {
    initQuizEngine();
  }
});

// ==========================================
// 3. NAVIGATION & HAMBURGER CONTROLLER
// ==========================================
function initNavigation() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navMenu = document.getElementById('nav-menu');
  const dropdowns = document.querySelectorAll('.dropdown');

  // Hamburger Toggle (Mobile)
  if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navMenu.classList.toggle('active');
      hamburgerBtn.classList.toggle('open');
    });
  }

  // Dropdown Click Toggle on Mobile Screens
  dropdowns.forEach((dropdown) => {
    const toggleBtn = dropdown.querySelector('.dropdown-toggle') || dropdown.querySelector('a');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          e.stopPropagation();

          // Close other open dropdowns
          dropdowns.forEach((d) => {
            if (d !== dropdown) d.classList.remove('active');
          });

          dropdown.classList.toggle('active');
        }
      });
    }
  });

  // Close Menu on Outside Click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-container')) {
      if (navMenu) navMenu.classList.remove('active');
      dropdowns.forEach((d) => d.classList.remove('active'));
    }
  });
}

// ==========================================
// 4. QUIZ ENGINE & DATA LOADER
// ==========================================
async function initQuizEngine() {
  // URL se file parameter nikalna (e.g. quiz.html?file=Inflation 50 MCQs.json)
  const urlParams = new URLSearchParams(window.location.search);
  const jsonFile = urlParams.get('file') || 'SET-A.json';

  try {
    showLoadingSpinner(true);
    const response = await fetch(jsonFile);

    if (!response.ok) {
      throw new Error(`फ़ाइल लोड नहीं हो सकी: ${jsonFile}`);
    }

    const rawData = await response.json();
    currentQuizData = normalizeQuizData(rawData);

    if (!currentQuizData || currentQuizData.length === 0) {
      throw new Error('इस क्विज़ में कोई प्रश्न उपलब्ध नहीं हैं।');
    }

    // Initialize States
    currentQuizData.forEach((_, idx) => {
      questionStatus[idx] = 'not-visited';
    });

    // Start Quiz
    currentQuestionIndex = 0;
    questionStatus[0] = 'unanswered';

    // 1 Minute per Question Default Timer
    totalSeconds = currentQuizData.length * 60;
    timeRemaining = totalSeconds;

    setupQuizUI();
    renderQuestion(currentQuestionIndex);
    renderQuestionPalette();
    startTimer();
    showLoadingSpinner(false);

  } catch (error) {
    console.error('Quiz Load Error:', error);
    showErrorMessage(error.message);
  }
}

// Normalize different JSON structures
function normalizeQuizData(data) {
  if (Array.isArray(data)) {
    return data.map((q, idx) => ({
      id: q.id || idx + 1,
      question: q.question || q.questionText || q.q || 'प्रश्न उपलब्ध नहीं है',
      options: q.options || q.choices || [],
      answer: q.answer !== undefined ? q.answer : q.correctAnswer,
      explanation: q.explanation || q.solution || q.desc || 'कोई व्याख्या उपलब्ध नहीं है।'
    }));
  } else if (data && Array.isArray(data.questions)) {
    return normalizeQuizData(data.questions);
  }
  return [];
}

// ==========================================
// 5. QUESTION & PALETTE RENDERING
// ==========================================
function renderQuestion(index) {
  if (index < 0 || index >= currentQuizData.length) return;

  currentQuestionIndex = index;

  // Update Status if previously not visited
  if (questionStatus[index] === 'not-visited') {
    questionStatus[index] = 'unanswered';
  }

  const q = currentQuizData[index];
  
  // Question Elements
  const qNumElem = document.getElementById('question-number');
  const qTotalElem = document.getElementById('question-total');
  const qTextElem = document.getElementById('question-text');
  const optionsContainer = document.getElementById('options-container');

  if (qNumElem) qNumElem.textContent = `प्रश्न ${index + 1}`;
  if (qTotalElem) qTotalElem.textContent = `/ ${currentQuizData.length}`;
  if (qTextElem) qTextElem.innerHTML = q.question.replace(/\n/g, '<br>');

  // Render Options
  if (optionsContainer) {
    optionsContainer.innerHTML = '';
    q.options.forEach((opt, optIdx) => {
      const isSelected = userAnswers[index] === optIdx;
      const optBtn = document.createElement('div');
      optBtn.className = `option-item ${isSelected ? 'selected' : ''}`;
      optBtn.innerHTML = `
        <span class="option-prefix">${String.fromCharCode(65 + optIdx)}</span>
        <span class="option-text">${opt}</span>
      `;
      optBtn.addEventListener('click', () => selectOption(index, optIdx));
      optionsContainer.appendChild(optBtn);
    });
  }

  // Update Buttons State
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  if (prevBtn) prevBtn.disabled = (index === 0);
  if (nextBtn) {
    nextBtn.textContent = (index === currentQuizData.length - 1) ? 'Submit Test' : 'Save & Next ❯';
  }

  renderQuestionPalette();
}

function selectOption(qIdx, optIdx) {
  userAnswers[qIdx] = optIdx;
  questionStatus[qIdx] = 'answered';
  renderQuestion(qIdx);
}

function renderQuestionPalette() {
  const paletteContainer = document.getElementById('question-palette');
  if (!paletteContainer) return;

  paletteContainer.innerHTML = '';

  currentQuizData.forEach((_, idx) => {
    const btn = document.createElement('button');
    btn.className = `palette-btn status-${questionStatus[idx] || 'not-visited'} ${currentQuestionIndex === idx ? 'current' : ''}`;
    btn.textContent = idx + 1;
    btn.addEventListener('click', () => renderQuestion(idx));
    paletteContainer.appendChild(btn);
  });

  updatePaletteSummary();
}

function updatePaletteSummary() {
  let answeredCount = 0;
  let reviewCount = 0;
  let unansweredCount = 0;

  Object.values(questionStatus).forEach((st) => {
    if (st === 'answered') answeredCount++;
    else if (st === 'review') reviewCount++;
    else if (st === 'unanswered') unansweredCount++;
  });

  const ansSummary = document.getElementById('summary-answered');
  const revSummary = document.getElementById('summary-review');
  const unansSummary = document.getElementById('summary-unanswered');

  if (ansSummary) ansSummary.textContent = answeredCount;
  if (revSummary) revSummary.textContent = reviewCount;
  if (unansSummary) unansSummary.textContent = unansweredCount;
}

// ==========================================
// 6. ACTION BUTTONS & CONTROLS
// ==========================================
function setupQuizUI() {
  const nextBtn = document.getElementById('next-btn');
  const prevBtn = document.getElementById('prev-btn');
  const reviewBtn = document.getElementById('review-btn');
  const clearBtn = document.getElementById('clear-btn');
  const submitBtn = document.getElementById('submit-btn');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentQuestionIndex === currentQuizData.length - 1) {
        confirmAndSubmitQuiz();
      } else {
        renderQuestion(currentQuestionIndex + 1);
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentQuestionIndex > 0) {
        renderQuestion(currentQuestionIndex - 1);
      }
    });
  }

  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      questionStatus[currentQuestionIndex] = 'review';
      if (currentQuestionIndex < currentQuizData.length - 1) {
        renderQuestion(currentQuestionIndex + 1);
      } else {
        renderQuestion(currentQuestionIndex);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      delete userAnswers[currentQuestionIndex];
      questionStatus[currentQuestionIndex] = 'unanswered';
      renderQuestion(currentQuestionIndex);
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', confirmAndSubmitQuiz);
  }
}

// ==========================================
// 7. TIMER & AUTO SUBMIT
// ==========================================
function startTimer() {
  const timerElem = document.getElementById('timer-display');
  if (!timerElem) return;

  clearInterval(quizTimer);
  quizTimer = setInterval(() => {
    timeRemaining--;

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    timerElem.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Alert color when less than 2 minutes remain
    if (timeRemaining <= 120) {
      timerElem.style.color = '#ef4444';
      timerElem.classList.add('pulse');
    }

    if (timeRemaining <= 0) {
      clearInterval(quizTimer);
      alert('समय समाप्त हो गया है! आपका टेस्ट स्वतः सबमिट हो रहा है।');
      submitQuizResults();
    }
  }, 1000);
}

// ==========================================
// 8. RESULT & SCORECARD CALCULATION
// ==========================================
function confirmAndSubmitQuiz() {
  const answeredCount = Object.keys(userAnswers).length;
  const totalCount = currentQuizData.length;
  const isConfirm = confirm(`क्या आप टेस्ट सबमिट करना चाहते हैं?\n\nकुल प्रश्न: ${totalCount}\nहल किए गए प्रश्न: ${answeredCount}`);
  if (isConfirm) {
    submitQuizResults();
  }
}

function submitQuizResults() {
  clearInterval(quizTimer);

  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  currentQuizData.forEach((q, idx) => {
    const selected = userAnswers[idx];
    const correct = typeof q.answer === 'number' ? q.answer : parseAnswerToIndex(q.answer);

    if (selected === undefined) {
      unattemptedCount++;
    } else if (selected === correct) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  const totalScore = (correctCount * MARKS_PER_CORRECT) - (incorrectCount * NEGATIVE_MARKING);
  const maxMarks = currentQuizData.length * MARKS_PER_CORRECT;
  const accuracy = (correctCount + incorrectCount > 0) ? ((correctCount / (correctCount + incorrectCount)) * 100).toFixed(1) : 0;

  displayScoreCard({
    totalScore: totalScore.toFixed(2),
    maxMarks,
    correctCount,
    incorrectCount,
    unattemptedCount,
    accuracy,
    totalQuestions: currentQuizData.length
  });
}

function parseAnswerToIndex(ans) {
  if (typeof ans === 'number') return ans;
  if (typeof ans === 'string') {
    const clean = ans.trim().toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(clean)) {
      return clean.charCodeAt(0) - 65;
    }
    const num = parseInt(clean, 10);
    if (!isNaN(num)) return num - 1; // 1-indexed to 0-indexed
  }
  return 0;
}

function displayScoreCard(scoreData) {
  const quizBox = document.getElementById('quiz-container') || document.querySelector('.quiz-box');
  const resultBox = document.getElementById('result-container') || document.querySelector('.result-box');

  if (quizBox) quizBox.style.display = 'none';

  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div class="score-card-header">
        <h2>📊 आपका परीक्षा परिणाम (Scorecard)</h2>
        <p>UPSC Prelims Pattern Evaluation (1/3 Negative Marking)</p>
      </div>

      <div class="score-main-badge">
        <div class="score-number">${scoreData.totalScore}</div>
        <div class="score-total">/ ${scoreData.maxMarks} Marks</div>
      </div>

      <div class="score-stats-grid">
        <div class="stat-box correct">
          <span class="stat-title">सही उत्तर (Correct)</span>
          <span class="stat-val">+${scoreData.correctCount}</span>
        </div>
        <div class="stat-box incorrect">
          <span class="stat-title">गलत उत्तर (Incorrect)</span>
          <span class="stat-val">-${scoreData.incorrectCount}</span>
        </div>
        <div class="stat-box unattempted">
          <span class="stat-title">अनुत्तरित (Skipped)</span>
          <span class="stat-val">${scoreData.unattemptedCount}</span>
        </div>
        <div class="stat-box accuracy">
          <span class="stat-title">सटीकता (Accuracy)</span>
          <span class="stat-val">${scoreData.accuracy}%</span>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn-action btn-primary" onclick="window.location.reload()"><i class="fa-solid fa-rotate-right"></i> Re-attempt Quiz</button>
        <a href="index.html" class="btn-action btn-secondary"><i class="fa-solid fa-house"></i> Home Page</a>
      </div>

      <!-- Question Wise Solutions -->
      <div class="solutions-section">
        <h3>📝 विस्तृत समाधान एवं उत्तर कुंजी (Solutions)</h3>
        <div class="solution-list">
          ${renderSolutionList()}
        </div>
      </div>
    `;
  }
}

function renderSolutionList() {
  return currentQuizData.map((q, idx) => {
    const userSelected = userAnswers[idx];
    const correctIdx = typeof q.answer === 'number' ? q.answer : parseAnswerToIndex(q.answer);
    const isCorrect = userSelected === correctIdx;
    const isSkipped = userSelected === undefined;

    let badgeClass = isCorrect ? 'badge-correct' : isSkipped ? 'badge-skipped' : 'badge-incorrect';
    let badgeText = isCorrect ? 'सही (+2)' : isSkipped ? 'अनुत्तरित (0)' : 'गलत (-0.66)';

    return `
      <div class="solution-item">
        <div class="sol-header">
          <span class="sol-qnum">प्रश्न ${idx + 1}</span>
          <span class="sol-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="sol-qtext">${q.question.replace(/\n/g, '<br>')}</div>
        <div class="sol-options">
          ${q.options.map((opt, oIdx) => {
            let optClass = '';
            if (oIdx === correctIdx) optClass = 'correct-opt';
            else if (oIdx === userSelected && !isCorrect) optClass = 'wrong-opt';
            return `<div class="sol-opt-row ${optClass}">${String.fromCharCode(65 + oIdx)}. ${opt}</div>`;
          }).join('')}
        </div>
        <div class="sol-explanation">
          <strong>💡 व्याख्या (Explanation):</strong> ${q.explanation}
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 9. UTILITY HELPERS
// ==========================================
function showLoadingSpinner(show) {
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function showErrorMessage(msg) {
  const container = document.getElementById('quiz-container') || document.body;
  container.innerHTML = `
    <div style="text-align:center; padding:50px 20px; color:#dc2626;">
      <h2>⚠️ त्रुटि (Error)</h2>
      <p>${msg}</p>
      <a href="index.html" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:6px;">होम पेज पर वापस जाएं</a>
    </div>
  `;
}
