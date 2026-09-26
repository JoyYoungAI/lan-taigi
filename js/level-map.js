/**
 * level-map.js - Duolingo-style Winding Learning Road Map & Progressive Level Player
 * 咱的台語 - Lán ê Tâi-gí
 */

class LevelMapManager {
  constructor() {
    this.lessons = [];
    // Unconditionally initialize 1-1 as unlocked in memory from millisecond 0
    this.progressMap = {
      '1-1': { levelKey: '1-1', unitId: 1, nodeType: 1, completed: false, stars: 0, unlocked: true }
    };
    this.profile = null;
    this.currentPlayingLevel = null;
    this.currentViewMode = 'map'; // 'map' or 'grid'
    this.init();
  }

  async init() {
    try {
      const resp = await fetch('data/lessons_data.json');
      this.lessons = await resp.json();
    } catch (e) {
      console.error('Failed to init LevelMap lessons:', e);
    }
    await this.loadProgress();
    await this.renderDashboard();
    this.renderMap();
  }

  switchLessonView(mode) {
    this.currentViewMode = mode;
    const mapContainer = document.getElementById('level-map-container');
    const listSec = document.getElementById('lesson-list-section');
    const detailSec = document.getElementById('lesson-detail-section');
    const mapBtn = document.getElementById('view-mode-map-btn');
    const gridBtn = document.getElementById('view-mode-grid-btn');

    if (mode === 'map') {
      if (mapContainer) mapContainer.style.display = 'block';
      if (listSec) listSec.style.display = 'none';
      if (detailSec) detailSec.style.display = 'none';
      if (mapBtn) mapBtn.className = 'btn btn-primary btn-sm';
      if (gridBtn) gridBtn.className = 'btn btn-outline btn-sm';
      this.renderMap();
    } else {
      if (mapContainer) mapContainer.style.display = 'none';
      if (listSec) listSec.style.display = 'block';
      if (detailSec) detailSec.style.display = 'none';
      if (mapBtn) mapBtn.className = 'btn btn-outline btn-sm';
      if (gridBtn) gridBtn.className = 'btn btn-primary btn-sm';
      if (window.lessonsManager && window.lessonsManager.lessons && window.lessonsManager.lessons.length > 0) {
        window.lessonsManager.renderLessonList();
      }
    }
  }

  openQuickFlashcards() {
    this.switchLessonView('grid');
    if (window.lessonsManager) {
      window.lessonsManager.openLesson(1);
      setTimeout(() => {
        window.lessonsManager.switchTab('flashcards');
      }, 50);
    }
  }

  async loadProgress() {
    // 1-1 is always guaranteed unlocked
    this.progressMap['1-1'] = this.progressMap['1-1'] || {
      levelKey: '1-1', unitId: 1, nodeType: 1, completed: false, stars: 0, unlocked: true
    };

    try {
      if (window.storage) {
        this.profile = await window.storage.getUserProfile();
        const allProgress = await window.storage.getAllLevelProgress();
        if (Array.isArray(allProgress) && allProgress.length > 0) {
          allProgress.forEach(p => {
            if (p && p.levelKey) this.progressMap[p.levelKey] = p;
          });
        }
      }
    } catch (err) {
      console.warn('[LevelMap] loadProgress storage error, using memory fallback:', err);
    }

    // Double check 1-1
    if (!this.progressMap['1-1'] || !this.progressMap['1-1'].unlocked) {
      this.progressMap['1-1'] = { levelKey: '1-1', unitId: 1, nodeType: 1, completed: false, stars: 0, unlocked: true };
    }
    if (window.storage) {
      window.storage.saveLevelProgress('1-1', this.progressMap['1-1']).catch(() => {});
    }
  }

