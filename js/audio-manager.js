/**
 * audio-manager.js - Audio player, offline caching & audio package importer
 * 咱的台語 - Lán ê Tâi-gí
 */

class AudioManager {
  constructor() {
    this.currentAudio = null;
    this.currentBtn = null;
    this.bundledAudioIds = new Set();
    this.loadBundledAudioList();
  }

  async loadBundledAudioList() {
    // List of bundled audio IDs (cached locally in ./audio/)
    // These IDs play 100% offline out of the box
    try {
      const resp = await fetch('data/lessons_data.json');
      const lessons = await resp.json();
      lessons.forEach(l => {
        l.vocab.forEach(v => {
          if (v.id) this.bundledAudioIds.add(String(v.id));
        });
      });
    } catch (e) {
      console.warn('Failed to load bundled audio list:', e);
    }
  }

  async playWord(wordId, audioName = '', btnElement = null) {
    if (!wordId) return;
    const widStr = String(wordId);

    // If currently playing the same audio, pause it
    if (this.currentAudio && this.currentAudio._wordId === widStr && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.resetButton(btnElement);
      return;
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.resetButton(this.currentBtn);
    }

    this.currentBtn = btnElement;
    this.setButtonPlaying(btnElement);

    try {
      // 1. Check if user imported audio blob in IndexedDB
      const blob = await window.storage.getAudioBlob(widStr);
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        this.playAudioUrl(blobUrl, widStr, btnElement, () => URL.revokeObjectURL(blobUrl));
        return;
      }

      // 2. Check if local bundled audio exists
      if (this.bundledAudioIds.has(widStr)) {
        const localUrl = `audio/${widStr}.mp3`;
        this.playAudioUrl(localUrl, widStr, btnElement);
        return;
      }

      // 3. Official Ministry of Education Online Audio URL
      const dir = Math.floor(parseInt(wordId) / 1000);
      const onlineUrl = `https://sutian.moe.edu.tw/media/senn/mp3/imtong/subak/${dir}/${widStr}.mp3`;

      // Try loading audio (Service Worker will cache if online, or return cached if previously played)
      this.playAudioUrl(onlineUrl, widStr, btnElement, null, () => {
        // Fallback if offline and no audio file available
        console.log('Audio file unavailable, falling back to Web Speech or Tone Synth');
        this.resetButton(btnElement);
        this.speechFallback(audioName || '');
      });

    } catch (err) {
      console.warn('Play error:', err);
      this.resetButton(btnElement);
    }
  }

  playAudioUrl(url, id, btnElement, onEndedCleanup = null, onErrorFallback = null) {
    const audio = new Audio();
    audio.src = url;
    audio._wordId = id;
    this.currentAudio = audio;

    audio.onended = () => {
      this.resetButton(btnElement);
      if (onEndedCleanup) onEndedCleanup();
    };

    audio.onerror = (e) => {
      this.resetButton(btnElement);
      if (onEndedCleanup) onEndedCleanup();
      if (onErrorFallback) {
        onErrorFallback();
      } else {
        window.app?.showToast('此音檔需網路連線或匯入離線語音包', 'info');
      }
    };

    audio.play().catch((err) => {
      console.warn('Audio play prevented:', err);
      this.resetButton(btnElement);
      if (onErrorFallback) onErrorFallback();
    });
  }

  speechFallback(text) {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-TW';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  }

  setButtonPlaying(btn) {
    if (!btn) return;
    btn.classList.add('is-playing');
    const icon = btn.querySelector('.audio-icon');
    if (icon) {
      icon.innerHTML = `
        <svg class="playing-waves" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <rect x="3" y="9" width="3" height="6" rx="1"><animate attributeName="height" values="6;16;6" dur="0.8s" repeatCount="indefinite"/><animate attributeName="y" values="9;4;9" dur="0.8s" repeatCount="indefinite"/></rect>
          <rect x="8.5" y="6" width="3" height="12" rx="1"><animate attributeName="height" values="12;20;12" dur="0.8s" begin="0.2s" repeatCount="indefinite"/><animate attributeName="y" values="6;2;6" dur="0.8s" begin="0.2s" repeatCount="indefinite"/></rect>
          <rect x="14" y="8" width="3" height="8" rx="1"><animate attributeName="height" values="8;18;8" dur="0.8s" begin="0.4s" repeatCount="indefinite"/><animate attributeName="y" values="8;3;8" dur="0.8s" begin="0.4s" repeatCount="indefinite"/></rect>
          <rect x="19.5" y="10" width="3" height="4" rx="1"><animate attributeName="height" values="4;14;4" dur="0.8s" begin="0.1s" repeatCount="indefinite"/><animate attributeName="y" values="10;5;10" dur="0.8s" begin="0.1s" repeatCount="indefinite"/></rect>
        </svg>
      `;
    }
  }

  resetButton(btn) {
    if (!btn) return;
    btn.classList.remove('is-playing');
    const icon = btn.querySelector('.audio-icon');
    if (icon) {
      icon.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      `;
    }
  }

  // --- Import Offline Audio ZIP (sutiau-mp3.zip) ---
  async importZipFile(file, onProgress, onComplete, onError) {
    if (!window.JSZip) {
      if (onError) onError('JSZip 庫尚未載入');
      return;
    }

    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      const fileNames = Object.keys(zipContent.files).filter(name => name.endsWith('.mp3'));
      const total = fileNames.length;
      if (total === 0) {
        if (onError) onError('ZIP 壓縮檔內沒有找到 .mp3 音檔');
        return;
      }

      let imported = 0;
      const batchSize = 50;

      for (let i = 0; i < total; i += batchSize) {
        const batch = fileNames.slice(i, i + batchSize);
        await Promise.all(batch.map(async (fn) => {
          const fileObj = zipContent.files[fn];
          if (fileObj && !fileObj.dir) {
            const blob = await fileObj.async('blob');
            // extract ID from filename e.g. "0/1(1).mp3" -> "1"
            const match = fn.match(/(\d+)(?:\(\d+\))?\.mp3$/);
            if (match) {
              const wid = match[1];
              await window.storage.saveAudioBlob(wid, blob);
            }
          }
        }));

        imported += batch.length;
        if (onProgress) {
          onProgress(imported, total, Math.round((imported / total) * 100));
        }
      }

      if (onComplete) onComplete(total);
    } catch (err) {
      console.error('ZIP import error:', err);
      if (onError) onError(err.message || '解壓縮失敗');
    }
  }
}

window.audioManager = new AudioManager();
