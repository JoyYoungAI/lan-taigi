/**
 * quiz.js - Gamified Taiwanese Practice & Quiz Arena
 * 咱的台語 - Lán ê Tâi-gí
 */

class QuizManager {
  constructor() {
    this.currentMode = 'hanzi_to_tailo';
    this.currentQuestion = null;
    this.score = 0;
    this.streak = 0;
    this.totalAnswered = 0;
    this.vocabPool = [];
    this.mandarinPool = [];
    this.isAnswering = false;

    this.init();
  }

  async init() {
    try {
      // Load pool from lessons & dictionary
      const lResp = await fetch('data/lessons_data.json');
      const lessons = await lResp.json();
      lessons.forEach(l => {
        l.vocab.forEach(v => {
          if (v.hz && v.tl) {
            this.vocabPool.push(v);
          }
        });
      });

      const mResp = await fetch('data/mandarin_comparison.json');
      this.mandarinPool = await mResp.json();

      this.updateStatsDisplay();
    } catch (e) {
      console.warn('Quiz pool load warning:', e);
    }
  }

  setMode(mode, btn) {
    this.currentMode = mode;
    document.querySelectorAll('.quiz-mode-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.nextQuestion();
  }

  nextQuestion() {
    this.isAnswering = false;
    const container = document.getElementById('quiz-card-container');
    if (!container) return;

    if (this.currentMode === 'hanzi_to_tailo') {
      this.generateHanziToTailo();
    } else if (this.currentMode === 'tailo_to_hanzi') {
      this.generateTailoToHanzi();
    } else if (this.currentMode === 'mandarin_to_taiwanese') {
      this.generateMandarinToTaiwanese();
    } else if (this.currentMode === 'tone_quiz') {
      this.generateToneQuiz();
    }
  }

  getRandomItems(pool, count) {
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  // Mode 1: 看字選台羅
  generateHanziToTailo() {
    if (this.vocabPool.length < 4) return;
    const candidates = this.getRandomItems(this.vocabPool, 4);
    const correct = candidates[0];
    const options = [...candidates].sort(() => 0.5 - Math.random());

    this.currentQuestion = {
      type: 'hanzi_to_tailo',
      question: correct.hz,
      correctAnswer: correct.tl,
      correctItem: correct,
      options: options.map(o => o.tl)
    };

    this.renderQuestionCard({
      badge: '看字選台羅',
      prompt: '請問下列詞目的正確臺羅拼音是？',
      questionText: correct.hz,
      audioId: correct.id,
      options: this.currentQuestion.options
    });
  }

  // Mode 2: 看拼音選字
  generateTailoToHanzi() {
    if (this.vocabPool.length < 4) return;
    const candidates = this.getRandomItems(this.vocabPool, 4);
    const correct = candidates[0];
    const options = [...candidates].sort(() => 0.5 - Math.random());

    this.currentQuestion = {
      type: 'tailo_to_hanzi',
      question: correct.tl,
      correctAnswer: correct.hz,
      correctItem: correct,
      options: options.map(o => o.hz)
    };

    this.renderQuestionCard({
      badge: '看拼音選字',
      prompt: '請問下列拼音對應的正確漢字是？',
      questionText: correct.tl,
      subText: correct.def ? `釋義：${correct.def}` : '',
      audioId: correct.id,
      options: this.currentQuestion.options
    });
  }

  // Mode 3: 華台對照選詞
  generateMandarinToTaiwanese() {
    if (this.mandarinPool.length < 4) return;
    const candidates = this.getRandomItems(this.mandarinPool, 4);
    const correct = candidates[0];
    const options = [...candidates].sort(() => 0.5 - Math.random());

    this.currentQuestion = {
      type: 'mandarin_to_taiwanese',
      question: correct[0], // Mandarin
      correctAnswer: correct[2], // Taiwanese Hanzi
      correctItem: { hz: correct[2], tl: correct[3], m: correct[0] },
      options: options.map(o => o[2])
    };

    this.renderQuestionCard({
      badge: '華台對照測驗',
      prompt: '請問華語「' + correct[0] + '」在台語中慣用的說法是？',
      questionText: correct[0],
      options: this.currentQuestion.options
    });
  }

  // Mode 4: 聲調大挑戰
  generateToneQuiz() {
    const toneMap = {
      1: { name: '第1聲 (高平調)', mark: '不標 (a)' },
      2: { name: '第2聲 (高降調)', mark: '尖朝上 (á)' },
      3: { name: '第3聲 (低降調)', mark: '尖朝下 (à)' },
      4: { name: '第4聲 (中入促調)', mark: '結尾 -p, -t, -k, -h' },
      5: { name: '第5聲 (低升調)', mark: '波浪或尖朝下 (â)' },
      7: { name: '第7聲 (中平調)', mark: '橫線 (ā)' },
      8: { name: '第8聲 (高入促調)', mark: '直豎標記 (a̍)' }
    };

    const targetTones = [1, 2, 3, 4, 5, 7, 8];
    const correctTone = targetTones[Math.floor(Math.random() * targetTones.length)];
    
    // Pick 4 options
    const options = [correctTone, ...targetTones.filter(t => t !== correctTone).sort(() => 0.5 - Math.random()).slice(0, 3)].sort();

    this.currentQuestion = {
      type: 'tone_quiz',
      question: `第 ${correctTone} 聲`,
      correctAnswer: toneMap[correctTone].name,
      correctItem: { hz: toneMap[correctTone].name, tl: toneMap[correctTone].mark },
      options: options.map(t => toneMap[t].name)
    };

    this.renderQuestionCard({
      badge: '聲調辨識挑戰',
      prompt: `請辨識台語「第 ${correctTone} 聲」的調值特徵與調型：`,
      questionText: `第 ${correctTone} 聲`,
      options: this.currentQuestion.options,
      isToneQuiz: true,
      toneNum: correctTone
    });
  }

  renderQuestionCard({ badge, prompt, questionText, subText, audioId, options, isToneQuiz, toneNum }) {
    const container = document.getElementById('quiz-card-container');
    if (!container) return;

    container.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-card-header">
          <span class="quiz-badge">${badge}</span>
          <div class="quiz-streak-tag">🔥 連勝: <strong>${this.streak}</strong></div>
        </div>

        <p class="quiz-prompt">${prompt}</p>

        <div class="quiz-target-box">
          <div class="quiz-target-text">${questionText}</div>
          ${subText ? `<div class="quiz-target-sub">${subText}</div>` : ''}
          ${audioId ? `
            <button class="btn btn-outline quiz-audio-btn" onclick="window.audioManager.playWord(${audioId}, '${questionText}', this)">
              <span class="audio-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></span>
              聆聽台語讀音
            </button>
          ` : ''}
          ${isToneQuiz ? `
            <button class="btn btn-outline quiz-audio-btn" onclick="window.toneSynth.playTone(${toneNum})">
              🎵 聆聽該調值滑音
            </button>
          ` : ''}
        </div>

        <div class="quiz-options-grid">
          ${options.map((opt, i) => `
            <button class="quiz-option-btn" onclick="window.quizManager.handleAnswer('${this.escapeHtml(opt)}', this)">
              <span class="opt-index">${['A', 'B', 'C', 'D'][i]}</span>
              <span class="opt-text">${opt}</span>
            </button>
          `).join('')}
        </div>

        <div id="quiz-feedback-box" class="quiz-feedback" style="display:none;"></div>
      </div>
    `;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  handleAnswer(selected, btn) {
    if (this.isAnswering) return;
    this.isAnswering = true;
    this.totalAnswered++;

    const isCorrect = (selected === this.currentQuestion.correctAnswer);
    const feedbackBox = document.getElementById('quiz-feedback-box');
    const allBtns = document.querySelectorAll('.quiz-option-btn');

    // Highlight options
    allBtns.forEach(b => {
      const txt = b.querySelector('.opt-text')?.textContent.trim();
      if (txt === this.currentQuestion.correctAnswer) {
        b.classList.add('correct');
      } else if (b === btn && !isCorrect) {
        b.classList.add('wrong');
      }
    });

    if (isCorrect) {
      this.score += 10;
      this.streak++;
      this.playToneEffect(true);
      if (feedbackBox) {
        feedbackBox.className = 'quiz-feedback success';
        feedbackBox.innerHTML = `
          <div class="fb-icon">🎉 答對了！太厲害了！ (+10 分)</div>
          <button class="btn btn-primary next-q-btn" onclick="window.quizManager.nextQuestion()">下一題 ➔</button>
        `;
        feedbackBox.style.display = 'block';
      }
    } else {
      this.streak = 0;
      this.playToneEffect(false);
      // Save to error notebook
      window.storage.addQuizError({
        question: this.currentQuestion.question,
        correct: this.currentQuestion.correctAnswer,
        userAnswer: selected,
        hz: this.currentQuestion.correctItem.hz || '',
        tl: this.currentQuestion.correctItem.tl || ''
      });

      if (feedbackBox) {
        feedbackBox.className = 'quiz-feedback error';
        feedbackBox.innerHTML = `
          <div class="fb-icon">❌ 差一點！正確答案是：<strong>${this.currentQuestion.correctAnswer}</strong></div>
          <p class="fb-tip">已為您收入錯題複習本。</p>
          <button class="btn btn-primary next-q-btn" onclick="window.quizManager.nextQuestion()">下一題 ➔</button>
        `;
        feedbackBox.style.display = 'block';
      }
    }

    this.updateStatsDisplay();
  }

  // Synthesize pleasant sound effect with Web Audio API
  playToneEffect(isSuccess) {
    try {
      const ctx = window.toneSynth.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      if (isSuccess) {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        osc.frequency.setValueAtTime(261.63, now); // C4
        osc.frequency.setValueAtTime(220.00, now + 0.15); // A3
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      console.warn('Audio effect error:', e);
    }
  }

  updateStatsDisplay() {
    const scoreEl = document.getElementById('quiz-stat-score');
    const streakEl = document.getElementById('quiz-stat-streak');
    const totalEl = document.getElementById('quiz-stat-total');
    if (scoreEl) scoreEl.textContent = this.score;
    if (streakEl) streakEl.textContent = this.streak;
    if (totalEl) totalEl.textContent = this.totalAnswered;
  }
}

window.quizManager = new QuizManager();
