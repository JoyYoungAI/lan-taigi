/**
 * dict.js - Full Offline Taiwanese Dictionary Engine (29,592 entries)
 * 咱的台語 - Lán ê Tâi-gí
 */

class DictionaryManager {
  constructor() {
    this.indexData = [];
    this.detailsData = null;
    this.mandarinCompData = null;
    this.dialectsData = null;
    this.surnamesData = null;

    this.currentResults = [];
    this.currentPage = 1;
    this.pageSize = 30;
    this.activeFilterCat = 'all';

    this.init();
  }

  async init() {
    try {
      const resp = await fetch('data/dict_index.json');
      this.indexData = await resp.json();
      console.log(`Dictionary index loaded: ${this.indexData.length} words.`);
      this.renderInitialWords();
      this.initCategories();
    } catch (e) {
      console.error('Failed to load dict index:', e);
    }
  }

  // Load details data lazily on first modal open
  async getDetails(id) {
    if (!this.detailsData) {
      try {
        const resp = await fetch('data/dict_details.json');
        this.detailsData = await resp.json();
      } catch (e) {
        console.error('Failed to load dict details:', e);
        return null;
      }
    }
    return this.detailsData[String(id)] || null;
  }

  // Normalize Tailo diacritics for flexible fuzzy searching
  normalizeTailo(text) {
    if (!text) return '';
    return text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove tone diacritics
      .replace(/[-–—\s]/g, '')         // remove hyphens & spaces
      .replace(/[0-9]/g, '');          // remove tone numbers
  }

  initCategories() {
    const cats = ['全部', '性質、程度', '食物、飲料、煙酒', '生活用品', '時間節令', '事、物泛稱', '個性風格', '心理活動', '生理構造', '稱謂輩分', '交通、運輸', '蔬果作物', '顏色、氣味'];
    const container = document.getElementById('category-filter-chips');
    if (!container) return;

    container.innerHTML = cats.map(c => `
      <button class="filter-chip ${c === '全部' ? 'active' : ''}" onclick="window.dictManager.filterCategory('${c}', this)">
        ${c}
      </button>
    `).join('');
  }

  filterCategory(cat, btn) {
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.activeFilterCat = cat;

    const kw = document.getElementById('dict-search-input')?.value.trim() || '';
    this.search(kw);
  }

  renderInitialWords() {
    // Show high-frequency words or random pick on boot
    this.currentResults = this.indexData.slice(0, 100);
    this.renderResults();
  }

  search(kw) {
    kw = kw.trim();
    const normKw = this.normalizeTailo(kw);
    const cat = this.activeFilterCat;

    if (!kw && cat === '全部') {
      this.currentResults = this.indexData.slice(0, 100);
      this.currentPage = 1;
      this.renderResults();
      return;
    }

    this.currentResults = this.indexData.filter(item => {
      // item = [id, hz, tl, cat_str, audio_name, summary]
      const hz = item[1];
      const tl = item[2];
      const c = item[3] || '';
      const summary = item[5] || '';

      // Category match
      if (cat !== '全部' && cat !== 'all' && !c.includes(cat)) {
        return false;
      }

      if (!kw) return true;

      // Hanzi match
      if (hz.includes(kw)) return true;

      // Mandarin definition match
      if (summary.includes(kw)) return true;

      // Tailo match
      if (tl.toLowerCase().includes(kw.toLowerCase())) return true;
      if (normKw && this.normalizeTailo(tl).includes(normKw)) return true;

      return false;
    });

    this.currentPage = 1;
    this.renderResults();
  }

