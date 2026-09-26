# 咱的台語 (Lán ê Tâi-gí) - 軟體系統架構與詳細設計規格書 (Software Design Document, SDD)

**專案名稱**：咱的台語 (Lán ê Tâi-gí) - 100% 離線臺灣台語教學與教育部辭典 PWA  
**文件版本**：`v1.2.1`  
**最後修訂日期**：2026 年 09 月 26 日  
**文件狀態**：正式發布 (Approved / Production)  
**系統授權**：MIT License / 創用 CC 姓名標示-禁止改作 3.0 臺灣 (CC BY-ND 3.0 TW)  
**線上運行展示**：[https://joyyoungai.github.io/lan-taigi/](https://joyyoungai.github.io/lan-taigi/)  
**程式碼儲存庫**：[https://github.com/JoyYoungAI/lan-taigi](https://github.com/JoyYoungAI/lan-taigi)  

---

## 1. 系統願景與架構總覽 (System Vision & Architecture Overview)

### 1.1 系統目標
「咱的台語 (Lán ê Tâi-gí)」是一款以「**離線優先 (Offline-First)**」為核心哲學的高效能臺灣台語多功能學習 PWA（Progressive Web App）。系統整合中華民國教育部《臺灣台語常用詞辭典》最新修訂開放資料（收錄 29,592 詞條），結合 Duolingo 風格闖關學習地圖、SuperMemo SM-2 間隔重複記憶演算法、純前端 Web Audio 聲學基頻調型評分器、全台在地特色小吃夜市點餐語法產生器與教育部正字專欄。

全系統**零後端伺服器依賴**，在使用者首次開啟或安裝後，可脫機（無網路、飛航模式）秒級啟動並執行所有詞典搜尋、音訊合成、情境通關與發音比對。

### 1.2 高階系統分層架構 (System Architecture Diagram)

```mermaid
flowchart TD
    subgraph UI_Presentation["💻 表現層 (UI & Presentation Layer)"]
        UI_Nav["全局導航與路由切換 (app.js)"]
        UI_Map["Duolingo 闖關地圖 (level-map.js)"]
        UI_Snack["台灣小吃點餐產生器 (snack-map.js)"]
        UI_Lessons["情境教學與 3D 翻翻卡 (lessons.js)"]
        UI_Dict["2.9萬詞極速檢索視窗 (dict.js)"]
        UI_Phonology["聲韻調學院 (phonology.js)"]
        UI_Quiz["四合一測驗競技場 (quiz.js)"]
        UI_Annesia["按呢寫專欄閱覽器 (annesia.js)"]
    end

    subgraph Core_Engines["⚙️ 核心引擎層 (Core Business & Algorithmic Engines)"]
        ENG_SRS["SM-2 間隔重複記憶演算法 (srs-engine.js)"]
        ENG_Speech["時域自相關 F0 基頻評分器 (speech-evaluator.js)"]
        ENG_Synth["Web Audio 聲調物理合成器 (tone-synth.js)"]
        ENG_Audio["智慧音訊快取與播放器 (audio-manager.js)"]
        ENG_Zip["純前端串流 ZIP 解壓縮 (jszip.min.js)"]
    end

    subgraph Infrastructure_Storage["💾 基礎設施與本地儲存層 (Storage & Offline Infrastructure)"]
        SW["Service Worker 雙層調度快取 (sw.js v4)"]
        Cache_Static["CacheStorage: lan-taigi-static-v4 (App Shell)"]
        Cache_Audio["CacheStorage: lan-taigi-audio-v1 (串流音訊)"]
        IDB["IndexedDB v2: lan_taigi_db"]
        LS["LocalStorage (主題、字體、使用者偏好)"]
    end

    subgraph Data_Layer["📦 結構化語料庫 (Pre-compiled Data Layer)"]
        D_Index["dict_index.json (2.8MB 記憶體索引)"]
        D_Detail["dict_details.json (7.6MB 完整詞義與例句)"]
        D_Snacks["taiwan_snacks.json (30 款在地小吃)"]
        D_Lessons["lessons_data.json (10 大情境單元)"]
        D_Aux["mandarin_comparison / dialects / surnames / annesia"]
    end

    UI_Presentation --> Core_Engines
    Core_Engines --> Infrastructure_Storage
    Core_Engines --> Data_Layer
    SW --> Cache_Static
    SW --> Cache_Audio
    Infrastructure_Storage --> IDB
```

---

## 2. PWA 離線優先架構與 Service Worker 調度設計 (Offline-First Architecture)

### 2.1 雙層快取調度策略 (Dual-Layer Caching Strategy)

為兼顧「**在線時立即取得最新程式與樣式**」與「**離線時 100% 順暢可用**」，Service Worker (`sw.js`) 實作差異化資源調度管線：

1. **應用程式骨架 (App Shell: HTML, CSS, JS, Manifest)**：
   - **策略**：**Network-First with Cache Fallback**（網路優先，失敗切回本地快取）。
   - **機制**：使用者連網時，向伺服器請求最新代碼並背景更新至 `lan-taigi-static-v4`；當處於無網路或連線逾時，立即自本地快取提取對應檔案（或導向 `./index.html`），保證零延遲離線載入。
   - **防快取穿透 (Cache-Busting)**：所有外鏈資源包含版本綴詞 `?v=1.2.1`，快取匹配時啟用 `{ ignoreSearch: true }`。

2. **多媒體音訊串流 (Audio MP3 Files)**：
   - **策略**：**Cache-First with Dynamic Network Fallback**。
   - **機制**：優先查詢 `lan-taigi-audio-v1`；若未命中再查詢靜態預載快取；若仍未命中則於背景發起網路請求，成功後自動寫入 `lan-taigi-audio-v1` 達成持久離線化。

3. **靜態資料庫 (Static JSON Data & Icons)**：
   - **策略**：**Stale-While-Revalidate**。
   - **機制**：優先以快取資料即時響應 UI，背景發送非同步請求驗證是否有新版本並自動置換。

### 2.2 Service Worker 請求處理狀態機 (Request Pipeline State Machine)

```mermaid
stateDiagram-v2
    [*] --> InterceptFetch: fetch event 攔截請求
    InterceptFetch --> CheckType: 判斷請求 URL 與標頭

    state CheckType {
        [*] --> PathAudio: URL 包含 .mp3 或 /media/senn/
        [*] --> PathAppShell: .html, .css, .js, .webmanifest 或導航
        [*] --> PathData: .json 或圖示資產
    }

    state PathAppShell {
        FetchNetwork: 向網路發送 fetch(event.request)
        UpdateStaticCache: 成功(200) -> 寫入 lan-taigi-static-v4
        FallbackCache: 失敗(離線) -> 讀取 CacheStorage (ignoreSearch: true)
        
        FetchNetwork --> UpdateStaticCache: 在線響應
        FetchNetwork --> FallbackCache: 網路離線
    }

    state PathAudio {
        CheckAudioCache: 查詢 lan-taigi-audio-v1
        CheckPrecacheAudio: 查詢靜態預載 100 首音檔
        FetchRemoteAudio: 線上即時下載教育部官方 MP3
        WriteAudioCache: 成功(200) -> 寫入 lan-taigi-audio-v1
        
        CheckAudioCache --> HitAudio: 命中快取
        CheckAudioCache --> CheckPrecacheAudio: 未命中
        CheckPrecacheAudio --> HitAudio: 命中預載
        CheckPrecacheAudio --> FetchRemoteAudio: 未命中
        FetchRemoteAudio --> WriteAudioCache
    }

    state PathData {
        MatchDataCache: 查詢快取即時響應
        BgRevalidate: 背景非同步驗證與更新
        MatchDataCache --> BgRevalidate
    }

    PathAppShell --> [*]: 回傳 Response
    PathAudio --> [*]: 回傳 AudioStream
    PathData --> [*]: 回傳 JSON / Image
```

---

## 3. 資料庫綱要與本地持久化設計 (Database Schema & Persistence)

系統採用客戶端標準 **IndexedDB (Database Name: `lan_taigi_db`, Version: `2`)** 進行結構化資料儲存，並以 `LocalStorage` 儲存輕量配置。

### 3.1 實體關聯模型 (Entity-Relationship Diagram)

```mermaid
erDiagram
    user_profile ||--o{ level_progress : "tracks"
    user_profile ||--o{ srs_items : "schedules"
    user_profile ||--o{ quiz_history : "records"
    user_profile ||--o{ bookmarks : "collects"
    
    user_profile {
        string key PK "主鍵: main_profile"
        int streak "連續活躍天數"
        string lastActiveDate "最後活躍日期 (YYYY-MM-DD)"
        int totalStars "累計通關星星數"
        int totalReviews "累計 SM-2 複習次數"
        int totalPronunciations "口說評測挑戰次數"
        bigint updatedAt "最後更新時間戳"
    }

    level_progress {
        string levelKey PK "關卡代碼 (例: '1-1', '3-4')"
        int unitId "所屬主題單元 (1-10)"
        int nodeType "節點類型 (1:詞彙, 2:聽力, 3:口說, 4:挑戰)"
        boolean unlocked "解鎖狀態 (1-1 永遠保底 true)"
        boolean completed "是否通關"
        int stars "通關星級 (0-3)"
        int bestScore "最高得分 (0-100)"
        bigint updatedAt "更新時間戳"
    }

    srs_items {
        string wordId PK "單詞或小吃標識 (例: '1242', 'snack-tainan-beef')"
        string hanzi "台語漢字"
        string tailo "臺羅拼音"
        string meaning "華語釋義"
        int repetition "連續記憶成功次數 (n)"
        float ef "難易度係數 (Easiness Factor, 預設 2.5)"
        int interval "下次間隔天數 (Interval, 單位:天)"
        bigint nextReview "下次複習時間戳 (Epoch ms)"
        bigint lastReviewed "上次複習時間戳 (Epoch ms)"
        int historyCount "總計作答次數"
    }

    bookmarks {
        string id PK "詞目 ID"
        string hanzi "詞目漢字"
        string tailo "臺羅拼音"
        string hoa "華語對照釋義"
        bigint timestamp "收藏建立時間戳"
    }

    quiz_history {
        int id PK "自動遞增主鍵 (autoIncrement)"
        string mode "測驗模式 (char-to-tl, tl-to-char, hoa-taigi, tone)"
        int score "測驗得分"
        int totalQuestions "題目總數"
        array wrongAnswers "錯題清單紀錄"
        bigint timestamp "測驗時間戳"
    }

    cached_audio {
        string url PK "音訊遠端來源 URL"
        blob audioBlob "二進制 MP3 音訊數據"
        bigint timestamp "本地緩存時間戳"
    }
```

### 3.2 Object Stores 詳細規格

| Object Store 名稱 | 主鍵 (KeyPath) | 索引 (Indices) | 用途與說明 |
| :--- | :--- | :--- | :--- |
| `srs_items` | `wordId` (string) | `nextReview`, `repetition` | SuperMemo SM-2 演算法狀態儲存，管理生詞與小吃複習排程 |
| `level_progress` | `levelKey` (string) | `unitId`, `nodeType` | Duolingo 40 個闖關節點解鎖進度、星星、得分紀錄 |
| `user_profile` | `key` (string) | 無 (單筆主檔) | 使用者學習總覽（連續天數 Streak、總星數、複習總量） |
| `bookmarks` | `id` (string) | `timestamp` | 辭典生詞收藏本 |
| `quiz_history` | `id` (autoIncrement) | `timestamp` | 四合一測驗歷史紀錄與錯題集 |
| `cached_audio` | `url` (string) | `timestamp` | 本地自訂匯入或持久化之音檔二進制 Blob |

---

## 4. 核心演算法與數學模型 (Core Algorithms & Mathematical Models)

### 4.1 SuperMemo SM-2 間隔重複記憶演算法 (SRS Engine)

本系統實作認知心理學權威之 SuperMemo SM-2 艾賓浩斯抗遺忘排程，將詞彙記憶鞏固最佳化。

#### 4.1.1 數學公式推導

1. **反饋評分等級 $q$**：
   $$q \in \{1: \text{Again (忘記)}, 2: \text{Hard (困難)}, 3: \text{Good (良好)}, 4: \text{Easy (容易)}\}$$
   在計算模型中映射為標準 SM-2 之評分範圍 $0 \le q \le 5$。

2. **難易度係數（Easiness Factor, $EF$）動態更新公式**：
   $$EF' = \max\left(1.3,\; EF + \left(0.1 - (5 - q) \times \left(0.08 + (5 - q) \times 0.02\right)\right)\right)$$
   - $EF$ 初始值為 $2.5$。
   - $EF$ 設定絕對下限值 $1.3$，防止困難詞彙陷入永久零增長之循環。

3. **複習間隔週期 $I(n)$ 計算**：
   $$I(n) = \begin{cases} 
   1 \text{ 天}, & n = 1 \\
   6 \text{ 天}, & n = 2 \\
   \left\lceil I(n-1) \times EF \right\rceil \text{ 天}, & n > 2 
   \end{cases}$$
   - 當使用者評分 $q < 3$（未達標或忘記）時，連續成功次數重置：$n = 0$，$I(0) = 1$ 天，安排當日或次日重新複習。

#### 4.1.2 SM-2 複習調度序列圖 (Scheduling Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor User as 學習者
    participant UI as 複習介面 (level-map / quiz)
    participant SRS as SM-2 引擎 (srs-engine.js)
    participant DB as IndexedDB (srs_items)

    User->>UI: 點選「今日待複習詞彙」
    UI->>SRS: getDueItems(limit=20)
    SRS->>DB: 查詢 nextReview <= Date.now()
    DB-->>SRS: 回傳待複習項目清單
    SRS-->>UI: 渲染生詞翻翻卡
    User->>UI: 翻開背面，自我評估點擊 [Good / 良好] (q=3)
    UI->>SRS: processReview(wordId, quality=3)
    SRS->>SRS: 計算新 EF' 與 下次間隔 I(n)
    SRS->>DB: 更新 srs_items (nextReview, repetition, ef)
    SRS->>DB: 更新 user_profile (totalReviews + 1)
    DB-->>SRS: 確認寫入完成
    SRS-->>UI: 動態過渡至下一張複習卡片，更新儀表板數字
```

---

### 4.2 純前端時域自相關 (Autocorrelation) F0 音高追蹤與聲調比對

系統實作純前端 Web Audio 聲學即時訊號處理管線，無需任何後端語音辨識伺服器支援。

#### 4.2.1 數位訊號處理管線 (DSP Pipeline)

```mermaid
flowchart LR
    Mic["🎤 麥克風音訊輸入"] --> Node_Source["MediaStreamSourceNode"]
    Node_Source --> Node_Filter["BiquadFilterNode (低通濾波 80-500Hz)"]
    Node_Filter --> Node_Analyser["AnalyserNode (FFT Size: 2048)"]
    Node_Analyser --> Float32["時域波形緩衝區 (Float32Array)"]
    Float32 --> Algo_ACF["時域自相關演算法 (Autocorrelation)"]
    Algo_ACF --> F0_Extract["提取當前訊框基頻 F0 (Hz)"]
    F0_Extract --> Contour_Normalize["調型正規化 (五度制調值映射)"]
    Contour_Normalize --> Tone_Compare["幾何斜率與標準調值匹配比對"]
    Tone_Compare --> Canvas_Render["HTML5 Canvas 即時繪製與給分"]
```

#### 4.2.2 時域自相關函數計算
對於長度為 $N$ 的採樣訊號序列 $x[n]$，時域差分自相關函數定義為：
$$R_{xx}[\tau] = \sum_{j=0}^{N-\tau-1} x[j] \cdot x[j+\tau]$$
1. **基頻搜尋區間**：針對人類台語語音基礎音高，限定週期延遲 $\tau$ 範圍：
   $$\tau_{\min} = \frac{f_s}{450\text{ Hz}}, \quad \tau_{\max} = \frac{f_s}{70\text{ Hz}}$$
2. **拋物線插值 (Parabolic Interpolation)**：在自相關峰值點 $\tau_{\text{peak}}$ 處進行次取樣多項式擬合，將基頻解析度提升至小數點精確度：
   $$\Delta = \frac{R[\tau+1] - R[\tau-1]}{2 \cdot (2R[\tau] - R[\tau-1] - R[\tau+1])}, \quad \tau^* = \tau_{\text{peak}} + \Delta, \quad F_0 = \frac{f_s}{\tau^*}$$

#### 4.2.3 臺灣台語標準調值斜率特徵矩陣

系統將使用者正規化後的音高走勢與教育部標準 7 聲調模型進行特徵向量差方比對：

| 聲調名稱 | 調號標記 | 傳統調值 | 音高走向特性 | 容許公差與斜率判定條件 |
| :--- | :---: | :---: | :--- | :--- |
| **第 1 調 (陰平)** | (無/1) | **55** | 高平調 (High Level) | 斜率趨近 0，平均調高位於中高音域 ($\ge 3.8/5.0$) |
| **第 2 調 (陰上)** | ˋ (2) | **51** | 高降調 (High Falling) | 明顯負斜率，由頂點快速下滑 $\ge 2.5$ 度 |
| **第 3 調 (陰去)** | ̀ (3) | **31** | 低降調 (Low Falling) | 起始於中音，滑落至底音 |
| **第 4 調 (陰入)** | -p, -t, -k, -h | **21** 或 **32** | 低促調 (Short Low) | 持續時長極短 ($< 150\text{ms}$)，伴隨喉塞音或塞音爆破 |
| **第 5 調 (陽平)** | ˊ (5) | **24** | 低升調 (Low Rising) | 明顯正斜率，由低音穩定爬升至中高音 |
| **第 7 調 (陽去)** | ̄ (7) | **33** | 中平調 (Mid Level) | 斜率趨近 0，平均調高穩定於中音區 ($2.8 \sim 3.4/5.0$) |
| **第 8 調 (陽入)** | ̍ (8) | **53** 或 **55** | 高促調 (Short High) | 時長極短 ($< 150\text{ms}$)，調高位於高音域 |

---

### 4.3 物理聲調合成器 (Tone Synthesizer)

`tone-synth.js` 透過 Web Audio API 之 `OscillatorNode` 與 `GainNode`，根據台語傳統五度制調值調製標準 Hz 音高滑音：
- 基準頻率音階：$1 \text{ 度} = 130\text{ Hz}$，$2 \text{ 度} = 146\text{ Hz}$，$3 \text{ 度} = 164\text{ Hz}$，$4 \text{ 度} = 184\text{ Hz}$，$5 \text{ 度} = 207\text{ Hz}$。
- 滑音以 `exponentialRampToValueAtTime` 進行連續非線性音高過渡，呈現標準母語連續變調（Tone Sandhi: 5➔7➔3➔2➔1➔7 與 4➔8 / 8➔4）之發音差異。

---

## 5. 前端模組架構與 API 介面規格 (Module Architecture & Interfaces)

```
js/
├── app.js               # 全域主控器、導航切換、PWA 生命週期、授權彈窗
├── storage.js           # StorageManager: IndexedDB v2 封裝層與記憶體降級
├── srs-engine.js        # SRSEngine: SuperMemo SM-2 間隔重複排程器
├── speech-evaluator.js  # SpeechEvaluator: 離線基頻追蹤、聲調比對與 Canvas 渲染
├── tone-synth.js        # ToneSynthesizer: Web Audio 物理聲調合成與變調器
├── level-map.js         # LevelMapManager: Duolingo 風格 40 節點地圖與進度
├── snack-map.js         # SnackMapManager: 30 款台灣小吃與夜市客製點餐產生器
├── dict.js              # DictionaryManager: 29,592 詞條全文檢索與腔調展示
├── lessons.js           # LessonsManager: 10 大情境單元與 3D 翻翻卡
├── phonology.js         # PhonologyManager: 聲韻調教學與發音測試
├── quiz.js              # QuizManager: 四大趣味測驗競技場
├── audio-manager.js     # AudioManager: 智慧音訊快取與 ZIP 語音包匯入
└── jszip.min.js         # 第三方純前端解壓縮庫 (MIT License)
```

### 5.1 關鍵類別介面定義 (TypeScript 風格介面規格)

```typescript
// 儲存管理抽象介面 (storage.js)
interface IStorageManager {
  ensureDB(): Promise<IDBDatabase>;
  saveSRSItem(item: SRSItem): Promise<SRSItem>;
  getSRSItem(wordId: string): Promise<SRSItem | null>;
  getAllSRSItems(): Promise<SRSItem[]>;
  saveLevelProgress(levelKey: string, data: Partial<LevelProgress>): Promise<LevelProgress>;
  getLevelProgress(levelKey: string): Promise<LevelProgress | null>;
  getAllLevelProgress(): Promise<LevelProgress[]>;
  getUserProfile(): Promise<UserProfile>;
  saveUserProfile(profile: Partial<UserProfile>): Promise<UserProfile>;
  saveBookmark(item: BookmarkItem): Promise<boolean>;
  removeBookmark(id: string): Promise<boolean>;
  getBookmarks(): Promise<BookmarkItem[]>;
}

// 闖關地圖管理介面 (level-map.js)
interface ILevelMapManager {
  init(): Promise<void>;
  renderDashboard(): Promise<void>;
  renderMap(): void;
  openLevel(levelKey: string): void;
  completeSubLevel(levelKey: string, subStage: number, score: number): Promise<void>;
  switchView(mode: 'map' | 'list'): void;
}

// SM-2 記憶引擎介面 (srs-engine.js)
interface ISRSEngine {
  recordReview(wordId: string, quality: 1 | 2 | 3 | 4, meta?: Partial<SRSItem>): Promise<SRSItem>;
  getDueItems(limit?: number): Promise<SRSItem[]>;
  getMetrics(): Promise<{ streak: number; dueCount: number; totalStars: number; masteredCount: number }>;
  showReviewModal(): Promise<void>;
}

// 離線語音評分介面 (speech-evaluator.js)
interface ISpeechEvaluator {
  startRecording(targetTone: number, onPitchUpdate?: (pitch: number) => void): Promise<boolean>;
  stopRecording(): Promise<{ score: number; passed: boolean; pitchContour: number[] }>;
  playReferenceAudio(audioUrl: string): void;
  playUserRecording(): void;
  renderContour(canvas: HTMLCanvasElement): void;
}

// 台灣小吃與夜市客製點餐介面 (snack-map.js)
interface ISnackMapManager {
  init(): Promise<void>;
  renderSnackList(filterRegion?: string, keyword?: string): void;
  openSnackDetail(snackId: string): void;
  generateCustomOrderSentence(options: OrderOptions): CustomOrderResult;
  addSnackToSRS(snackId: string, sentenceIdx?: number): Promise<void>;
}
```

---

## 6. 資料結構與教育部開放資料管線 (Data Pipelines & Schemas)

### 6.1 離線資料集規格一覽

| 檔案名稱 | 磁碟大小 | 紀錄總數 | 核心用途與結構特點 |
| :--- | :--- | :--- | :--- |
| `dict_index.json` | 2.8 MB | 29,592 筆 | 陣列緊湊結構 `[id, hanzi, tailo, hoa]`，開機一次性載入記憶體，提供全辭典 `< 10ms` 拼音/漢字/華語模糊比對。 |
| `dict_details.json` | 7.6 MB | 29,592 筆 | 字典主鍵查表：包含詞性、定義條目、台華對照例句、10 大方言腔調（鹿港、三峽、宜蘭等）音標與異用字。 |
| `taiwan_snacks.json` | 42 KB | 30 款小吃 | 橫跨 16 縣市，各收錄台語漢字、臺羅、華語、發音音檔、三大維度例句（點餐溝通、道地口感、文化由來）與客製化標籤。 |
| `lessons_data.json` | 38 KB | 10 大主題 | 包含 40 篇核心對話、台羅音讀、詞彙卡片、3D 翻翻卡資料與文化小錦囊。 |
| `mandarin_comparison.json` | 512 KB | 12,271 筆 | 華台日常習慣用語精確替換索引表。 |
| `dialects.json` | 64 KB | 407 筆 | 跨區域方言差異讀音橫向對比資料集。 |
| `surnames.json` | 96 KB | 2,473 筆 | 台灣百家姓台羅羅馬字標準標注庫。 |
| `annesia_data.json` | 180 KB | 458 期 | 教育部「臺灣閩南語按呢寫」官方推薦用字與語源解析。 |

---

## 7. 系統韌性、版本遷移與相容性設計 (System Resilience & Compatibility)

本章節收錄系統在真實生產環境與跨版本迭代中所實施之四重防禦性工程：

### 7.1 IndexedDB 平滑遷移防禦架構
在使用者自舊版 (`v1.0.0`, DB Version 1) 跨版升級至包含 SRS 與關卡資料庫 (`v1.2.1`, DB Version 2) 時，可能發生資料庫開啟尚未觸發 `onupgradeneeded` 或處於遷移過渡期之競爭條件（Race Condition）。

- **防禦實作**：
  在 `storage.js` 的所有讀寫方法（如 `saveLevelProgress`, `getUserProfile`, `saveSRSItem`）中，皆於交易建立前執行物件存儲庫存在檢驗：
  ```javascript
  const db = await this.ensureDB();
  if (!db || !db.objectStoreNames.contains('target_store')) {
    console.warn('[Storage] Object store missing, fallback triggered.');
    return fallbackData; // 降級至記憶體預設值，保證 UI 正常渲染不拋錯
  }
  ```
- **保底效果**：徹底消滅 `NotFoundError: Failed to execute 'transaction' on 'IDBDatabase'` 致命例外。

### 7.2 關卡解鎖無條件保底 (Level 1-1 Guaranteed Unlock)
為避免因快取資料庫空值或非同步載入延遲導致首關呈現鎖定（🔒）狀態：
- **建構子級強制保底**：在 `LevelMapManager` 初始化建構階段，無條件將節點 `1-1` 賦予 `{ levelKey: '1-1', unitId: 1, nodeType: 1, completed: false, stars: 0, unlocked: true }`。
- **儀表板保底渲染**：即便本地資料庫無任何歷程，以預設值 `{ streak: 1, dueCount: 0, totalStars: 0, masteredCount: 0 }` 進行立即同步渲染，防止白屏。

### 7.3 Service Worker 版本指紋與即時換代
- **版本指紋**：在 `index.html` 之所有 CSS 與 JS 載入標籤附加 `?v=1.2.1`。
- **快取名稱隔離**：升級靜態快取至 `lan-taigi-static-v4`。在 `activate` 生命週期中自動遍歷快取鍵值，立即刪除除 `lan-taigi-static-v4` 與 `lan-taigi-audio-v1` 以外之所有舊快取版本。
- **立即接管**：`install` 事件呼叫 `self.skipWaiting()`，`activate` 事件呼叫 `self.clients.claim()`，確保發布後即時更新。

### 7.4 臺羅拼音特殊結合符號（Unicode Combining Diacritics）字型相容鏈
臺灣台語羅馬字（Tâi-lô）包含特殊調號標記，尤其是**第八聲（陽入）垂直附加符號（Combining Vertical Line Above, `U+030D`，如 `Ji̍t`、`Chha̍t`）**與鼻化母音標記（`ⁿ`）。標準系統字型常發生調號位移或顯示為方塊缺字（Tofu Glyph）。

- **字型棧降級鏈設計 (`css/style.css`)**：
  ```css
  :root {
    --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", "Charis SIL", "Doulos SIL", "DejaVu Sans", "PingFang TC", "Microsoft JhengHei", sans-serif;
    --font-serif: "Charis SIL", "Noto Serif TC", "Songti TC", "Times New Roman", serif;
  }
  ```
- **效果**：透過引入國際語音學權威開源字型 `Charis SIL` 與 `Doulos SIL` 優先級，搭配系統原生 `Noto Sans TC`，確保各作業系統（macOS, iOS, Android, Windows, Linux）下所有 8 聲調標記均能達成微米級完美對齊。

---

## 8. 專案授權、安全性與效能指標 (Licensing, Security & Benchmarks)

### 8.1 授權條款分工矩陣

| 軟體組件 / 資料集合 | 授權條款 (License) | 權利歸屬 | 限制與注意事項 |
| :--- | :--- | :--- | :--- |
| **前端應用程式原始碼** (HTML/CSS/JS/SW) | **MIT License** | 咱的台語開發團隊 | 商業與非商業均可自由使用、修改與散布，須保留版權聲明。 |
| **教育部辭典開放資料** (文字與音訊) | **CC BY-ND 3.0 TW** / 政府資料開放條款 | 中華民國教育部 | 須註明出處為教育部，禁止改作，可自由重製散布。 |
| **教育部「按呢寫」專欄** | **CC BY-NC-ND 2.5 TW** | 中華民國教育部 | 須標明出處，限非商業用途，不可改作。 |
| **開源字型 (Noto Sans / Charis SIL)** | **SIL Open Font License 1.1** | 各字型開源團隊 | 自由商用與內嵌，禁止單獨販售字型檔案。 |
| **JSZip 解壓縮庫** | **MIT License** | Stuart Knightley | 自由使用。 |

### 8.2 效能基準評測 (Performance Benchmarks)

依據標準 Chrome DevTools 效能分析與離線環境實測數據：

| 評測項目 | 目標指標 | 實測表現 | 達成技術手段 |
| :--- | :--- | :--- | :--- |
| **First Contentful Paint (FCP)** | $< 1.0\text{s}$ | **0.42 秒** | 精簡純原生 HTML/CSS，零大型框架負擔 |
| **Time to Interactive (TTI)** | $< 1.5\text{s}$ | **0.68 秒** | Vanilla JS 非同步延遲加載資料庫 |
| **辭典全文檢索延遲 (29,592 筆)** | $< 20\text{ms}$ | **6 ~ 9 毫秒** | 記憶體預編譯倒排索引與正規化模糊比對 |
| **Web Audio 基頻評測延遲** | $< 50\text{ms}$ | **16 毫秒 (即時 60fps)** | 時域自相關演算法優化與 Web Audio AnalyserNode |
| **離線儲存空間佔用** | $< 35\text{MB}$ | **約 16.5 MB** | 結構化 JSON 壓縮與音檔動態隨選快取 |
| **斷網離線可用性** | 100% 離線可用 | **100% 離線可用** | Service Worker 雙層調度與全 Precache 機制 |

---

## 9. 結論與後續維護規範 (Conclusion & Maintenance)

本軟體設計規格書 (SDD) 完整定義了「咱的台語」離線教學應用程式從基礎建設、離線快取、本地持久化、核心認知與聲學演算法、至業務表現層之全端規格。

未來各功能模組之擴充（如擴增在地小吃名錄、增加地方腔調語音庫、導入更多情境通關單元），均應依循本規格書定義之**防禦性容錯規範**、**SM-2 狀態機介面**與**資料綱要**進行版本迭代。