  // --- Top Dashboard Render ---
  async renderDashboard() {
    const container = document.getElementById('map-dashboard-container');
    if (!container) return;

    let metrics = { streak: 1, dueCount: 0, totalStars: 0, masteredCount: 0 };
    try {
      if (window.srsEngine && typeof window.srsEngine.getDashboardMetrics === 'function') {
        metrics = await window.srsEngine.getDashboardMetrics();
      }
    } catch (err) {
      console.warn('[LevelMap] renderDashboard metrics error, using default:', err);
    }

    container.innerHTML = `
      <div class="map-dashboard-card">
        <div class="dashboard-metrics-grid">
          <div class="metric-item">
            <span class="metric-icon">🔥</span>
            <div class="metric-info">
              <span class="metric-val">${metrics.streak} <small>天</small></span>
              <span class="metric-label">連續學習</span>
            </div>
          </div>
          <div class="metric-item">
            <span class="metric-icon">🎯</span>
            <div class="metric-info">
              <span class="metric-val" style="color:var(--secondary);">${metrics.dueCount} <small>詞</small></span>
              <span class="metric-label">今日待複習</span>
            </div>
          </div>
          <div class="metric-item">
            <span class="metric-icon">🌟</span>
            <div class="metric-info">
              <span class="metric-val" style="color:#f59e0b;">${metrics.totalStars} <small>顆</small></span>
              <span class="metric-label">累積星數</span>
            </div>
          </div>
          <div class="metric-item">
            <span class="metric-icon">🧠</span>
            <div class="metric-info">
              <span class="metric-val" style="color:#10b981;">${metrics.masteredCount} <small>詞</small></span>
              <span class="metric-label">已精通記憶</span>
            </div>
          </div>
        </div>

        <div class="dashboard-action-row">
          <button class="btn btn-primary dashboard-review-btn ${metrics.dueCount > 0 ? 'has-due' : ''}" onclick="window.srsEngine.startReviewSession()">
            ⚡ 開始今日間隔複習 (${metrics.dueCount} 詞到期)
          </button>
          <button class="btn btn-outline btn-sm" onclick="window.levelMap.openQuickFlashcards()">
            🎴 自由翻翻卡
          </button>
        </div>
      </div>
    `;
  }

  // --- Render Duolingo Winding Map ---
  renderMap() {
    const mapContainer = document.getElementById('level-map-container');
    if (!mapContainer || !this.lessons) return;

    let html = `<div class="winding-path-map">`;

    // Offsets for the winding road effect: Center (0), Right (1), Center (0), Left (-1)
    const offsets = ['offset-center', 'offset-right', 'offset-center', 'offset-left'];
    let globalNodeIdx = 0;

    this.lessons.forEach(unit => {
      html += `
        <div class="unit-banner-milestone">
          <div class="milestone-badge">第 ${unit.id} 章節</div>
          <h3 class="milestone-title">${unit.icon} ${unit.title}</h3>
          <p class="milestone-sub">${unit.title_tl}</p>
        </div>
        <div class="unit-nodes-group">
      `;

      // 4 Nodes per unit
      const nodeTypes = [
        { type: 1, title: '詞彙初探', icon: '📘', desc: '認識核心生詞與語意' },
        { type: 2, title: '聽力認字', icon: '👂', desc: '台語聽音辨字測驗' },
        { type: 3, title: '口說聲調', icon: '🎤', desc: '麥克風發音與調型評分' },
        { type: 4, title: '會話通關', icon: '🏆', desc: '情境會話綜合大考驗' }
      ];

      nodeTypes.forEach((node, nodeIdx) => {
        const levelKey = `${unit.id}-${node.type}`;
        const p = this.progressMap[levelKey] || { unlocked: false, completed: false, stars: 0 };
        const offsetClass = offsets[globalNodeIdx % offsets.length];
        globalNodeIdx++;

        let statusClass = 'locked';
        if (p.completed) statusClass = 'completed';
        else if (p.unlocked) statusClass = 'current';

        html += `
          <div class="level-node-wrapper ${offsetClass}">
            <div class="level-node-btn ${statusClass}" onclick="window.levelMap.openLevel('${unit.id}', ${node.type})">
              <span class="node-icon">${node.icon}</span>
              ${statusClass === 'current' ? `<div class="pulse-ring"></div>` : ''}
              ${statusClass === 'locked' ? `<span class="lock-icon">🔒</span>` : ''}
              ${p.completed ? `
                <div class="stars-badge">
                  ${'★'.repeat(p.stars || 3)}${'☆'.repeat(3 - (p.stars || 3))}
                </div>
              ` : ''}
            </div>
            <div class="node-label">
              <span class="nl-title">${node.title}</span>
              <span class="nl-type">${unit.id}-${node.type}</span>
            </div>
          </div>
        `;
      });

      html += `</div>`; // end unit-nodes-group
    });

    html += `</div>`; // end winding-path-map
    mapContainer.innerHTML = html;
  }

