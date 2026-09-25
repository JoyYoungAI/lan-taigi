/**
 * annesia.js - Ministry of Education "臺灣閩南語按呢寫" Explorer
 * 咱的台語 - Lán ê Tâi-gí
 */

class AnnesiaManager {
  constructor() {
    this.articles = [];
    this.filtered = [];
    this.init();
  }

  async init() {
    try {
      const resp = await fetch('data/annesia_data.json');
      this.articles = await resp.json();
      this.filtered = this.articles;
      this.render();
    } catch (e) {
      console.error('Failed to load annesia data:', e);
    }
  }

  search(kw) {
    kw = kw.trim().toLowerCase();
    if (!kw) {
      this.filtered = this.articles;
    } else {
      this.filtered = this.articles.filter(a => a.term.includes(kw) || a.tailo.toLowerCase().includes(kw));
    }
    this.render();
  }

  render() {
    const container = document.getElementById('annesia-list');
    const countEl = document.getElementById('annesia-count');
    if (!container) return;

    if (countEl) {
      countEl.textContent = `共 ${this.filtered.length} 篇教育部用字解析推薦`;
    }

    if (this.filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✍️</div>
          <p>找不到相符的「按呢寫」專欄詞目</p>
        </div>
      `;
      return;
    }

    const items = this.filtered.slice(0, 100);
    container.innerHTML = `
      <div class="annesia-grid">
        ${items.map(a => `
          <div class="annesia-card">
            <div class="annesia-card-top">
              <span class="annesia-issue">第 ${a.issue} 期</span>
              <span class="annesia-badge">教育部推薦漢字</span>
            </div>
            <div class="annesia-term">${a.term}</div>
            <div class="annesia-tl">${a.tailo}</div>
            <p class="annesia-note">探討台語本字正源、古籍文獻出處與正確書寫規範，避免以華音借字或俗寫。</p>
            <div class="annesia-btn-row">
              <button class="btn btn-outline btn-sm" onclick="window.dictManager.search('${a.term}'); window.app.switchNav('dict');">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                查辭典釋義與例句
              </button>
            </div>
          </div>
        `).join('')}
      </div>
      ${this.filtered.length > 100 ? `<p class="table-note">共 ${this.filtered.length} 篇，僅顯示前 100 筆，請使用搜尋框檢索。</p>` : ''}
    `;
  }
}

window.annesiaManager = new AnnesiaManager();
