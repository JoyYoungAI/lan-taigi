/**
 * speech-evaluator.js - 100% Offline Web Audio Speech Pitch Tracker & Tone Evaluator
 * 咱的台語 - Lán ê Tâi-gí
 */

class SpeechEvaluator {
  constructor() {
    this.audioCtx = null;
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.userAudioUrl = null;
    this.isRecording = false;

    this.analyser = null;
    this.pitchPoints = [];
    this.animFrameId = null;

    // Standard Taiwanese 7 Tones ideal 5-point contour targets
    this.canonicalContours = {
      1: [5.0, 5.0, 5.0, 5.0, 5.0], // 55 高平
      2: [5.0, 4.2, 3.2, 2.0, 1.0], // 51 高降
      3: [3.0, 2.6, 2.2, 1.6, 1.0], // 31 低降
      4: [2.0, 1.8, 1.4, 1.0],      // 21 短促低入
      5: [1.8, 2.2, 2.8, 3.5, 4.2], // 24 低升
      7: [3.2, 3.2, 3.2, 3.2, 3.2], // 33 中平
      8: [5.0, 4.4, 3.6, 3.0]       // 53 短促高入
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

  // --- Autocorrelation Pitch Detection Algorithm ---
  // Detects fundamental frequency F0 between minFreq (70Hz) and maxFreq (450Hz)
  detectPitch(buffer, sampleRate) {
    const SIZE = buffer.length;
    let sum = 0;
    for (let i = 0; i < SIZE; i++) {
      sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / SIZE);
    // Ignore silence or low energy
    if (rms < 0.015) return -1;

    let r1 = 0, r2 = SIZE - 1;
    const thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    const trimmedBuffer = buffer.slice(r1, r2);
    const c = new Float32Array(trimmedBuffer.length).fill(0);

    for (let i = 0; i < trimmedBuffer.length; i++) {
      for (let j = 0; j < trimmedBuffer.length - i; j++) {
        c[i] = c[i] + trimmedBuffer[j] * trimmedBuffer[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < trimmedBuffer.length; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    let T0 = maxpos;
    if (T0 === 0) return -1;

    // Parabolic interpolation for fine accuracy
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    const freq = sampleRate / T0;
    if (freq >= 70 && freq <= 450) {
      return freq;
    }
    return -1;
  }

  // --- Start Recording & Pitch Tracking ---
  async startRecording(canvasId, targetTone, onStopCallback = null) {
    if (this.isRecording) return;
    this.recordedChunks = [];
    this.pitchPoints = [];
    if (this.userAudioUrl) {
      URL.revokeObjectURL(this.userAudioUrl);
      this.userAudioUrl = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      this.mediaStream = stream;

      const ctx = this.getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      // MediaRecorder for raw audio replay
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.userAudioUrl = URL.createObjectURL(blob);
        const evalResult = this.evaluateTone(this.pitchPoints, targetTone);
        if (onStopCallback) onStopCallback(evalResult, this.userAudioUrl);
      };
      this.mediaRecorder.start(50);
      this.isRecording = true;

      // Start Real-time Pitch Visualizer Loop
      this.trackPitchLoop(canvasId, targetTone);

    } catch (err) {
      console.error('Microphone access denied:', err);
      window.app?.showToast('無法啟用麥克風，請檢查瀏覽器錄音權限！', 'error');
    }
  }

  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  trackPitchLoop(canvasId, targetTone) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !this.isRecording) return;
    const ctx2d = canvas.getContext('2d');
    const buffer = new Float32Array(this.analyser.fftSize);

    const loop = () => {
      if (!this.isRecording) return;
      this.analyser.getFloatTimeDomainData(buffer);
      const pitch = this.detectPitch(buffer, this.audioCtx.sampleRate);
      if (pitch > 0) {
        this.pitchPoints.push(pitch);
      }

      this.renderPitchCanvas(canvas, ctx2d, this.pitchPoints, targetTone);
      this.animFrameId = requestAnimationFrame(loop);
    };

    loop();
  }

  // --- Dynamic Pitch Contour Evaluation Algorithm ---
  evaluateTone(pitchPoints, targetTone) {
    targetTone = parseInt(targetTone) || 1;
    const ideal = this.canonicalContours[targetTone] || this.canonicalContours[1];

    if (!pitchPoints || pitchPoints.length < 5) {
      return {
        score: 30,
        grade: '需加強',
        feedback: '未偵測到足夠音量或發音時間太短，請靠近麥克風再試一次！',
        pitchContour: []
      };
    }

    // Filter outliers & smoothing (moving average)
    const smoothed = [];
    const windowSize = 3;
    for (let i = 0; i < pitchPoints.length; i++) {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(pitchPoints.length - 1, i + windowSize); j++) {
        sum += pitchPoints[j];
        count++;
      }
      smoothed.push(sum / count);
    }

    // Normalize user's pitch range to 1.0 ~ 5.0 scale
    const minP = Math.min(...smoothed);
    const maxP = Math.max(...smoothed);
    const range = Math.max(maxP - minP, 25); // avoid divide by zero

    // Resample smoothed pitch into same length as ideal (5 points)
    const userResampled = [];
    const step = (smoothed.length - 1) / (ideal.length - 1);
    for (let i = 0; i < ideal.length; i++) {
      const idx = Math.min(Math.round(i * step), smoothed.length - 1);
      const rawVal = smoothed[idx];
      // map to 1.0 ~ 5.0
      const normVal = 1.0 + ((rawVal - minP) / range) * 4.0;
      userResampled.push(parseFloat(normVal.toFixed(2)));
    }

    // Calculate Contour Slope Match (Direction)
    let slopeMatch = 0;
    for (let i = 0; i < ideal.length - 1; i++) {
      const idealSlope = ideal[i + 1] - ideal[i];
      const userSlope = userResampled[i + 1] - userResampled[i];

      // Sign agreement (both rising, both falling, both flat)
      if ((idealSlope > 0.3 && userSlope > 0.2) ||
          (idealSlope < -0.3 && userSlope < -0.2) ||
          (Math.abs(idealSlope) <= 0.3 && Math.abs(userSlope) <= 0.5)) {
        slopeMatch += 1;
      }
    }
    const directionScore = (slopeMatch / (ideal.length - 1)) * 50;

    // Calculate Mean Squared Error of normalized curve
    let mse = 0;
    for (let i = 0; i < ideal.length; i++) {
      mse += Math.pow(ideal[i] - userResampled[i], 2);
    }
    mse = mse / ideal.length;
    const curveScore = Math.max(0, 50 - mse * 8);

    const totalScore = Math.min(100, Math.max(40, Math.round(directionScore + curveScore + 15)));

    let grade = '良好', feedback = '發音調型掌握到位！';
    if (totalScore >= 88) {
      grade = '完美 (A+)';
      feedback = '太道地了！聲調高低起伏與音高軌跡非常標準！';
    } else if (totalScore >= 75) {
      grade = '優秀 (A)';
      feedback = '聲調走向非常精準，細微轉音掌握得很好！';
    } else if (totalScore >= 60) {
      grade = '及格 (B)';
      feedback = '調型大致正確，注意高音拉高、降音到位會更傳神！';
    } else {
      grade = '加油 (C)';
      feedback = '請注意該聲調的起伏走向（如高平、高降或低升），對照標準音再試一次！';
    }

    return {
      score: totalScore,
      grade,
      feedback,
      userContour: userResampled,
      idealContour: ideal
    };
  }

  // --- Render Dynamic Pitch Contour on Canvas ---
  renderPitchCanvas(canvas, ctx, points, targetTone) {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 1. Draw 5-level pitch reference grid (1 to 5)
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 1; i <= 5; i++) {
      const y = H - (i / 5) * (H - 40) - 20;
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(W - 15, y);
      ctx.stroke();

      ctx.fillStyle = '#888';
      ctx.font = '10px sans-serif';
      ctx.fillText(i + '度', 10, y + 3);
    }
    ctx.setLineDash([]);

    // 2. Draw Ideal Target Contour (Gold dashed line)
    const ideal = this.canonicalContours[targetTone] || this.canonicalContours[1];
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ideal.forEach((val, i) => {
      const x = 50 + (i / (ideal.length - 1)) * (W - 80);
      const y = H - (val / 5) * (H - 40) - 20;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Draw User Recorded Pitch Trail (Vibrant Blue/Green solid line)
    if (points && points.length > 1) {
      const minP = Math.min(...points);
      const maxP = Math.max(...points);
      const range = Math.max(maxP - minP, 25);

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const step = (W - 80) / Math.max(points.length - 1, 1);
      points.forEach((rawP, i) => {
        const normVal = 1.0 + ((rawP - minP) / range) * 4.0;
        const x = 50 + i * step;
        const y = H - (normVal / 5) * (H - 40) - 20;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Current pulse head
      const lastX = 50 + (points.length - 1) * step;
      const lastVal = 1.0 + ((points[points.length - 1] - minP) / range) * 4.0;
      const lastY = H - (lastVal / 5) * (H - 40) - 20;
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Play user recorded audio
  playUserAudio() {
    if (!this.userAudioUrl) return;
    const a = new Audio(this.userAudioUrl);
    a.play();
  }
}

window.speechEvaluator = new SpeechEvaluator();
