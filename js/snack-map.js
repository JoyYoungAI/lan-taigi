/**
 * snack-map.js - 台灣各地著名在地小吃、道地例句與夜市點餐對話庫
 * 咱的台語 - Lán ê Tâi-gí
 */

class SnackMapManager {
  constructor() {
    this.snacks = [];
    this.currentRegion = 'all'; // 'all', 'north', 'central', 'south', 'east_islands'
    this.searchQuery = '';
    this.selectedSnack = null;
    this.activeSentenceTab = 'ordering'; // 'ordering', 'tasting', 'lore'

    // Ordering builder state
    this.builderState = {
      snackId: 4, // default 滷肉飯
      diningMode: 'pau-tńg-khì', // 'pau-tńg-khì' (外帶) or 'lāi-iōng' (內用)
      portion: 'tuā-uánn', // 'tuā-uánn', 'sè-uánn', 'tsi̍t-uánn', 'nn̄g-hūn'
      spicy: 'sió-lua̍h', // 'bô-lua̍h', 'sió-lua̍h', 'ka-lua̍h'
      cilantro: 'mài-iân-sui', // 'mài-iân-sui', 'tsē-iân-sui', 'none'
      extra: 'puànn-puî-sán' // 'puànn-puî-sán', 'lo̍h-suàn-nî', 'sap-hôo-tsio'
    };

    this.init();
  }

  async init() {
    try {
      const resp = await fetch('data/taiwan_snacks.json');
      this.snacks = await resp.json();
      this.render();
    } catch (e) {
      console.error('Failed to load taiwan snacks data:', e);
    }
  }

  render() {
    this.renderRegionTabs();
    this.renderOrderingBuilder();
    this.renderSnacksGrid();
  }

