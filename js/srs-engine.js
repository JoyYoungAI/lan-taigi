/**
 * srs-engine.js - SuperMemo SM-2 Spaced Repetition System Engine
 * 咱的台語 - Lán ê Tâi-gí
 */

class SRSEngine {
  constructor() {
    this.currentSession = [];
    this.currentIndex = 0;
    this.isAnswerRevealed = false;
    this.sessionStats = { reviewed: 0, forgotten: 0, mastered: 0 };
    this.init();
  }

  async init() {
    // Check and update daily streak
    await this.checkStreak();
  }

  async checkStreak() {
    const profile = await window.storage.getUserProfile();
    const today = new Date().toISOString().split('T')[0];
    const lastActive = profile.lastActiveDate;

    if (lastActive !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastActive === yesterday) {
        profile.streak = (profile.streak || 0) + 1;
      } else if (!lastActive) {
        profile.streak = 1;
      } else {
        // missed more than 1 day
        profile.streak = 1;
      }
      profile.lastActiveDate = today;
      await window.storage.saveUserProfile(profile);
    }
    return profile;
  }

  // Register vocabulary into SRS queue (e.g. when finishing a lesson node)
  async registerVocabList(vocabList) {
    if (!vocabList || vocabList.length === 0) return;
    const now = Date.now();

    for (const v of vocabList) {
      const wid = String(v.id);
      const existing = await window.storage.getSRSItem(wid);
      if (!existing) {
        const newItem = {
          id: wid,
          hz: v.hz,
          tl: v.tl,
          def: v.def || '',
          pos: v.pos || '',
          audio: v.audio || wid,
          example: v.example || null,
          repetitions: 0,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: now, // immediately due for initial review
          lastReviewedDate: null,
          addedDate: now,
          history: []
        };
        await window.storage.saveSRSItem(newItem);
      }
    }
  }

  // Calculate next review based on SM-2 Algorithm
  // Grade: 1 (忘記, q=1), 2 (困難, q=3), 3 (良好, q=4), 4 (簡單, q=5)
  calculateSM2(card, grade) {
    let { repetitions = 0, interval = 1, easeFactor = 2.5 } = card;
    const qMap = { 1: 1, 2: 3, 3: 4, 4: 5 };
    const q = qMap[grade] || 3;

    // Update Ease Factor
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    // Update Repetitions & Interval
    if (q < 3) {
      // Failed / Forgot
      repetitions = 0;
      interval = 1; // repeat tomorrow
    } else {
      // Successful recall
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = (grade === 4) ? 4 : 3;
      } else {
        const bonus = (grade === 4) ? 1.3 : 1.0;
        interval = Math.round(interval * easeFactor * bonus);
      }
      repetitions += 1;
    }

    const now = Date.now();
    const nextReviewDate = now + (interval * 24 * 60 * 60 * 1000);

    card.repetitions = repetitions;
    card.interval = interval;
    card.easeFactor = parseFloat(easeFactor.toFixed(2));
    card.nextReviewDate = nextReviewDate;
    card.lastReviewedDate = now;
    card.history = card.history || [];
    card.history.push({ date: now, grade, interval });

    return card;
  }

  async getDueCards() {
    return await window.storage.getDueSRSItems();
  }

  // Get daily metrics for dashboard
  async getDashboardMetrics() {
    const profile = await window.storage.getUserProfile();
    const dueCards = await this.getDueCards();
    const allCards = await window.storage.getAllSRSItems();

    // calculate mastered items (repetitions >= 4)
    const mastered = allCards.filter(c => (c.repetitions || 0) >= 4).length;

    return {
      streak: profile.streak || 1,
      dueCount: dueCards.length,
      totalCards: allCards.length,
      masteredCount: mastered,
      totalStars: profile.totalStars || 0
    };
  }

  // --- Interactive Review Session Modal ---
  async startReviewSession(customCards = null) {
    const cards = customCards || (await this.getDueCards());
    if (!cards || cards.length === 0) {
      window.app?.showToast('太棒了！今日待複習的生詞已全數清空！', 'success');
      return;
    }

    this.currentSession = [...cards].sort(() => 0.5 - Math.random());
    this.currentIndex = 0;
    this.isAnswerRevealed = false;
    this.sessionStats = { reviewed: 0, forgotten: 0, mastered: 0 };

    this.renderReviewModal();
  }

  renderReviewModal() {
    let modal = document.getElementById('srs-review-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'srs-review-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-card srs-modal-card">
          <button class="icon-btn modal-close-btn" onclick="window.srsEngine.closeModal()" title="結束複習">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          <div class="modal-body" id="srs-modal-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.classList.add('show');
    this.renderCurrentCard();
  }

  renderCurrentCard() {
    const body = document.getElementById('srs-modal-body');
    if (!body) return;

    if (this.currentIndex >= this.currentSession.length) {
      this.renderCompletionScreen(body);
      return;
    }

    const card = this.currentSession[this.currentIndex];
    const total = this.currentSession.length;
    const current = this.currentIndex + 1;
    const pct = Math.round(((current - 1) / total) * 100);

    // Calculate forecast intervals for preview on rating buttons
    const c1 = this.calculateForecast(card, 1);
    const c2 = this.calculateForecast(card, 2);
    const c3 = this.calculateForecast(card, 3);
    const c4 = this.calculateForecast(card, 4);

    body.innerHTML = `
      <div class="srs-header-bar">
        <div class="srs-progress-text">今日複習：<strong>${current}</strong> / ${total}</div>
        <div class="srs-progress-bar-wrap">
          <div class="srs-progress-bar" style="width: ${pct}%"></div>
        </div>
      </div>

      <div class="srs-card-box">
        <div class="srs-card-hz">${card.hz}</div>
        
        <button class="btn btn-outline btn-sm srs-audio-btn" onclick="window.audioManager.playWord(${card.audio || card.id}, '${card.hz}', this)">
          <span class="audio-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></span>
          播放台語標準音
        </button>

        <div id="srs-answer-section" class="srs-answer-section" style="${this.isAnswerRevealed ? 'display:block;' : 'display:none;'}">
          <div class="srs-card-tl">${card.tl}</div>
          <div class="srs-card-def">${card.pos ? `<span class="pos-badge">${card.pos}</span>` : ''}${card.def}</div>
          ${card.example ? `
            <div class="srs-card-eg">
              <div><strong>例：</strong>${card.example.h}</div>
              <div class="srs-eg-tl">${card.example.tl}</div>
              <div class="srs-eg-m">華語：${card.example.m}</div>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="srs-actions-footer">
        ${!this.isAnswerRevealed ? `
          <button class="btn btn-primary srs-reveal-btn" onclick="window.srsEngine.revealAnswer()">
            👀 顯示拼音與釋義 (空白鍵)
          </button>
        ` : `
          <div class="srs-grade-buttons-grid">
            <button class="srs-btn srs-grade-1" onclick="window.srsEngine.submitGrade(1)">
              <span class="grade-name">忘記 (1)</span>
              <span class="grade-interval">${c1.interval}天後</span>
            </button>
            <button class="srs-btn srs-grade-2" onclick="window.srsEngine.submitGrade(2)">
              <span class="grade-name">困難 (2)</span>
              <span class="grade-interval">${c2.interval}天後</span>
            </button>
            <button class="srs-btn srs-grade-3" onclick="window.srsEngine.submitGrade(3)">
              <span class="grade-name">良好 (3)</span>
              <span class="grade-interval">${c3.interval}天後</span>
            </button>
            <button class="srs-btn srs-grade-4" onclick="window.srsEngine.submitGrade(4)">
              <span class="grade-name">簡單 (4)</span>
              <span class="grade-interval">${c4.interval}天後</span>
            </button>
          </div>
        `}
      </div>
    `;

    // Automatically play audio
    window.audioManager.playWord(card.audio || card.id, card.hz);
  }

  revealAnswer() {
    this.isAnswerRevealed = true;
    const section = document.getElementById('srs-answer-section');
    if (section) section.style.display = 'block';
    this.renderCurrentCard();
  }

  calculateForecast(card, grade) {
    const cloned = JSON.parse(JSON.stringify(card));
    return this.calculateSM2(cloned, grade);
  }

  async submitGrade(grade) {
    const card = this.currentSession[this.currentIndex];
    this.calculateSM2(card, grade);
    await window.storage.saveSRSItem(card);

    this.sessionStats.reviewed++;
    if (grade === 1) this.sessionStats.forgotten++;
    if (grade === 4) this.sessionStats.mastered++;

    // Update profile stats
    const profile = await window.storage.getUserProfile();
    profile.totalReviews = (profile.totalReviews || 0) + 1;
    await window.storage.saveUserProfile(profile);

    this.currentIndex++;
    this.isAnswerRevealed = false;
    this.renderCurrentCard();
  }

  renderCompletionScreen(body) {
    body.innerHTML = `
      <div class="srs-complete-box">
        <div class="srs-complete-icon">🎉</div>
        <h2>今日複習圓滿完成！</h2>
        <p class="srs-complete-desc">記憶曲線已依照 SM-2 演算法自動調整，大腦記憶更加鞏固！</p>

        <div class="srs-stats-summary-grid">
          <div class="srs-stat-cell">
            <span class="stat-num">${this.sessionStats.reviewed}</span>
            <span class="stat-label">本次複習單詞</span>
          </div>
          <div class="srs-stat-cell">
            <span class="stat-num" style="color:#10b981;">${this.sessionStats.mastered}</span>
            <span class="stat-label">熟練掌握</span>
          </div>
          <div class="srs-stat-cell">
            <span class="stat-num" style="color:#ef4444;">${this.sessionStats.forgotten}</span>
            <span class="stat-label">待加強複習</span>
          </div>
        </div>

        <button class="btn btn-primary" style="margin-top:1.5rem;" onclick="window.srsEngine.closeModal()">
          完成並返回地圖 ➔
        </button>
      </div>
    `;

    // Refresh dashboard UI
    window.levelMap?.renderDashboard();
  }

  closeModal() {
    const modal = document.getElementById('srs-review-modal');
    if (modal) modal.classList.remove('show');
    window.levelMap?.renderDashboard();
  }
}

window.srsEngine = new SRSEngine();
