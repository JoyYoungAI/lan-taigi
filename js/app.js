/**
 * app.js - Main Application Coordinator, Router & PWA Handler
 * 咱的台語 - Lán ê Tâi-gí
 */

class App {
  constructor() {
    this.currentTab = 'lessons';
    this.isOnline = navigator.onLine;
    this.fontSizeLevel = 1; // 0: standard, 1: medium, 2: large
    this.theme = 'light';
    this.deferredPrompt = null;

    this.init();
  }

  async init() {
    this.initServiceWorker();
    this.initNetworkStatus();
    this.initThemeAndFont();
    this.initNavigation();
    this.initPWAInstall();
    this.initKeyboardShortcuts();
    this.updateOfflineStats();

    // Check URL hash for routing
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`nav-${hash}`)) {
      this.switchNav(hash);
    }
  }

  // --- Service Worker & PWA ---
  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[App] Service Worker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[App] Service Worker registration failed:', err);
          });
      });
    }
  }

  initNetworkStatus() {
    const updateStatus = () => {
      this.isOnline = navigator.onLine;
      const badge = document.getElementById('offline-status-badge');
      if (badge) {
        if (this.isOnline) {
          badge.className = 'status-badge online';
          badge.innerHTML = `<span class="dot"></span><span>100% 離線可用</span>`;
        } else {
          badge.className = 'status-badge offline';
          badge.innerHTML = `<span class="dot"></span><span>離線模式</span>`;
        }
      }
    };

    window.addEventListener('online', () => {
      updateStatus();
      this.showToast('網路已恢復連線', 'success');
    });

    window.addEventListener('offline', () => {
      updateStatus();
      this.showToast('已切換至全離線模式，辭典與教學課程皆可正常使用！', 'info');
    });

    updateStatus();
  }

  initPWAInstall() {
    const btn = document.getElementById('pwa-install-btn');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (btn) btn.style.display = 'inline-flex';
    });

    if (btn) {
      btn.addEventListener('click', async () => {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          const { outcome } = await this.deferredPrompt.userChoice;
          console.log(`PWA install outcome: ${outcome}`);
          this.deferredPrompt = null;
          btn.style.display = 'none';
        } else {
          this.showToast('您可透過瀏覽器選單「加到主畫面」安裝本 App', 'info');
        }
      });
    }
  }

  // --- Navigation & Routing ---
  initNavigation() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.dataset.tab;
        this.switchNav(tab);
      });
    });
  }

  switchNav(tab) {
    this.currentTab = tab;
    window.location.hash = tab;

    // Update active nav links
    document.querySelectorAll('[data-tab]').forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update sections
    document.querySelectorAll('.app-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSec = document.getElementById(`section-${tab}`);
    if (targetSec) {
      targetSec.classList.add('active');
    }

    // Trigger specific tab logic
    if (tab === 'lessons') {
      window.levelMap?.renderDashboard();
      if (window.levelMap && window.levelMap.currentViewMode === 'map') {
        window.levelMap.renderMap();
      }
    } else if (tab === 'snacks') {
      window.snackMap?.render();
    } else if (tab === 'bookmarks') {
      this.renderBookmarks();
    } else if (tab === 'mandarin') {
      window.dictManager?.loadMandarinComparison();
    } else if (tab === 'dialects') {
      this.renderDialects();
    } else if (tab === 'surnames') {
      window.dictManager?.loadSurnames();
    } else if (tab === 'settings') {
      this.updateOfflineStats();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Theme & Font Size ---
  initThemeAndFont() {
    const savedTheme = window.storage.getPref('theme', 'light');
    this.setTheme(savedTheme);

    const savedFont = window.storage.getPref('font_size', 1);
    this.setFontSize(savedFont);

    const themeToggle = document.getElementById('theme-toggle-btn');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const next = this.theme === 'light' ? 'dark' : 'light';
        this.setTheme(next);
      });
    }

    const fontBtn = document.getElementById('font-scale-btn');
    if (fontBtn) {
      fontBtn.addEventListener('click', () => {
        const next = (this.fontSizeLevel + 1) % 3;
        this.setFontSize(next);
      });
    }
  }

  setTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    window.storage.setPref('theme', theme);
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
      icon.innerHTML = theme === 'dark' 
        ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`;
    }
  }

  setFontSize(level) {
    this.fontSizeLevel = level;
    document.documentElement.setAttribute('data-font-size', ['sm', 'md', 'lg'][level]);
    window.storage.setPref('font_size', level);
    const label = document.getElementById('font-scale-label');
    if (label) {
      label.textContent = ['標準', '中字', '大字'][level];
    }
  }

  // --- Bookmarks ---
  async toggleBookmark(id, hz, tl, def) {
    const isNowBookmarked = await window.storage.toggleBookmark({ id, hz, tl, def });
    if (isNowBookmarked) {
      this.showToast(`已收藏「${hz}」到生詞本`, 'success');
    } else {
      this.showToast(`已從生詞本移除「${hz}」`, 'info');
    }
    if (this.currentTab === 'bookmarks') {
      this.renderBookmarks();
    }
  }

  async renderBookmarks() {
    const container = document.getElementById('bookmarks-list-container');
    if (!container) return;

    const list = await window.storage.getBookmarks();
    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⭐</div>
          <h3>生詞本目前是空的</h3>
          <p>在課程或辭典中點擊星星圖示，即可將生詞收藏到這裡複習！</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="bookmarks-grid">
        ${list.map(b => `
          <div class="bookmark-card" onclick="window.dictManager.showWordModal(${b.id})">
            <div class="bm-header">
              <span class="bm-hz">${b.hz}</span>
              <button class="icon-btn" onclick="event.stopPropagation(); window.app.toggleBookmark(${b.id}, '${b.hz}', '${b.tl}', '${b.def}')" title="取消收藏">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffb300"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              </button>
            </div>
            <div class="bm-tl">${b.tl}</div>
            <div class="bm-def">${b.def || ''}</div>
            <div class="bm-actions">
              <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); window.audioManager.playWord(${b.id}, '${b.hz}', this)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                發音
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // --- Dialects Comparison Tab ---
  async renderDialects() {
    const container = document.getElementById('dialects-table-container');
    if (!container) return;

    try {
      const resp = await fetch('data/dialects.json');
      const dialects = await resp.json();

      container.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>詞目漢字</th>
                <th>鹿港(偏泉)</th>
                <th>三峽(偏泉)</th>
                <th>臺北(偏泉)</th>
                <th>宜蘭(偏漳)</th>
                <th>臺南(混合)</th>
                <th>高雄(混合)</th>
                <th>金門(偏泉)</th>
                <th>新竹(偏泉)</th>
                <th>臺中(偏漳)</th>
              </tr>
            </thead>
            <tbody>
              ${dialects.slice(0, 100).map(d => `
                <tr onclick="window.dictManager.showWordModal(${d.id})" style="cursor:pointer;">
                  <td><strong class="hz-highlight">${d.hz}</strong></td>
                  <td>${d.lok || '-'}</td>
                  <td>${d.san || '-'}</td>
                  <td>${d.tpe || '-'}</td>
                  <td>${d.ila || '-'}</td>
                  <td>${d.tnn || '-'}</td>
                  <td>${d.kao || '-'}</td>
                  <td>${d.kmn || '-'}</td>
                  <td>${d.hsz || '-'}</td>
                  <td>${d.txg || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p class="table-note">共收錄 ${dialects.length} 條涵蓋台灣各大腔調之語音差異詞目，點擊任一列可開啟詳細釋義。</p>
      `;
    } catch (e) {
      console.error('Failed to load dialects:', e);
    }
  }

  // --- Offline Audio Zip Importer ---
  async handleZipImport(input) {
    const file = input.files[0];
    if (!file) return;

    const progressBox = document.getElementById('zip-import-progress-box');
    const progressBar = document.getElementById('zip-import-progress-bar');
    const progressText = document.getElementById('zip-import-progress-text');

    if (progressBox) progressBox.style.display = 'block';

    window.audioManager.importZipFile(
      file,
      (current, total, pct) => {
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `解壓縮匯入中：${current} / ${total} (${pct}%)`;
      },
      (total) => {
        if (progressText) progressText.textContent = `🎉 匯入完成！已儲存 ${total} 條離線發音！`;
        this.showToast(`成功匯入 ${total} 條離線發音！`, 'success');
        this.updateOfflineStats();
      },
      (err) => {
        this.showToast(`匯入失敗：${err}`, 'error');
        if (progressBox) progressBox.style.display = 'none';
      }
    );
  }

  async updateOfflineStats() {
    const audioCountEl = document.getElementById('offline-audio-count');
    if (audioCountEl) {
      const customCount = await window.storage.countAudioBlobs();
      audioCountEl.textContent = `內建核心音檔：100 首 | 本地已匯入音檔：${customCount} 首`;
    }
  }

  // --- Toast Notifications ---
  showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `app-toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // --- License Modal ---
  showLicenseModal() {
    const modal = document.getElementById('license-modal');
    if (modal) modal.classList.add('show');
  }

  closeLicenseModal() {
    const modal = document.getElementById('license-modal');
    if (modal) modal.classList.remove('show');
  }

  // --- Keyboard Shortcuts ---
  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.switchNav('dict');
        const input = document.getElementById('dict-search-input');
        if (input) input.focus();
      } else if (e.key === 'Escape') {
        window.dictManager?.closeModal();
        this.closeLicenseModal();
      }
    });
  }
}

window.app = new App();

