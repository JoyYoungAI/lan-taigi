/**
 * phonology.js - Tâi-lô Romanization, Phonetics & Tone Sandhi Masterclass
 * 咱的台語 - Lán ê Tâi-gí
 */

class PhonologyManager {
  constructor() {
    this.data = null;
    this.init();
  }

  async init() {
    try {
      const resp = await fetch('data/phonology_data.json');
      this.data = await resp.json();
      this.renderInitials();
      this.renderVowels();
      this.renderTones();
      this.renderSandhi();
    } catch (e) {
      console.error('Failed to load phonology data:', e);
    }
  }

  // 17 Initials (聲母)
  renderInitials() {
    const container = document.getElementById('initials-table-container');
    if (!container || !this.data) return;

    container.innerHTML = `
      <div class="phonetics-grid">
        ${this.data.initials.map(init => `
          <div class="phonetic-card">
            <div class="ph-top">
              <span class="ph-tl">${init.tl}</span>
              <span class="ph-ipa">${init.ipa}</span>
            </div>
            <div class="ph-ex">例字：<strong>${init.ex}</strong></div>
            <p class="ph-desc">${init.desc}</p>
            <button class="btn btn-outline btn-sm ph-audio-btn" onclick="window.toneSynth.playTone(1)">
              🎵 示範音高
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Vowels (韻母)
  renderVowels() {
    const container = document.getElementById('vowels-table-container');
    if (!container || !this.data) return;

    container.innerHTML = `
      <div class="phonetics-grid">
        ${this.data.vowels.map(v => `
          <div class="phonetic-card">
            <div class="ph-top">
              <span class="ph-tl">${v.tl}</span>
              <span class="ph-ipa">${v.ipa}</span>
            </div>
            <div class="ph-ex">代表漢字：<strong>${v.hz}</strong></div>
            <p class="ph-desc">${v.desc}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 8 Tones (八聲七調)
  renderTones() {
    const chartBox = document.getElementById('tone-chart-box');
    const cardsBox = document.getElementById('tone-cards-box');
    if (!cardsBox || !this.data) return;

    // Render interactive SVG
    if (chartBox) {
      window.toneSynth.renderToneChart(chartBox, 1);
    }

    cardsBox.innerHTML = `
      <div class="tones-grid">
        ${this.data.tones.map(t => `
          <div class="tone-card" data-tone="${t.number}" onclick="window.phonologyManager.selectTone(${t.number})">
            <div class="tone-card-header">
              <span class="tone-num">第 ${t.number} 聲</span>
              <span class="tone-pitch">${t.pitch}</span>
            </div>
            <div class="tone-name">${t.name}</div>
            <div class="tone-contour">${t.contour}</div>
            <div class="tone-sample">例：${t.hz} (${t.tl})</div>
            <p class="tone-desc">${t.desc}</p>
            <button class="btn btn-primary btn-sm tone-play-btn" onclick="event.stopPropagation(); window.toneSynth.playTone(${t.number})">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              試聽調值滑音
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  selectTone(num) {
    document.querySelectorAll('.tone-card').forEach(c => {
      if (parseInt(c.dataset.tone) === num) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });

    const chartBox = document.getElementById('tone-chart-box');
    if (chartBox) {
      window.toneSynth.renderToneChart(chartBox, num);
    }
    window.toneSynth.playTone(num);
  }

  // Tone Sandhi (變調)
  renderSandhi() {
    const container = document.getElementById('sandhi-rules-container');
    if (!container || !this.data) return;

    const s = this.data.sandhi_rules;
    container.innerHTML = `
      <div class="sandhi-master-box">
        <div class="sandhi-formula">
          <span class="formula-title">口訣心法：</span>
          <span class="formula-text">${s.formula}</span>
        </div>
        <p class="sandhi-intro">${s.description}</p>

        <!-- Interactive Sandhi Practice Circle -->
        <div class="sandhi-circle-interactive">
          <div class="sandhi-node" onclick="window.phonologyManager.testSandhi(5)">5 (陽平) ➔ 7</div>
          <div class="sandhi-arrow">➔</div>
          <div class="sandhi-node" onclick="window.phonologyManager.testSandhi(7)">7 (陽去) ➔ 3</div>
          <div class="sandhi-arrow">➔</div>
          <div class="sandhi-node" onclick="window.phonologyManager.testSandhi(3)">3 (陰去) ➔ 2</div>
          <div class="sandhi-arrow">➔</div>
          <div class="sandhi-node" onclick="window.phonologyManager.testSandhi(2)">2 (陰上) ➔ 1</div>
          <div class="sandhi-arrow">➔</div>
          <div class="sandhi-node" onclick="window.phonologyManager.testSandhi(1)">1 (陰平) ➔ 7</div>
        </div>

        <div id="sandhi-result-card" class="sandhi-result-card" style="display:none;"></div>

        <div class="sandhi-rules-list">
          ${s.rules.map(r => `
            <div class="sandhi-rule-row">
              <span class="rule-from">${r.from}</span>
              <span class="rule-arrow">➔</span>
              <span class="rule-to">${r.to}</span>
              <span class="rule-ex">（${r.ex}）</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  testSandhi(tone) {
    const resultBox = document.getElementById('sandhi-result-card');
    if (!resultBox) return;

    const res = window.toneSynth.calculateSandhi(tone);
    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div class="sr-title">🎯 變調實例演算</div>
      <div class="sr-rule">${res.rule}</div>
      <p>點擊可連續聆聽「本調 ➔ 變調」的音高變化：</p>
      <button class="btn btn-primary btn-sm" onclick="window.phonologyManager.playSandhiPair(${tone}, ${res.nextTone})">
        🎵 播放變調前後滑音
      </button>
    `;
    this.playSandhiPair(tone, res.nextTone);
  }

  playSandhiPair(t1, t2) {
    window.toneSynth.playTone(t1);
    setTimeout(() => {
      window.toneSynth.playTone(t2);
    }, 600);
  }
}

window.phonologyManager = new PhonologyManager();
