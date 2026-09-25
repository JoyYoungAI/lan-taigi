/**
 * tone-synth.js - Web Audio API Tone Pitch Synthesizer & Visualizer
 * 咱的台語 - Lán ê Tâi-gí
 */

class ToneSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.toneConfigs = {
      1: { name: '第1聲 (陰平)', contour: '高平調', pitch: '55', startFreq: 260, endFreq: 260, duration: 0.5, desc: '音高平直高亢，如唱歌高音。' },
      2: { name: '第2聲 (陰上)', contour: '高降調', pitch: '51', startFreq: 275, endFreq: 170, duration: 0.45, desc: '由高驟降，如感嘆句「啊！」。' },
      3: { name: '第3聲 (陰去)', contour: '低降調', pitch: '31', startFreq: 200, endFreq: 145, duration: 0.45, desc: '低沉微降，平穩低緩。' },
      4: { name: '第4聲 (陰入)', contour: '低促調', pitch: '21', startFreq: 195, endFreq: 175, duration: 0.12, isChecked: true, desc: '短促急收，以 -p, -t, -k, -h 結尾。' },
      5: { name: '第5聲 (陽平)', contour: '低升調', pitch: '24', startFreq: 170, endFreq: 235, duration: 0.5, desc: '由低上揚，如疑問句「咦？」。' },
      7: { name: '第7聲 (陽去)', contour: '中平調', pitch: '33', startFreq: 210, endFreq: 210, duration: 0.45, desc: '居中平穩，不高不低。' },
      8: { name: '第8聲 (陽入)', contour: '高促調', pitch: '53', startFreq: 265, endFreq: 225, duration: 0.12, isChecked: true, desc: '高亢短促急收，帶塞音尾。' }
    };
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play synthesized tone pitch contour
  playTone(toneNumber, onProgress = null) {
    const config = this.toneConfigs[toneNumber];
    if (!config) return;

    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Gentle vocal-like warmth (warm sine/triangle wave)
      osc.type = 'sine';

      const now = ctx.currentTime;
      const dur = config.duration;

      // Frequency Ramp (Linear or Exponential pitch contour)
      osc.frequency.setValueAtTime(config.startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(config.endFreq, 50), now + dur);

      // Volume Envelope (Attack, Decay, Sustain, Release)
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
      if (config.isChecked) {
        // Fast drop for checked tone
        gain.gain.setValueAtTime(0.25, now + dur - 0.02);
        gain.gain.linearRampToValueAtTime(0, now + dur);
      } else {
        gain.gain.setValueAtTime(0.25, now + dur * 0.7);
        gain.gain.linearRampToValueAtTime(0, now + dur);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + dur);

      if (onProgress) {
        onProgress(0);
        const startTime = Date.now();
        const interval = setInterval(() => {
          const elapsed = (Date.now() - startTime) / (dur * 1000);
          if (elapsed >= 1) {
            clearInterval(interval);
            onProgress(1);
          } else {
            onProgress(elapsed);
          }
        }, 30);
      }
    } catch (e) {
      console.warn('Tone synth error:', e);
    }
  }

  // Tone Sandhi calculation: 5 -> 7 -> 3 -> 2 -> 1 -> 7
  calculateSandhi(toneNumber, isStopEnding = false) {
    toneNumber = parseInt(toneNumber);
    if (isStopEnding) {
      // Checked tones
      if (toneNumber === 4) return { nextTone: 8, rule: '第4聲(低入) ➔ 變為 第8聲(高入)' };
      if (toneNumber === 8) return { nextTone: 4, rule: '第8聲(高入) ➔ 變為 第4聲(低入)' };
    }
    switch (toneNumber) {
      case 5: return { nextTone: 7, rule: '第5聲(低升: 24) ➔ 變為 第7聲(中平: 33)' };
      case 7: return { nextTone: 3, rule: '第7聲(中平: 33) ➔ 變為 第3聲(低降: 31)' };
      case 3: return { nextTone: 2, rule: '第3聲(低降: 31) ➔ 變為 第2聲(高降: 51)' };
      case 2: return { nextTone: 1, rule: '第2聲(高降: 51) ➔ 變為 第1聲(高平: 55)' };
      case 1: return { nextTone: 7, rule: '第1聲(高平: 55) ➔ 變為 第7聲(中平: 33)' };
      case 4: return { nextTone: 8, rule: '第4聲(低入: 21) ➔ 變為 第8聲(高入: 53)' };
      case 8: return { nextTone: 4, rule: '第8聲(高入: 53) ➔ 變為 第4聲(低入: 21)' };
      default: return { nextTone: toneNumber, rule: '輕聲或特殊讀音' };
    }
  }

  // Render SVG Pitch Contour Chart
  renderToneChart(container, selectedTone = 1) {
    if (!container) return;
    
    const tones = [
      { id: 1, name: '1 陰平 [55]', path: 'M 40 50 L 220 50', color: '#2e7d32' },
      { id: 2, name: '2 陰上 [51]', path: 'M 40 50 L 220 250', color: '#c2185b' },
      { id: 3, name: '3 陰去 [31]', path: 'M 40 150 L 220 250', color: '#e65100' },
      { id: 4, name: '4 陰入 [21]', path: 'M 40 200 L 90 250', color: '#6a1b9a', isShort: true },
      { id: 5, name: '5 陽平 [24]', path: 'M 40 200 L 220 100', color: '#0277bd' },
      { id: 7, name: '7 陽去 [33]', path: 'M 40 150 L 220 150', color: '#f57f17' },
      { id: 8, name: '8 陽入 [53]', path: 'M 40 50 L 90 150', color: '#00838f', isShort: true }
    ];

    let svg = `
      <svg class="tone-chart-svg" viewBox="0 0 340 300" width="100%" height="280">
        <!-- Coordinate Grid 1 to 5 levels -->
        <line x1="40" y1="50" x2="300" y2="50" stroke="var(--border-light)" stroke-dasharray="3 3"/>
        <text x="25" y="55" font-size="12" fill="var(--text-muted)" text-anchor="middle">5 (高)</text>
        
        <line x1="40" y1="100" x2="300" y2="100" stroke="var(--border-light)" stroke-dasharray="3 3"/>
        <text x="25" y="105" font-size="12" fill="var(--text-muted)" text-anchor="middle">4 (半高)</text>

        <line x1="40" y1="150" x2="300" y2="150" stroke="var(--border-light)" stroke-dasharray="3 3"/>
        <text x="25" y="155" font-size="12" fill="var(--text-muted)" text-anchor="middle">3 (中)</text>

        <line x1="40" y1="200" x2="300" y2="200" stroke="var(--border-light)" stroke-dasharray="3 3"/>
        <text x="25" y="205" font-size="12" fill="var(--text-muted)" text-anchor="middle">2 (半低)</text>

        <line x1="40" y1="250" x2="300" y2="250" stroke="var(--border-color)" stroke-width="1.5"/>
        <text x="25" y="255" font-size="12" fill="var(--text-muted)" text-anchor="middle">1 (低)</text>
    `;

    // Render tone paths
    tones.forEach(t => {
      const isSel = (t.id === parseInt(selectedTone));
      const opacity = isSel ? '1' : '0.22';
      const strokeW = isSel ? '5' : '2.5';
      svg += `
        <g class="tone-path-group" data-tone="${t.id}" style="cursor:pointer;">
          <path d="${t.path}" fill="none" stroke="${t.color}" stroke-width="${strokeW}" opacity="${opacity}" stroke-linecap="round"/>
          <text x="${t.isShort ? 105 : 230}" y="${t.id === 1 ? 46 : (t.id === 7 ? 146 : 100)}" fill="${t.color}" font-size="11" font-weight="${isSel ? 'bold' : 'normal'}" opacity="${isSel ? '1' : '0.4'}">
            ${isSel ? t.name : t.id}
          </text>
        </g>
      `;
    });

    svg += `</svg>`;
    container.innerHTML = svg;

    // Attach click listeners to paths
    container.querySelectorAll('.tone-path-group').forEach(grp => {
      grp.addEventListener('click', () => {
        const toneId = parseInt(grp.dataset.tone);
        this.playTone(toneId);
        this.renderToneChart(container, toneId);
        // trigger global event
        window.dispatchEvent(new CustomEvent('tone-selected', { detail: { toneId } }));
      });
    });
  }
}

window.toneSynth = new ToneSynthesizer();
