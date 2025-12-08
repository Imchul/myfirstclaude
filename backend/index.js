const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Data file paths (cross-platform compatible)
const DATA_DIR = path.join(__dirname, 'data');
const PLAYBOOK_PATH = path.join(DATA_DIR, 'playbook.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

// Default playbook data (새 구조)
const DEFAULT_PLAYBOOK = [
  {
    id: 'mc_1',
    type: 'MC_TIME',
    title: '사회자 타임 1 - 오프닝',
    script: '안녕하세요, 저는 AI 사회자 두에나입니다. 오늘 행사 진행을 맡게 되어 영광입니다.',
    systemInstruction: '당신은 AI 사회자 "두에나"입니다. 공동사회자가 "두에나"라고 부르면 친근하고 밝은 톤으로 응답하세요.'
  },
  {
    id: 'session_1',
    type: 'SESSION',
    title: '세션 1 - Opening',
    description: '개회사'
  }
];

// Default settings
const DEFAULT_SETTINGS = {
  avatarId: 'default',
  mcName: '두에나'
};

// State Management (확장된 상태)
let currentState = {
  currentItemId: null,
  isRunning: false,
  voiceSessionActive: false,
  audioEnabled: true,
  logs: []
};

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load playbook from file
function loadPlaybook() {
  ensureDataDir();
  if (!fs.existsSync(PLAYBOOK_PATH)) {
    fs.writeFileSync(PLAYBOOK_PATH, JSON.stringify(DEFAULT_PLAYBOOK, null, 2), 'utf-8');
    return DEFAULT_PLAYBOOK;
  }
  const data = fs.readFileSync(PLAYBOOK_PATH, 'utf-8');
  return JSON.parse(data);
}

// Save playbook to file
function savePlaybook(playbook) {
  ensureDataDir();
  fs.writeFileSync(PLAYBOOK_PATH, JSON.stringify(playbook, null, 2), 'utf-8');
}

// Load settings from file
function loadSettings() {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_PATH)) {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
    return DEFAULT_SETTINGS;
  }
  const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
  return JSON.parse(data);
}

