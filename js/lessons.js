/**
 * lessons.js - Themed situational Taiwanese learning units
 * 咱的台語 - Lán ê Tâi-gí
 */

class LessonsManager {
  constructor() {
    this.lessons = [];
    this.currentLesson = null;
    this.init();
  }

  async init() {
    try {
      const resp = await fetch('data/lessons_data.json');
      this.lessons = await resp.json();
      this.renderLessonList();
    } catch (e) {
      console.error('Failed to load lessons:', e);
    }
  }

  renderLessonList() {
    const container = document.getElementById('lesson-list-container');
    if (!container) return;

    let html = `<div class="lessons-grid">`;
    this.lessons.forEach(l => {
      html += `
        <div class="lesson-card" onclick="window.lessonsManager.openLesson(${l.id})">
          <div class="lesson-card-header">
            <span class="lesson-icon">${l.icon}</span>
            <span class="lesson-badge">第 ${l.id} 單元</span>
          </div>
          <h3 class="lesson-title">${l.title}</h3>
          <div class="lesson-tl">${l.title_tl}</div>
          <p class="lesson-desc">${l.description}</p>
          <div class="lesson-meta">
            <span>📚 ${l.vocab.length} 個核心單詞</span>
            <span>💬 ${l.dialogue.length} 句情境會話</span>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
  }

  openLesson(id) {
    const lesson = this.lessons.find(l => l.id === id);
    if (!lesson) return;
    this.currentLesson = lesson;

    const listSec = document.getElementById('lesson-list-section');
    const detailSec = document.getElementById('lesson-detail-section');
    const mapContainer = document.getElementById('level-map-container');
    if (mapContainer) mapContainer.style.display = 'none';
    if (listSec) listSec.style.display = 'none';
    if (detailSec) {
      detailSec.style.display = 'block';
      this.renderLessonDetail(lesson);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  backToList() {
    const listSec = document.getElementById('lesson-list-section');
    const detailSec = document.getElementById('lesson-detail-section');
    const mapContainer = document.getElementById('level-map-container');
    if (detailSec) detailSec.style.display = 'none';
    if (window.levelMap && window.levelMap.currentViewMode === 'map') {
      if (mapContainer) mapContainer.style.display = 'block';
      if (listSec) listSec.style.display = 'none';
    } else {
      if (listSec) listSec.style.display = 'block';
      if (mapContainer) mapContainer.style.display = 'none';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderLessonDetail(lesson) {
    const detailContainer = document.getElementById('lesson-detail-content');
    if (!detailContainer) return;

    detailContainer.innerHTML = `
      <div class="lesson-header-bar">
        <button class="btn btn-outline" onclick="window.lessonsManager.backToList()">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          返回課程列表
        </button>
        <div class="lesson-header-title">
          <span class="lesson-icon">${lesson.icon}</span>
          <h2>第 ${lesson.id} 單元：${lesson.title}</h2>
        </div>
      </div>

      <!-- Unit Tabs -->
      <div class="sub-tabs">
        <button class="sub-tab active" onclick="window.lessonsManager.switchTab('dialogue', this)">💬 情境會話</button>
        <button class="sub-tab" onclick="window.lessonsManager.switchTab('vocab', this)">📖 核心單詞 (${lesson.vocab.length})</button>
        <button class="sub-tab" onclick="window.lessonsManager.switchTab('flashcards', this)">🎴 單字翻翻卡</button>
        <button class="sub-tab" onclick="window.lessonsManager.switchTab('culture', this)">💡 文化與用法</button>
      </div>

      <!-- Tab Contents -->
      <div id="unit-tab-dialogue" class="unit-tab-content">
        <div class="dialogue-box">
          ${lesson.dialogue.map((d, idx) => `
            <div class="dialogue-item ${idx % 2 === 0 ? 'speaker-a' : 'speaker-b'}">
              <div class="dialogue-speaker">${d.speaker}</div>
              <div class="dialogue-bubble">
                <div class="dialogue-hz">${d.hz}</div>
                <div class="dialogue-tl">${d.tl}</div>
                <div class="dialogue-m">${d.m}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div id="unit-tab-vocab" class="unit-tab-content" style="display:none;">
        <div class="vocab-cards-grid">
          ${lesson.vocab.map(v => `
            <div class="vocab-card">
              <div class="vocab-card-top">
                <div class="vocab-hz">${v.hz}</div>
                <div class="vocab-actions">
                  <button class="icon-btn audio-btn" onclick="window.audioManager.playWord(${v.id}, '${v.hz}', this)" title="聆聽發音">
                    <span class="audio-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></span>
                  </button>
                  <button class="icon-btn" onclick="window.app.toggleBookmark(${v.id}, '${v.hz}', '${v.tl}', '${v.def}')" title="收藏">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                  </button>
                  <button class="icon-btn" onclick="window.dictManager.showWordModal(${v.id})" title="詳細辭典釋義">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                  </button>
                </div>
              </div>
              <div class="vocab-tl">${v.tl}</div>
              <div class="vocab-def">${v.pos ? `<span class="pos-tag">${v.pos}</span>` : ''}${v.def}</div>
              ${v.example ? `
                <div class="vocab-example">
                  <div class="eg-hz">例：${v.example.h}</div>
                  <div class="eg-tl">${v.example.tl}</div>
                  <div class="eg-m">${v.example.m}</div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <div id="unit-tab-flashcards" class="unit-tab-content" style="display:none;">
        <div class="flashcard-container" id="flashcard-box">
          ${this.renderFlashcard(0)}
        </div>
      </div>

      <div id="unit-tab-culture" class="unit-tab-content" style="display:none;">
        <div class="culture-card">
          <div class="culture-title">💡 語言文化小錦囊</div>
          <div class="culture-body">${lesson.culture_tip}</div>
        </div>
      </div>
    `;
  }

  switchTab(tabName, btn) {
    document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    ['dialogue', 'vocab', 'flashcards', 'culture'].forEach(t => {
      const el = document.getElementById(`unit-tab-${t}`);
      if (el) el.style.display = (t === tabName) ? 'block' : 'none';
    });
  }

  // --- Flashcard Review System ---
  renderFlashcard(index) {
    if (!this.currentLesson || !this.currentLesson.vocab[index]) return '';
    const v = this.currentLesson.vocab[index];
    const total = this.currentLesson.vocab.length;

    return `
      <div class="flashcard-wrapper">
        <div class="flashcard-progress">單詞 ${index + 1} / ${total}</div>
        <div class="flashcard" id="current-flashcard" onclick="this.classList.toggle('flipped')">
          <div class="flashcard-front">
            <div class="fc-hint">點擊翻面查看拼音與釋義</div>
            <div class="fc-hz">${v.hz}</div>
            <div class="fc-pos">${v.pos || '詞目'}</div>
          </div>
          <div class="flashcard-back">
            <div class="fc-tl">${v.tl}</div>
            <div class="fc-def">${v.def}</div>
            ${v.example ? `<div class="fc-eg">例：${v.example.h} (${v.example.m})</div>` : ''}
            <button class="btn btn-primary fc-audio-btn" onclick="event.stopPropagation(); window.audioManager.playWord(${v.id}, '${v.hz}', this)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              播放台語發音
            </button>
          </div>
        </div>
        <div class="flashcard-nav">
          <button class="btn btn-outline" ${index === 0 ? 'disabled' : ''} onclick="window.lessonsManager.showFlashcard(${index - 1})">
            上一個
          </button>
          <button class="btn btn-outline" ${index === total - 1 ? 'disabled' : ''} onclick="window.lessonsManager.showFlashcard(${index + 1})">
            下一個
          </button>
        </div>
      </div>
    `;
  }

  showFlashcard(index) {
    const box = document.getElementById('flashcard-box');
    if (box) {
      box.innerHTML = this.renderFlashcard(index);
    }
  }
}

window.lessonsManager = new LessonsManager();