  renderResults() {
    const listEl = document.getElementById('dict-results-list');
    const countEl = document.getElementById('dict-results-count');
    if (!listEl) return;

    if (countEl) {
      countEl.textContent = `共找到 ${this.currentResults.length} 條詞目`;
    }

    if (this.currentResults.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>未找到相符詞目</h3>
          <p>請嘗試使用漢字、臺羅拼音或華語釋義關鍵字搜尋</p>
        </div>
      `;
      return;
    }

    const start = 0;
    const end = this.currentPage * this.pageSize;
    const pageItems = this.currentResults.slice(start, end);

    let html = '';
    pageItems.forEach(item => {
      const [id, hz, tl, cat, audio_name, summary] = item;
      html += `
        <div class="dict-item-card" onclick="window.dictManager.showWordModal(${id})">
          <div class="dict-item-main">
            <div class="dict-item-title-row">
              <span class="dict-item-hz">${hz}</span>
              <span class="dict-item-tl">${tl}</span>
            </div>
            <div class="dict-item-summary">${summary || '點擊查看詳細釋義與例句'}</div>
            ${cat ? `<div class="dict-item-cat">${cat.split(',').slice(0, 2).map(c => `<span class="badge">${c}</span>`).join(' ')}</div>` : ''}
          </div>
          <div class="dict-item-actions">
            <button class="icon-btn audio-btn" onclick="event.stopPropagation(); window.audioManager.playWord(${id}, '${hz}', this)" title="發音">
              <span class="audio-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></span>
            </button>
            <button class="icon-btn" onclick="event.stopPropagation(); window.app.toggleBookmark(${id}, '${hz}', '${tl}', '${summary}')" title="收藏">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            </button>
          </div>
        </div>
      `;
    });

    if (end < this.currentResults.length) {
      html += `
        <div class="load-more-box">
          <button class="btn btn-outline" onclick="window.dictManager.loadMore()">載入更多詞條 (${end} / ${this.currentResults.length})</button>
        </div>
      `;
    }

    listEl.innerHTML = html;
  }

  loadMore() {
    this.currentPage++;
    this.renderResults();
  }

  // --- Word Details Modal ---
  async showWordModal(id) {
    const modal = document.getElementById('word-modal');
    const body = document.getElementById('word-modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="loading-spinner-box">
        <div class="spinner"></div>
        <p>正在載入辭典詳細內容...</p>
      </div>
    `;
    modal.classList.add('show');

    const entry = await this.getDetails(id);
    if (!entry) {
      body.innerHTML = `<div class="error-msg">找不到詞目詳細資訊</div>`;
      return;
    }

    // Add to history
    window.storage.addHistory({ id: entry.id, hz: entry.hz, tl: entry.tl });

    let html = `
      <div class="modal-word-header">
        <div class="modal-word-title">
          <span class="m-hz">${entry.hz}</span>
          <span class="m-tl">${entry.tl}</span>
        </div>
        <div class="modal-word-actions">
          <button class="btn btn-primary" onclick="window.audioManager.playWord(${entry.id}, '${entry.hz}', this)">
            <span class="audio-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></span>
            播放音檔
          </button>
          <button class="btn btn-outline" onclick="window.app.toggleBookmark(${entry.id}, '${entry.hz}', '${entry.tl}', '${entry.s[0]?.d || ''}')">
            收藏詞目
          </button>
        </div>
      </div>
    `;

    // Definitions
    html += `<div class="modal-section"><h4 class="modal-sec-title">📖 詞義解說</h4><div class="senses-list">`;
    if (entry.s && entry.s.length > 0) {
      entry.s.forEach((sense, idx) => {
        html += `
          <div class="sense-item">
            <span class="sense-num">${idx + 1}.</span>
            ${sense.p ? `<span class="pos-badge">${sense.p}</span>` : ''}
            <span class="sense-text">${sense.d}</span>
          </div>
        `;
      });
    } else {
      html += `<p class="text-muted">暫無釋義</p>`;
    }
    html += `</div></div>`;

    // Examples
    if (entry.e && entry.e.length > 0) {
      html += `<div class="modal-section"><h4 class="modal-sec-title">💬 例句示範</h4><div class="examples-list">`;
      entry.e.forEach(eg => {
        html += `
          <div class="eg-card">
            <div class="eg-hz">${eg.h}</div>
            <div class="eg-tl">${eg.tl}</div>
            <div class="eg-m">華語：${eg.m}</div>
          </div>
        `;
      });
      html += `</div></div>`;
    }

    // Dialect differences
    if (entry.d) {
      const d = entry.d;
      html += `
        <div class="modal-section">
          <h4 class="modal-sec-title">🗣️ 方言腔調語音差異</h4>
          <div class="dialects-grid">
            <div class="dialect-cell"><span class="d-region">鹿港偏泉</span><span class="d-val">${d.lok || '-'}</span></div>
            <div class="dialect-cell"><span class="d-region">三峽偏泉</span><span class="d-val">${d.san || '-'}</span></div>
            <div class="dialect-cell"><span class="d-region">臺北偏泉</span><span class="d-val">${d.tpe || '-'}</span></div>
            <div class="dialect-cell"><span class="d-region">宜蘭偏漳</span><span class="d-val">${d.ila || '-'}</span></div>
            <div class="dialect-cell"><span class="d-region">臺南混合</span><span class="d-val">${d.tnn || '-'}</span></div>
            <div class="dialect-cell"><span class="d-region">高雄混合</span><span class="d-val">${d.kao || '-'}</span></div>
            <div class="dialect-cell"><span class="d-region">金門偏泉</span><span class="d-val">${d.kmn || '-'}</span></div>
            <div class="dialect-cell"><span class="d-region">新竹偏泉</span><span class="d-val">${d.hsz || '-'}</span></div>
            <div class="dialect-cell"><span class="d-region">臺中偏漳</span><span class="d-val">${d.txg || '-'}</span></div>
          </div>
        </div>
      `;
    }

    // Alternative readings & variants
    if (entry.v && Object.keys(entry.v).length > 0) {
      const v = entry.v;
      html += `<div class="modal-section"><h4 class="modal-sec-title">🔀 又唸作與異用字</h4><div class="variants-tags">`;
      if (v.alt) html += `<div><strong>又唸作：</strong>${v.alt.join('、')}</div>`;
      if (v.port) html += `<div><strong>合音唸作：</strong>${v.port.join('、')}</div>`;
      if (v.vul) html += `<div><strong>俗唸作：</strong>${v.vul.join('、')}</div>`;
      if (v.var) html += `<div><strong>異用字：</strong>${v.var.join('、')}</div>`;
      html += `</div></div>`;
    }

    body.innerHTML = html;
  }

  closeModal() {
    const modal = document.getElementById('word-modal');
    if (modal) modal.classList.remove('show');
  }

  // --- Mandarin Comparison Tab ---
  async loadMandarinComparison() {
    if (!this.mandarinCompData) {
      try {
        const resp = await fetch('data/mandarin_comparison.json');
        this.mandarinCompData = await resp.json();
      } catch (e) {
        console.error('Failed to load mandarin comparison:', e);
        return;
      }
    }
    this.renderMandarinComparison('');
  }

  renderMandarinComparison(query = '') {
    const container = document.getElementById('mandarin-comp-list');
    if (!container) return;

    query = query.trim().toLowerCase();
    let matches = this.mandarinCompData;
    if (query) {
      matches = matches.filter(r => r[0].toLowerCase().includes(query) || r[2].includes(query) || r[3].toLowerCase().includes(query));
    }

    const displayItems = matches.slice(0, 100);
    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>華語詞彙</th>
              <th>腔調</th>
              <th>台語對照漢字</th>
              <th>臺羅拼音</th>
            </tr>
          </thead>
          <tbody>
            ${displayItems.map(r => `
              <tr>
                <td><strong>${r[0]}</strong></td>
                <td><span class="badge">${r[1]}</span></td>
                <td><span class="hz-highlight">${r[2]}</span></td>
                <td><span class="tl-text">${r[3]}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${matches.length > 100 ? `<p class="table-note">共 ${matches.length} 筆，僅顯示前 100 筆，請輸入搜尋篩選。</p>` : ''}
    `;
  }

  // --- Surnames Tab ---
  async loadSurnames() {
    if (!this.surnamesData) {
      try {
        const resp = await fetch('data/surnames.json');
        this.surnamesData = await resp.json();
      } catch (e) {
        console.error('Failed to load surnames:', e);
        return;
      }
    }
    this.renderSurnames('');
  }

  renderSurnames(query = '') {
    const container = document.getElementById('surnames-list');
    if (!container) return;

    query = query.trim().toLowerCase();
    let list = this.surnamesData;
    if (query) {
      list = list.filter(r => r[0].includes(query) || r[1].toLowerCase().includes(query));
    }

    container.innerHTML = `
      <div class="surnames-grid">
        ${list.slice(0, 150).map(r => `
          <div class="surname-card">
            <span class="sn-hz">${r[0]}</span>
            <span class="sn-tl">${r[1]}</span>
          </div>
        `).join('')}
      </div>
      ${list.length > 150 ? `<p class="table-note">共 ${list.length} 筆姓氏，僅顯示前 150 筆。</p>` : ''}
    `;
  }
}

window.dictManager = new DictionaryManager();