// Save settings to file
function saveSettings(settings) {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

// Add log entry
function addLog(message) {
  currentState.logs.push({
    time: new Date().toISOString(),
    message
  });
  // 최대 100개 로그 유지
  if (currentState.logs.length > 100) {
    currentState.logs = currentState.logs.slice(-100);
  }
}

// Initialize on server start
let playbook = loadPlaybook();
let settings = loadSettings();
console.log('Playbook loaded:', playbook.length, 'items');
console.log('Settings loaded:', settings);

// ============ API Routes ============

// GET /api/playbook - Get all items
app.get('/api/playbook', (req, res) => {
  playbook = loadPlaybook();
  res.json(playbook);
});

// POST /api/playbook - Save/Update playbook
app.post('/api/playbook', (req, res) => {
  try {
    const newPlaybook = req.body;
    if (!Array.isArray(newPlaybook)) {
      return res.status(400).json({ error: 'Playbook must be an array' });
    }
    savePlaybook(newPlaybook);
    playbook = newPlaybook;
    addLog('Playbook updated');
    res.json({ success: true, message: 'Playbook saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save playbook' });
  }
});

// GET /api/playbook/sample - Get sample playbook JSON for download
app.get('/api/playbook/sample', (req, res) => {
  const sample = [
    {
      id: 'mc_1',
      type: 'MC_TIME',
      title: '사회자 타임 1 - 오프닝',
      script: '안녕하세요, 저는 AI 사회자입니다.',
      systemInstruction: '밝고 친근한 톤으로 인사하세요.'
    },
    {
      id: 'session_1',
      type: 'SESSION',
      title: '세션 1 - 발표',
      description: '발표자 발표'
    },
    {
      id: 'mc_2',
      type: 'MC_TIME',
      title: '사회자 타임 2 - 마무리',
      script: '오늘 행사에 참석해 주셔서 감사합니다.',
      systemInstruction: '따뜻하게 마무리 인사를 하세요.'
    }
  ];
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="playbook_sample.json"');
  res.json(sample);
});

// GET /api/settings - Get settings
app.get('/api/settings', (req, res) => {
  settings = loadSettings();
  res.json(settings);
});

// POST /api/settings - Save settings
app.post('/api/settings', (req, res) => {
  try {
    const newSettings = { ...settings, ...req.body };
    saveSettings(newSettings);
    settings = newSettings;
    addLog(`Settings updated: Avatar=${settings.avatarId}, MC=${settings.mcName}`);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// GET /api/state - Get current state
app.get('/api/state', (req, res) => {
  playbook = loadPlaybook();
  settings = loadSettings();
  const currentItem = playbook.find(item => item.id === currentState.currentItemId);
  res.json({
    ...currentState,
    currentItem,
    playbook,
    settings
  });
});

// POST /api/start - Start the event
app.post('/api/start', (req, res) => {
  playbook = loadPlaybook();
  if (playbook.length === 0) {
    return res.status(400).json({ error: 'Playbook is empty' });
  }
  currentState.isRunning = true;
  currentState.currentItemId = playbook[0].id;
  addLog(`Event started - ${playbook[0].title}`);
  res.json({ success: true, state: currentState });
});

// POST /api/next - Move to next item
app.post('/api/next', (req, res) => {
  if (!currentState.isRunning) {
    return res.status(400).json({ error: 'Event not running' });
  }
  playbook = loadPlaybook();
  const currentIndex = playbook.findIndex(item => item.id === currentState.currentItemId);
  if (currentIndex === -1 || currentIndex >= playbook.length - 1) {
    return res.status(400).json({ error: 'No more items' });
  }
  const nextItem = playbook[currentIndex + 1];
  currentState.currentItemId = nextItem.id;

  // 세션으로 이동하면 음성 세션 자동 종료
  if (nextItem.type === 'SESSION' && currentState.voiceSessionActive) {
    currentState.voiceSessionActive = false;
    addLog(`Voice session ended (moved to SESSION)`);
  }

  addLog(`Moved to - ${nextItem.title}`);
  res.json({ success: true, state: currentState, item: nextItem });
});

// POST /api/stop - Stop the event
app.post('/api/stop', async (req, res) => {
  currentState.isRunning = false;
  currentState.currentItemId = null;
  currentState.voiceSessionActive = false;
  addLog('Event stopped');

  // HeyGen 세션 정리 (비동기로 실행)
  cleanupHeyGenSessions().then(stopped => {
    if (stopped > 0) {
      addLog(`Stopped ${stopped} HeyGen sessions`);
    }
  });

  res.json({ success: true, state: currentState });
});

// POST /api/voice-session/start - Start voice session (음성 세션 시작)
app.post('/api/voice-session/start', (req, res) => {
  if (!currentState.isRunning) {
    return res.status(400).json({ error: 'Event not running' });
  }
  const currentItem = playbook.find(item => item.id === currentState.currentItemId);
  if (!currentItem || currentItem.type !== 'MC_TIME') {
    return res.status(400).json({ error: 'Voice session can only start during MC_TIME' });
  }
  currentState.voiceSessionActive = true;
  addLog(`Voice session started - ${currentItem.title}`);
  res.json({ success: true, state: currentState });
});

// POST /api/voice-session/stop - Stop voice session (음성 세션 종료)
app.post('/api/voice-session/stop', (req, res) => {
  currentState.voiceSessionActive = false;
  addLog('Voice session stopped');
  res.json({ success: true, state: currentState });
});

// POST /api/audio/toggle - Toggle audio (소리 켜기/끄기)
app.post('/api/audio/toggle', (req, res) => {
  currentState.audioEnabled = !currentState.audioEnabled;
  addLog(`Audio ${currentState.audioEnabled ? 'enabled' : 'disabled'}`);
  res.json({ success: true, audioEnabled: currentState.audioEnabled });
});

// POST /api/audio/set - Set audio state
app.post('/api/audio/set', (req, res) => {
  const { enabled } = req.body;
  currentState.audioEnabled = enabled;
  addLog(`Audio ${enabled ? 'enabled' : 'disabled'}`);
  res.json({ success: true, audioEnabled: currentState.audioEnabled });
});

// HeyGen 세션 정리 헬퍼 함수
async function cleanupHeyGenSessions() {
  try {
    const listResponse = await axios.get(
      'https://api.heygen.com/v1/streaming.list',
      {
        headers: {
          'x-api-key': process.env.HEYGEN_API_KEY
        }
      }
    );

    const sessions = listResponse.data?.data?.sessions || [];
    let stopped = 0;

    for (const session of sessions) {
      try {
        await axios.post(
          'https://api.heygen.com/v1/streaming.stop',
          { session_id: session.session_id },
          {
            headers: {
              'x-api-key': process.env.HEYGEN_API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );
        stopped++;
      } catch (stopErr) {
        console.error('[HeyGen] Failed to stop session:', session.session_id);
      }
    }

    return stopped;
  } catch (err) {
    console.error('[HeyGen] Cleanup error:', err.message);
    return 0;
  }
}

// POST /api/emergency-stop - Emergency stop (비상 정지)
app.post('/api/emergency-stop', async (req, res) => {
  currentState.isRunning = false;
  currentState.currentItemId = null;
  currentState.voiceSessionActive = false;
  addLog('EMERGENCY STOP activated');

  // HeyGen 세션 정리 (비동기로 실행)
  cleanupHeyGenSessions().then(stopped => {
    if (stopped > 0) {
      addLog(`Emergency: Stopped ${stopped} HeyGen sessions`);
    }
  });

  res.json({ success: true, state: currentState });
});

// POST /api/session - OpenAI Realtime Session (Ephemeral Token)
app.post('/api/session', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/realtime/sessions',
      {
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'verse'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('OpenAI Session Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/session - Also support GET for frontend compatibility
app.get('/api/session', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/realtime/sessions',
      {
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'verse'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('OpenAI Session Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/getToken - HeyGen Token
app.get('/api/getToken', async (req, res) => {
  try {
    // 먼저 기존 세션들을 정리
    try {
      const listResponse = await axios.get(
        'https://api.heygen.com/v1/streaming.list',
        {
          headers: {
            'x-api-key': process.env.HEYGEN_API_KEY
          }
        }
      );

      const sessions = listResponse.data?.data?.sessions || [];
      console.log('[HeyGen] Found', sessions.length, 'existing sessions');

      // 기존 세션들 모두 종료
      for (const session of sessions) {
        try {
          await axios.post(
            'https://api.heygen.com/v1/streaming.stop',
            { session_id: session.session_id },
            {
              headers: {
                'x-api-key': process.env.HEYGEN_API_KEY,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('[HeyGen] Stopped session:', session.session_id);
        } catch (stopErr) {
          console.error('[HeyGen] Failed to stop session:', session.session_id);
        }
      }
    } catch (listErr) {
      console.error('[HeyGen] Failed to list sessions:', listErr.message);
    }

    // 새 토큰 생성
    const response = await axios.post(
      'https://api.heygen.com/v1/streaming.create_token',
      {},
      {
        headers: {
          'x-api-key': process.env.HEYGEN_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('HeyGen Token Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get HeyGen token' });
  }
});

// POST /api/cleanupHeyGen - HeyGen 세션 정리 (수동)
app.post('/api/cleanupHeyGen', async (req, res) => {
  try {
    const listResponse = await axios.get(
      'https://api.heygen.com/v1/streaming.list',
      {
        headers: {
          'x-api-key': process.env.HEYGEN_API_KEY
        }
      }
    );

    const sessions = listResponse.data?.data?.sessions || [];
    let stopped = 0;

    for (const session of sessions) {
      try {
        await axios.post(
          'https://api.heygen.com/v1/streaming.stop',
          { session_id: session.session_id },
          {
            headers: {
              'x-api-key': process.env.HEYGEN_API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );
        stopped++;
      } catch (stopErr) {
        console.error('[HeyGen] Failed to stop session:', session.session_id);
      }
    }

    addLog(`HeyGen cleanup: stopped ${stopped} sessions`);
    res.json({ success: true, message: `Stopped ${stopped} of ${sessions.length} sessions` });
  } catch (error) {
    console.error('HeyGen Cleanup Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to cleanup HeyGen sessions' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