  // --- Region Filtering ---
  setRegion(region) {
    this.currentRegion = region;
    document.querySelectorAll('.snack-region-tab').forEach(btn => {
      if (btn.dataset.region === region) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    this.renderSnacksGrid();
  }

  search(query) {
    this.searchQuery = (query || '').trim().toLowerCase();
    this.renderSnacksGrid();
  }

  renderRegionTabs() {
    const container = document.getElementById('snack-region-tabs');
    if (!container) return;

    const regions = [
      { id: 'all', label: '🌏 全台精選 (30)' },
      { id: 'north', label: '🏙️ 北部名點 (6)' },
      { id: 'central', label: '🌾 中部古味 (6)' },
      { id: 'south', label: '☀️ 南部府城 (11)' },
      { id: 'east_islands', label: '🌊 東部與離島 (7)' }
    ];

    container.innerHTML = regions.map(r => `
      <button class="snack-region-tab ${this.currentRegion === r.id ? 'active' : ''}" 
              data-region="${r.id}" 
              onclick="window.snackMap.setRegion('${r.id}')">
        ${r.label}
      </button>
    `).join('');
  }

  // --- Render Snack Cards Grid ---
  renderSnacksGrid() {
    const container = document.getElementById('snacks-grid-container');
    const countEl = document.getElementById('snacks-count-label');
    if (!container) return;

    let filtered = this.snacks;
    if (this.currentRegion !== 'all') {
      filtered = filtered.filter(s => s.region === this.currentRegion);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(s => 
        s.hz.toLowerCase().includes(this.searchQuery) ||
        s.tl.toLowerCase().includes(this.searchQuery) ||
        s.mandarin.toLowerCase().includes(this.searchQuery) ||
        s.city.toLowerCase().includes(this.searchQuery) ||
        (s.tags && s.tags.some(t => t.toLowerCase().includes(this.searchQuery)))
      );
    }

    if (countEl) {
      countEl.innerText = `共收錄 ${filtered.length} 種特色在地美食與實戰例句`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
          <div style="font-size:3rem; margin-bottom:1rem;">🔍</div>
          <p>找不到符合條件的在地小吃，請嘗試搜尋其他關鍵字或切換地區！</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(s => `
      <div class="snack-card" onclick="window.snackMap.openSnackModal(${s.id})">
        <div class="snack-card-top">
          <span class="snack-card-icon">${s.icon}</span>
          <span class="snack-city-badge">${s.city}</span>
        </div>
        <h3 class="snack-card-hz">${s.hz}</h3>
        <div class="snack-card-tl">${s.tl}</div>
        <p class="snack-card-m">${s.mandarin}</p>

        <!-- Preview Sample Sentence -->
        <div class="snack-preview-quote">
          <span class="quote-tag">💬 點餐</span>
          <span class="quote-text">「${s.sentences.ordering.hz}」</span>
        </div>

        <div class="snack-card-tags">
          ${(s.tags || []).slice(0, 3).map(t => `<span class="snack-tag">${t}</span>`).join('')}
        </div>

        <div class="snack-card-footer">
          <span style="font-size:0.8rem; color:var(--primary); font-weight:600;">查看道地例句與由來 ➔</span>
          <button class="icon-btn audio-btn" onclick="event.stopPropagation(); window.snackMap.playSnackAudio(${s.id}, '${s.hz}', this)" title="聆聽台語發音">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  // --- Interactive Night Market Ordering Generator ---
  renderOrderingBuilder() {
    const container = document.getElementById('snack-ordering-builder');
    if (!container) return;

    const currentSnack = this.snacks.find(s => s.id === this.builderState.snackId) || this.snacks[3]; // default 滷肉飯

    // Compute generated dialog sentence
    const dialogResult = this.generateOrderSentence(currentSnack);

    container.innerHTML = `
      <div class="ordering-builder-card">
        <div class="builder-header">
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <span style="font-size:1.6rem;">🏮</span>
            <div>
              <h3 style="margin:0; color:var(--primary);">夜市與小吃點餐客製化對話產生器</h3>
              <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">自由組合份量、辣度、蒜泥與口味偏好，自動生成道地台語點餐例句與語音！</p>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="window.snackMap.randomizeBuilder()">🎲 隨機點餐挑戰</button>
        </div>

        <div class="builder-controls-grid">
          <!-- Step 1: Pick Snack -->
          <div class="builder-field">
            <label class="builder-label">1. 選擇小吃品項</label>
            <select class="builder-select" onchange="window.snackMap.updateBuilder('snackId', parseInt(this.value))">
              ${this.snacks.map(s => `
                <option value="${s.id}" ${s.id === this.builderState.snackId ? 'selected' : ''}>
                  ${s.icon} ${s.hz} (${s.tl}) - ${s.city}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Step 2: Dining Mode -->
          <div class="builder-field">
            <label class="builder-label">2. 用餐方式</label>
            <div class="builder-btn-group">
              <button class="builder-chip ${this.builderState.diningMode === 'pau-tńg-khì' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('diningMode', 'pau-tńg-khì')">
                🛍️ 包外帶 (pau-tńg-khì)
              </button>
              <button class="builder-chip ${this.builderState.diningMode === 'lāi-iōng' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('diningMode', 'lāi-iōng')">
                🪑 內用 (lāi-iōng)
              </button>
            </div>
          </div>

          <!-- Step 3: Portion -->
          <div class="builder-field">
            <label class="builder-label">3. 份量與大小</label>
            <div class="builder-btn-group">
              <button class="builder-chip ${this.builderState.portion === 'tuā-uánn' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('portion', 'tuā-uánn')">
                大碗 (tuā-uánn)
              </button>
              <button class="builder-chip ${this.builderState.portion === 'sè-uánn' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('portion', 'sè-uánn')">
                細碗 (sè-uánn)
              </button>
              <button class="builder-chip ${this.builderState.portion === 'tsi̍t-uánn' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('portion', 'tsi̍t-uánn')">
                一碗 (tsi̍t-uánn)
              </button>
              <button class="builder-chip ${this.builderState.portion === 'nn̄g-hūn' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('portion', 'nn̄g-hūn')">
                兩份 (nn̄g-hūn)
              </button>
            </div>
          </div>

          <!-- Step 4: Spicy Level -->
          <div class="builder-field">
            <label class="builder-label">4. 辣度需求</label>
            <div class="builder-btn-group">
              <button class="builder-chip ${this.builderState.spicy === 'sió-lua̍h' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('spicy', 'sió-lua̍h')">
                🌶️ 小辣 (sió-lua̍h)
              </button>
              <button class="builder-chip ${this.builderState.spicy === 'ka-lua̍h' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('spicy', 'ka-lua̍h')">
                🔥 愛加辣 (ài ka-lua̍h)
              </button>
              <button class="builder-chip ${this.builderState.spicy === 'bô-lua̍h' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('spicy', 'bô-lua̍h')">
                🚫 莫加辣 (mài ka-lua̍h)
              </button>
            </div>
          </div>

          <!-- Step 5: Cilantro / Aromatics -->
          <div class="builder-field">
            <label class="builder-label">5. 香菜 (芫荽)</label>
            <div class="builder-btn-group">
              <button class="builder-chip ${this.builderState.cilantro === 'mài-iân-sui' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('cilantro', 'mài-iân-sui')">
                🚫 莫加芫荽 (mài ka-iân-sui)
              </button>
              <button class="builder-chip ${this.builderState.cilantro === 'tsē-iân-sui' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('cilantro', 'tsē-iân-sui')">
                🌿 芫荽放多一點
              </button>
              <button class="builder-chip ${this.builderState.cilantro === 'none' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('cilantro', 'none')">
                正常添加
              </button>
            </div>
          </div>

          <!-- Step 6: Custom Taste / Garlic / Fat -->
          <div class="builder-field">
            <label class="builder-label">6. 專屬客製化偏好</label>
            <div class="builder-btn-group">
              <button class="builder-chip ${this.builderState.extra === 'puànn-puî-sán' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('extra', 'puànn-puî-sán')">
                🥓 愛半肥瘦 (puànn-puî-sán)
              </button>
              <button class="builder-chip ${this.builderState.extra === 'lo̍h-suàn-nî' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('extra', 'lo̍h-suàn-nî')">
                🧄 蒜泥放多 (suàn-nî tsē)
              </button>
              <button class="builder-chip ${this.builderState.extra === 'sap-hôo-tsio' ? 'active' : ''}" 
                      onclick="window.snackMap.updateBuilder('extra', 'sap-hôo-tsio')">
                🧂 撒胡椒粉 (sap hôo-tsio)
              </button>
            </div>
          </div>
        </div>

        <!-- Generated Output Box -->
        <div class="builder-output-card">
          <div class="output-top-bar">
            <span class="output-title">🗣️ 道地台語點餐整句實戰：</span>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-sm btn-primary" onclick="window.snackMap.speakSentence('${dialogResult.hz}', '${dialogResult.tl}')">
                🔊 聆聽整句發音
              </button>
              <button class="btn btn-sm btn-outline" onclick="window.snackMap.copyText('${dialogResult.hz}')">
                📋 複製漢字
              </button>
              <button class="btn btn-sm btn-outline" onclick="window.snackMap.addCustomToSRS('${currentSnack.hz}', '${dialogResult.hz}', '${dialogResult.tl}')">
                🧠 收入 SM-2 複習
              </button>
            </div>
          </div>
          <div class="output-hz">${dialogResult.hz}</div>
          <div class="output-tl">${dialogResult.tl}</div>
          <div class="output-m">華語意譯：${dialogResult.m}</div>
        </div>
      </div>
    `;
  }

  updateBuilder(key, value) {
    this.builderState[key] = value;
    this.renderOrderingBuilder();
  }

  randomizeBuilder() {
    const randomSnack = this.snacks[Math.floor(Math.random() * this.snacks.length)];
    const portions = ['tuā-uánn', 'sè-uánn', 'tsi̍t-uánn', 'nn̄g-hūn'];
    const modes = ['pau-tńg-khì', 'lāi-iōng'];
    const spicies = ['sió-lua̍h', 'ka-lua̍h', 'bô-lua̍h'];
    const cilantros = ['mài-iân-sui', 'tsē-iân-sui', 'none'];
    const extras = ['puànn-puî-sán', 'lo̍h-suàn-nî', 'sap-hôo-tsio'];

    this.builderState = {
      snackId: randomSnack.id,
      diningMode: modes[Math.floor(Math.random() * modes.length)],
      portion: portions[Math.floor(Math.random() * portions.length)],
      spicy: spicies[Math.floor(Math.random() * spicies.length)],
      cilantro: cilantros[Math.floor(Math.random() * cilantros.length)],
      extra: extras[Math.floor(Math.random() * extras.length)]
    };
    this.renderOrderingBuilder();
  }

  generateOrderSentence(snack) {
    let portionHz = '一碗', portionTl = 'tsi̍t uánn', portionM = '一碗';
    if (this.builderState.portion === 'tuā-uánn') {
      portionHz = '一碗大碗'; portionTl = 'tsi̍t uánn tuā-uánn'; portionM = '一大碗';
    } else if (this.builderState.portion === 'sè-uánn') {
      portionHz = '一碗細碗'; portionTl = 'tsi̍t uánn sè-uánn'; portionM = '一小碗';
    } else if (this.builderState.portion === 'nn̄g-hūn') {
      portionHz = '兩份'; portionTl = 'nn̄g hūn'; portionM = '兩份';
    }

    let spicyHz = '', spicyTl = '', spicyM = '';
    if (this.builderState.spicy === 'sió-lua̍h') {
      spicyHz = '，小辣'; spicyTl = ', sió-lua̍h'; spicyM = '，小辣';
    } else if (this.builderState.spicy === 'ka-lua̍h') {
      spicyHz = '，愛加辣'; spicyTl = ', ài ka-lua̍h'; spicyM = '，要加辣';
    } else if (this.builderState.spicy === 'bô-lua̍h') {
      spicyHz = '，莫加辣'; spicyTl = ', mài ka-lua̍h'; spicyM = '，不要加辣';
    }

    let cilantroHz = '', cilantroTl = '', cilantroM = '';
    if (this.builderState.cilantro === 'mài-iân-sui') {
      cilantroHz = '，莫加芫荽'; cilantroTl = ', mài ka-iân-sui'; cilantroM = '，不要加香菜';
    } else if (this.builderState.cilantro === 'tsē-iân-sui') {
      cilantroHz = '，芫荽多放一點'; cilantroTl = ', iân-sui tsē pàng tsi̍t-tiám'; cilantroM = '，香菜多放一點';
    }

    let extraHz = '', extraTl = '', extraM = '';
    if (this.builderState.extra === 'puànn-puî-sán') {
      extraHz = '，肉愛半肥瘦'; extraTl = ', bah ài puànn-puî-sán'; extraM = '，肉要半肥半瘦';
    } else if (this.builderState.extra === 'lo̍h-suàn-nî') {
      extraHz = '，蒜泥放重一點'; extraTl = ', suàn-nî pàng tāng tsi̍t-tiám'; extraM = '，蒜泥放重一點';
    } else if (this.builderState.extra === 'sap-hôo-tsio') {
      extraHz = '，撒胡椒粉'; extraTl = ', sap hôo-tsio-hún'; extraM = '，撒胡椒粉';
    }

    let modeHz = '，包外帶，多謝！', modeTl = ', pau-tńg-khì, to-siā!', modeM = '，包外帶，謝謝！';
    if (this.builderState.diningMode === 'lāi-iōng') {
      modeHz = '，內用，多謝！'; modeTl = ', lāi-iōng, to-siā!'; modeM = '，內用，謝謝！';
    }

    const hz = `頭家，我要${portionHz}${snack.hz}${spicyHz}${cilantroHz}${extraHz}${modeHz}`;
    const tl = `Thâu-ke, guá ài ${portionTl} ${snack.tl}${spicyTl}${cilantroTl}${extraTl}${modeTl}`;
    const m = `老闆，我要${portionM}${snack.mandarin.split('（')[0]}${spicyM}${cilantroM}${extraM}${modeM}`;

    return { hz, tl, m };
  }

  // --- Open Snack Modal ---
  openSnackModal(id) {
    const snack = this.snacks.find(s => s.id === id);
    if (!snack) return;
    this.selectedSnack = snack;

    let modal = document.getElementById('snack-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'snack-detail-modal';
      modal.className = 'modal-overlay';
      modal.onclick = (e) => {
        if (e.target === modal) this.closeSnackModal();
      };
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card snack-modal-card">
        <button class="icon-btn modal-close-btn" onclick="window.snackMap.closeSnackModal()" title="關閉">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>

        <div class="snack-modal-header">
          <div class="snack-modal-icon">${snack.icon}</div>
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <h2 style="margin:0; color:var(--primary); font-size:1.6rem;">${snack.hz}</h2>
              <span class="snack-city-badge">${snack.city}</span>
              <button class="icon-btn audio-btn" onclick="window.snackMap.playSnackAudio(${snack.id}, '${snack.hz}', this)" title="聆聽台語發音">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              </button>
            </div>
            <div style="font-family:var(--font-serif); font-size:1.1rem; color:var(--secondary); font-weight:600; margin-top:0.25rem;">
              ${snack.tl}
            </div>
            <p style="margin:0.25rem 0 0 0; color:var(--text-muted); font-size:0.9rem;">
              ${snack.mandarin}
            </p>
          </div>
        </div>

        <!-- Accents / Dialect Differences -->
        ${snack.accents ? `
          <div class="snack-accents-box">
            <span class="accents-title">🗣️ 各地腔調與稱呼：</span>
            ${Object.entries(snack.accents).map(([k, v]) => `
              <span class="accent-chip"><strong>${k}：</strong>${v}</span>
            `).join('')}
          </div>
        ` : ''}

        <!-- Origin Lore Story -->
        <div class="snack-lore-box">
          <h4 style="margin:0 0 0.35rem 0; color:var(--text-main); font-size:0.95rem;">📜 美食由來與文化典故</h4>
          <p style="margin:0; font-size:0.88rem; line-height:1.6; color:var(--text-main);">
            ${snack.origin}
          </p>
        </div>

        <!-- Sentence Tabs: Ordering / Tasting / Lore -->
        <div class="snack-sentences-container">
          <div class="snack-sent-tabs">
            <button class="snack-sent-tab ${this.activeSentenceTab === 'ordering' ? 'active' : ''}" 
                    onclick="window.snackMap.switchSentenceTab('ordering')">
              💬 實戰點餐例句
            </button>
            <button class="snack-sent-tab ${this.activeSentenceTab === 'tasting' ? 'active' : ''}" 
                    onclick="window.snackMap.switchSentenceTab('tasting')">
              👅 地道口感評語
            </button>
            <button class="snack-sent-tab ${this.activeSentenceTab === 'lore' ? 'active' : ''}" 
                    onclick="window.snackMap.switchSentenceTab('lore')">
              📜 在地生活文化句
            </button>
          </div>

          <div class="snack-sentence-display" id="snack-sentence-display">
            ${this.renderActiveSentenceContent(snack)}
          </div>
        </div>

        <!-- Action Footer -->
        <div class="snack-modal-actions">
          <button class="btn btn-outline" onclick="window.app.toggleBookmark(${snack.id || 9999}, '${snack.hz}', '${snack.tl}', '${snack.mandarin}')">
            ⭐ 收藏至生詞本
          </button>
          <button class="btn btn-primary" onclick="window.snackMap.registerToSRS(${snack.id})">
            🧠 納入 SM-2 每日間隔複習
          </button>
          <button class="btn btn-outline" onclick="window.snackMap.applyToBuilder(${snack.id})">
            🏮 帶入點餐產生器
          </button>
        </div>
      </div>
    `;

    modal.classList.add('show');
  }

  renderActiveSentenceContent(snack) {
    const s = snack.sentences[this.activeSentenceTab];
    if (!s) return '';

    let tagLabel = '💬 點餐情境對話';
    if (this.activeSentenceTab === 'tasting') tagLabel = '👅 道地風味與口感形容';
    else if (this.activeSentenceTab === 'lore') tagLabel = '📜 文化情境與生活俗諺';

    return `
      <div class="sentence-box">
        <div class="sent-top-bar">
          <span class="sent-type-badge">${tagLabel}</span>
          <button class="btn btn-sm btn-primary" onclick="window.snackMap.speakSentence('${s.hz}', '${s.tl}')">
            🔊 聆聽整句發音
          </button>
        </div>
        <div class="sent-hz">${s.hz}</div>
        <div class="sent-tl">${s.tl}</div>
        <div class="sent-m">${s.m}</div>
      </div>
    `;
  }

  switchSentenceTab(tab) {
    this.activeSentenceTab = tab;
    document.querySelectorAll('.snack-sent-tab').forEach(b => b.classList.remove('active'));
    const clicked = Array.from(document.querySelectorAll('.snack-sent-tab')).find(b => b.onclick.toString().includes(tab));
    if (clicked) clicked.classList.add('active');

    const disp = document.getElementById('snack-sentence-display');
    if (disp && this.selectedSnack) {
      disp.innerHTML = this.renderActiveSentenceContent(this.selectedSnack);
    }
  }

  closeSnackModal() {
    const modal = document.getElementById('snack-detail-modal');
    if (modal) modal.classList.remove('show');
    this.selectedSnack = null;
  }

  applyToBuilder(snackId) {
    this.closeSnackModal();
    this.updateBuilder('snackId', snackId);
    const builder = document.getElementById('snack-ordering-builder');
    if (builder) {
      builder.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // --- Audio & TTS ---
  playSnackAudio(id, hz, btn) {
    const snack = this.snacks.find(s => s.id === id);
    if (snack && snack.audio_id && window.audioManager) {
      window.audioManager.playWord(snack.audio_id, hz, btn);
    } else {
      this.speakSentence(hz, snack?.tl || '');
    }
  }

  speakSentence(hz, tl) {
    // 1. Try Browser Speech Synthesis if supported
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(hz);
      // Prefer Taiwanese/Min or Chinese voice
      const voices = window.speechSynthesis.getVoices();
      const zhTwVoice = voices.find(v => v.lang === 'zh-TW' || v.lang === 'nan' || v.lang.includes('TW'));
      if (zhTwVoice) u.voice = zhTwVoice;
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }

    // 2. Play subtle pleasant Web Audio tone indicator
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}

    window.app?.showToast(`正在播放：${hz}`, 'info');
  }

  copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      window.app?.showToast('例句已複製到剪貼簿！', 'success');
    }
  }

  async registerToSRS(snackId) {
    const snack = this.snacks.find(s => s.id === snackId);
    if (!snack) return;

    const vocabItem = {
      id: 90000 + snack.id,
      hz: snack.hz,
      tl: snack.tl,
      def: `${snack.city}在地小吃：${snack.mandarin}`
    };

    await window.srsEngine.registerVocabList([vocabItem]);
    window.app?.showToast(`已將「${snack.hz}」登錄至每日 SM-2 間隔複習佇列！`, 'success');
  }

  async addCustomToSRS(snackName, sentenceHz, sentenceTl) {
    const vocabItem = {
      id: 95000 + Math.floor(Math.random() * 1000),
      hz: sentenceHz,
      tl: sentenceTl,
      def: `夜市實戰點餐例句 (${snackName})`
    };

    await window.srsEngine.registerVocabList([vocabItem]);
    window.app?.showToast(`已將點餐客製例句加入 SM-2 複習佇列！`, 'success');
  }
}

window.snackMap = new SnackMapManager();