  // --- Open Level Player Modal ---
  async openLevel(unitId, nodeType) {
    const levelKey = `${unitId}-${nodeType}`;
    const p = this.progressMap[levelKey];
    if (!p || (!p.unlocked && !p.completed)) {
      window.app?.showToast('此關卡尚未解鎖，請先依序通過前面的關卡！', 'info');
      return;
    }

    const unit = this.lessons.find(l => l.id === parseInt(unitId));
    if (!unit) return;

    this.currentPlayingLevel = { unit, nodeType, levelKey };

    let modal = document.getElementById('level-player-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'level-player-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-card level-player-card">
          <button class="icon-btn modal-close-btn" onclick="window.levelMap.closePlayerModal()" title="離開關卡">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          <div class="modal-body" id="level-player-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.classList.add('show');
    this.renderLevelContent();
  }

  renderLevelContent() {
    const body = document.getElementById('level-player-body');
    if (!body || !this.currentPlayingLevel) return;

    const { unit, nodeType } = this.currentPlayingLevel;

    if (nodeType === 1) {
      this.renderNode1_VocabIntro(body, unit);
    } else if (nodeType === 2) {
      this.renderNode2_ListeningQuiz(body, unit);
    } else if (nodeType === 3) {
      this.renderNode3_SpeechChallenge(body, unit);
    } else if (nodeType === 4) {
      this.renderNode4_DialogueMastery(body, unit);
    }
  }

  // --- Node 1: 詞彙初探 (Vocab Intro) ---
  renderNode1_VocabIntro(body, unit) {
    const words = unit.vocab.slice(0, 4);
    body.innerHTML = `
      <div class="lp-header">
        <span class="lp-badge">關卡 ${unit.id}-1：詞彙初探</span>
        <h3>${unit.icon} 認識本單元核心生詞</h3>
      </div>
      <div class="lp-vocab-preview-list">
        ${words.map(w => `
          <div class="lp-vocab-row">
            <div class="lp-vr-main">
              <span class="lp-vr-hz">${w.hz}</span>
              <span class="lp-vr-tl">${w.tl}</span>
              <span class="lp-vr-def">${w.def}</span>
            </div>
            <button class="btn btn-outline btn-sm" onclick="window.audioManager.playWord(${w.audio || w.id}, '${w.hz}', this)">
              🔊 發音
            </button>
          </div>
        `).join('')}
      </div>
      <div class="lp-footer-action">
        <button class="btn btn-primary" onclick="window.levelMap.completeLevel(3)">
          我記住了，完成此關卡！ ➔
        </button>
      </div>
    `;

    // play first word audio
    if (words[0]) window.audioManager.playWord(words[0].audio || words[0].id, words[0].hz);
  }

  // --- Node 2: 聽力認字 (Listening Quiz) ---
  renderNode2_ListeningQuiz(body, unit) {
    const words = unit.vocab;
    const target = words[Math.floor(Math.random() * words.length)];
    const options = [target, ...words.filter(w => w !== target).slice(0, 3)].sort(() => 0.5 - Math.random());

    body.innerHTML = `
      <div class="lp-header">
        <span class="lp-badge">關卡 ${unit.id}-2：聽力認字</span>
        <h3>👂 聆聽發音，選出正確的台語漢字</h3>
      </div>
      <div class="lp-quiz-box">
        <button class="btn btn-primary lp-big-audio-btn" onclick="window.audioManager.playWord(${target.audio || target.id}, '${target.hz}', this)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          點擊播放發音
        </button>
        <p class="lp-quiz-hint">提示拼音：${target.tl}</p>

        <div class="lp-quiz-options">
          ${options.map(opt => `
            <button class="lp-option-btn" onclick="window.levelMap.handleListeningChoice('${opt.hz}', '${target.hz}', this)">
              ${opt.hz}
            </button>
          `).join('')}
        </div>
      </div>
      <div id="lp-feedback-area"></div>
    `;

    window.audioManager.playWord(target.audio || target.id, target.hz);
  }

  handleListeningChoice(selected, correct, btn) {
    const isCorrect = (selected === correct);
    const feedback = document.getElementById('lp-feedback-area');
    document.querySelectorAll('.lp-option-btn').forEach(b => {
      if (b.textContent.trim() === correct) b.classList.add('correct');
      else if (b === btn && !isCorrect) b.classList.add('wrong');
    });

    if (isCorrect) {
      feedback.innerHTML = `
        <div class="lp-fb-success">
          🎉 答對了！聽力非常敏銳！
          <button class="btn btn-primary" style="margin-top:0.75rem;" onclick="window.levelMap.completeLevel(3)">過關 ➔</button>
        </div>
      `;
    } else {
      feedback.innerHTML = `
        <div class="lp-fb-error">
          差一點！正確答案是「${correct}」。
          <button class="btn btn-outline" style="margin-top:0.75rem;" onclick="window.levelMap.renderLevelContent()">再試一次</button>
        </div>
      `;
    }
  }

  // --- Node 3: 口說聲調挑戰 (Speech & Tone Pitch Assessment) ---
  renderNode3_SpeechChallenge(body, unit) {
    const words = unit.vocab;
    const word = words[0] || { hz: '多謝', tl: 'to-siā', audio: 2415 };
    // extract tone from tailo (e.g. "to-siā" -> 7, or fallback to 1)
    const targetTone = this.extractPrimaryTone(word.tl);

    body.innerHTML = `
      <div class="lp-header">
        <span class="lp-badge">關卡 ${unit.id}-3：口說聲調挑戰</span>
        <h3>🎤 麥克風發音與物理調型評分 (100% 離線)</h3>
      </div>
      <div class="lp-speech-card">
        <div class="speech-target-hz">${word.hz}</div>
        <div class="speech-target-tl">${word.tl} <span class="tone-tag">第 ${targetTone} 聲</span></div>

        <div class="speech-buttons-row">
          <button class="btn btn-outline btn-sm" onclick="window.audioManager.playWord(${word.audio || word.id}, '${word.hz}', this)">
            🔊 聆聽標準原音
          </button>
          <button class="btn btn-outline btn-sm" onclick="window.toneSynth.playTone(${targetTone})">
            🎵 聆聽調值滑音
          </button>
        </div>

        <div class="pitch-canvas-wrapper">
          <div class="canvas-legend">
            <span><span class="legend-gold">---</span> 標準調型曲線</span>
            <span><span class="legend-green">──</span> 您的發音音高軌跡</span>
          </div>
          <canvas id="speech-pitch-canvas" width="340" height="180"></canvas>
        </div>

        <div class="mic-control-center">
          <button id="mic-record-btn" class="mic-record-btn" onclick="window.levelMap.toggleMicRecording(${targetTone})">
            <span class="mic-icon">🎙️</span>
            <span id="mic-btn-label">按一下開始錄音</span>
          </button>
        </div>

        <div id="speech-eval-result" style="display:none;"></div>
      </div>
    `;

    // Draw initial empty pitch canvas
    const canvas = document.getElementById('speech-pitch-canvas');
    if (canvas) {
      window.speechEvaluator.renderPitchCanvas(canvas, canvas.getContext('2d'), [], targetTone);
    }
  }

  extractPrimaryTone(tl) {
    if (!tl) return 1;
    if (tl.includes('á') || tl.includes('é') || tl.includes('í') || tl.includes('ó') || tl.includes('ú')) return 2;
    if (tl.includes('à') || tl.includes('è') || tl.includes('ì') || tl.includes('ò') || tl.includes('ù')) return 3;
    if (tl.includes('â') || tl.includes('ê') || tl.includes('î') || tl.includes('ô') || tl.includes('û')) return 5;
    if (tl.includes('ā') || tl.includes('ē') || tl.includes('ī') || tl.includes('ō') || tl.includes('ū')) return 7;
    if (tl.includes('a̍') || tl.includes('e̍') || tl.includes('i̍') || tl.includes('o̍') || tl.includes('u̍')) return 8;
    if (/[ptkh]$/.test(tl)) return 4;
    return 1;
  }

  toggleMicRecording(targetTone) {
    const btn = document.getElementById('mic-record-btn');
    const label = document.getElementById('mic-btn-label');
    const resultBox = document.getElementById('speech-eval-result');

    if (!window.speechEvaluator.isRecording) {
      btn.classList.add('recording');
      label.textContent = '錄音評分中... (再點一下停止)';
      if (resultBox) resultBox.style.display = 'none';

      window.speechEvaluator.startRecording('speech-pitch-canvas', targetTone, (evalResult, userAudioUrl) => {
        btn.classList.remove('recording');
        label.textContent = '再次錄音比對';
        this.renderSpeechResult(evalResult, userAudioUrl);
      });
    } else {
      window.speechEvaluator.stopRecording();
    }
  }

  renderSpeechResult(res, audioUrl) {
    const resultBox = document.getElementById('speech-eval-result');
    if (!resultBox) return;

    resultBox.style.display = 'block';
    const stars = res.score >= 80 ? 3 : (res.score >= 60 ? 2 : 1);

    resultBox.innerHTML = `
      <div class="speech-result-box">
        <div class="sr-score-row">
          <div class="sr-score">${res.score} <small>分</small></div>
          <div class="sr-grade">${res.grade}</div>
          <div class="sr-stars">${'★'.repeat(stars)}</div>
        </div>
        <p class="sr-feedback">${res.feedback}</p>
        <div class="sr-actions">
          <button class="btn btn-outline btn-sm" onclick="window.speechEvaluator.playUserAudio()">
            ▶️ 回放我的發音
          </button>
          <button class="btn btn-primary" onclick="window.levelMap.completeLevel(${stars})">
            過關領取星星 ➔
          </button>
        </div>
      </div>
    `;
  }

  // --- Node 4: 會話通關考 (Dialogue Mastery) ---
  renderNode4_DialogueMastery(body, unit) {
    const dialogue = unit.dialogue[0];
    body.innerHTML = `
      <div class="lp-header">
        <span class="lp-badge">關卡 ${unit.id}-4：會話通關大考驗</span>
        <h3>🏆 掌握實用情境會話對話</h3>
      </div>
      <div class="lp-dialogue-card">
        <div class="dialogue-speaker">${dialogue.speaker} 說：</div>
        <div class="dialogue-bubble">
          <div class="dialogue-hz">${dialogue.hz}</div>
          <div class="dialogue-tl">${dialogue.tl}</div>
          <div class="dialogue-m">${dialogue.m}</div>
        </div>

        <button class="btn btn-outline" style="margin: 1.25rem 0;" onclick="window.audioManager.speechFallback('${dialogue.hz}')">
          🔊 完整聆聽會話語音
        </button>

        <div class="lp-mastery-notice">
          恭喜完成本章節全部 4 個關卡！通關後，本單元的 ${unit.vocab.length} 個核心單詞將正式納入您的 <strong>SM-2 間隔重複複習庫</strong>，協助您永久記憶！
        </div>

        <button class="btn btn-primary" style="margin-top:1rem; width:100%;" onclick="window.levelMap.completeLevel(3, true)">
          🎉 通關並解鎖下一章節！
        </button>
      </div>
    `;
  }

  // --- Complete Level, Award Stars, and Unlock Next Node ---
  async completeLevel(stars = 3, isUnitComplete = false) {
    if (!this.currentPlayingLevel) return;
    const { unit, nodeType, levelKey } = this.currentPlayingLevel;

    // Save level progress
    this.progressMap[levelKey] = {
      levelKey,
      unitId: unit.id,
      nodeType,
      completed: true,
      stars: Math.max(stars, this.progressMap[levelKey]?.stars || 0),
      unlocked: true
    };
    await window.storage.saveLevelProgress(levelKey, this.progressMap[levelKey]);

    // Unlock next node
    let nextUnitId = unit.id;
    let nextNodeType = nodeType + 1;
    if (nextNodeType > 4) {
      nextUnitId = unit.id + 1;
      nextNodeType = 1;
    }
    const nextLevelKey = `${nextUnitId}-${nextNodeType}`;
    if (!this.progressMap[nextLevelKey]) {
      this.progressMap[nextLevelKey] = {
        levelKey: nextLevelKey,
        unitId: nextUnitId,
        nodeType: nextNodeType,
        completed: false,
        stars: 0,
        unlocked: true
      };
      await window.storage.saveLevelProgress(nextLevelKey, this.progressMap[nextLevelKey]);
    }

    // If unit completed or node 4 finished, register unit vocab into SM-2 SRS
    if (nodeType === 4 || isUnitComplete) {
      await window.srsEngine.registerVocabList(unit.vocab);
    }

    // Update profile total stars
    const allP = await window.storage.getAllLevelProgress();
    const totalStars = allP.reduce((sum, item) => sum + (item.stars || 0), 0);
    this.profile.totalStars = totalStars;
    await window.storage.saveUserProfile(this.profile);

    window.app?.showToast(`關卡 ${levelKey} 順利通關！獲得 ${stars} 顆星！`, 'success');

    this.closePlayerModal();
    this.renderDashboard();
    this.renderMap();
  }

  closePlayerModal() {
    window.speechEvaluator.stopRecording();
    const modal = document.getElementById('level-player-modal');
    if (modal) modal.classList.remove('show');
    this.currentPlayingLevel = null;
  }
}

window.levelMap = new LevelMapManager();
