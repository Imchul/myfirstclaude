import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { AppState, PlaybookItem, Settings } from '../types';

type TabType = 'live' | 'settings' | 'editor';

export default function OperatorConsole() {
  const [activeTab, setActiveTab] = useState<TabType>('live');
  const [state, setState] = useState<AppState | null>(null);
  const [playbook, setPlaybook] = useState<PlaybookItem[]>([]);
  const [settings, setSettings] = useState<Settings>({ avatarId: 'default', mcName: '두에나' });
  const [selectedItem, setSelectedItem] = useState<PlaybookItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data: AppState = await res.json();
          setState(data);
          if (data.settings) {
            setSettings(data.settings);
          }
        }
      } catch (err) {
        console.error('Failed to fetch state:', err);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch playbook
  useEffect(() => {
    const fetchPlaybook = async () => {
      try {
        const res = await fetch('/api/playbook');
        if (res.ok) {
          const data: PlaybookItem[] = await res.json();
          setPlaybook(data);
          if (data.length > 0 && !selectedItem) {
            setSelectedItem(data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch playbook:', err);
      }
    };

    fetchPlaybook();
  }, []);

  // Control handlers
  const handleStart = async () => {
    try {
      await fetch('/api/start', { method: 'POST' });
    } catch (err) {
      console.error('Failed to start:', err);
    }
  };

  const handleNext = async () => {
    try {
      await fetch('/api/next', { method: 'POST' });
    } catch (err) {
      console.error('Failed to go next:', err);
    }
  };

  const handleStop = async () => {
    try {
      await fetch('/api/stop', { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop:', err);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await fetch('/api/emergency-stop', { method: 'POST' });
    } catch (err) {
      console.error('Failed to emergency stop:', err);
    }
  };

  const handleVoiceSessionStart = async () => {
    try {
      await fetch('/api/voice-session/start', { method: 'POST' });
    } catch (err) {
      console.error('Failed to start voice session:', err);
    }
  };

  const handleVoiceSessionStop = async () => {
    try {
      await fetch('/api/voice-session/stop', { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop voice session:', err);
    }
  };

  const handleAudioToggle = async () => {
    try {
      await fetch('/api/audio/toggle', { method: 'POST' });
    } catch (err) {
      console.error('Failed to toggle audio:', err);
    }
  };

  // Settings handlers
  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveMessage('설정이 저장되었습니다!');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  // Playbook editor handlers
  const handleItemChange = (field: keyof PlaybookItem, value: string) => {
    if (!selectedItem) return;
    const updated = { ...selectedItem, [field]: value };
    setSelectedItem(updated);
    setPlaybook(playbook.map(item => item.id === updated.id ? updated : item));
  };

  const handleAddItem = (type: 'MC_TIME' | 'SESSION') => {
    const newId = `${type.toLowerCase()}_${Date.now()}`;
    const newItem: PlaybookItem = type === 'MC_TIME'
      ? {
          id: newId,
          type: 'MC_TIME',
          title: '새 사회자 타임',
          script: '',
          systemInstruction: '당신은 AI 사회자입니다.'
        }
      : {
          id: newId,
          type: 'SESSION',
          title: '새 세션',
          description: ''
        };
    setPlaybook([...playbook, newItem]);
    setSelectedItem(newItem);
  };

  const handleDeleteItem = (id: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    const newPlaybook = playbook.filter(item => item.id !== id);
    setPlaybook(newPlaybook);
    if (selectedItem?.id === id) {
      setSelectedItem(newPlaybook[0] || null);
    }
  };

  const handleMoveItem = (id: string, direction: 'up' | 'down') => {
    const index = playbook.findIndex(item => item.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === playbook.length - 1) return;

    const newPlaybook = [...playbook];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newPlaybook[index], newPlaybook[swapIndex]] = [newPlaybook[swapIndex], newPlaybook[index]];
    setPlaybook(newPlaybook);
  };

  const handleSavePlaybook = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playbook),
      });
      if (res.ok) {
        setSaveMessage('저장되었습니다!');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage('저장 실패');
      }
    } catch (err) {
      setSaveMessage('저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPlaybook = () => {
    const blob = new Blob([JSON.stringify(playbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playbook.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPlaybook = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setPlaybook(imported);
          setSelectedItem(imported[0] || null);
          setSaveMessage('불러오기 완료! 저장 버튼을 눌러주세요.');
        } else {
          alert('유효하지 않은 JSON 형식입니다.');
        }
      } catch (err) {
        alert('JSON 파일을 읽을 수 없습니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadSample = () => {
    window.open('/api/playbook/sample', '_blank');
  };

  const currentItem = state?.currentItem;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">운영자 콘솔</h1>
          <Link
            to="/"
            target="_blank"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
          >
            메인 스테이지 (새 창)
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex border-b border-gray-300">
          {(['live', 'settings', 'editor'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'live' ? 'Live Control' : tab === 'settings' ? 'Settings' : 'Playbook Editor'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'live' && (
          <LiveControlTab
            state={state}
            currentItem={currentItem}
            onStart={handleStart}
            onNext={handleNext}
            onStop={handleStop}
            onEmergencyStop={handleEmergencyStop}
            onVoiceSessionStart={handleVoiceSessionStart}
            onVoiceSessionStop={handleVoiceSessionStop}
            onAudioToggle={handleAudioToggle}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            setSettings={setSettings}
            onSave={handleSaveSettings}
            saveMessage={saveMessage}
          />
        )}
        {activeTab === 'editor' && (
          <PlaybookEditorTab
            playbook={playbook}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onItemChange={handleItemChange}
            onAddItem={handleAddItem}
            onDeleteItem={handleDeleteItem}
            onMoveItem={handleMoveItem}
            onSave={handleSavePlaybook}
            onExport={handleExportPlaybook}
            onImport={handleImportPlaybook}
            onDownloadSample={handleDownloadSample}
            fileInputRef={fileInputRef}
            isSaving={isSaving}
            saveMessage={saveMessage}
          />
        )}
      </div>
    </div>
  );
}

// Live Control Tab Component
function LiveControlTab({
  state,
  currentItem,
  onStart,
  onNext,
  onStop,
  onEmergencyStop,
  onVoiceSessionStart,
  onVoiceSessionStop,
  onAudioToggle,
}: {
  state: AppState | null;
  currentItem: PlaybookItem | undefined;
  onStart: () => void;
  onNext: () => void;
  onStop: () => void;
  onEmergencyStop: () => void;
  onVoiceSessionStart: () => void;
  onVoiceSessionStop: () => void;
  onAudioToggle: () => void;
}) {
  const isMcTime = currentItem?.type === 'MC_TIME';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Control Panel */}
      <div className="space-y-6">
        {/* Main Status */}
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-4">진행 상태</h2>

          <div className="flex items-center gap-4 mb-4">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
              state?.isRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              <span className={`h-3 w-3 rounded-full ${
                state?.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></span>
              {state?.isRunning ? '진행 중' : '대기'}
            </span>

            {state?.voiceSessionActive && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-800">
                <span className="h-3 w-3 rounded-full bg-purple-500 animate-pulse"></span>
                음성 활성화
              </span>
            )}
          </div>

          {/* Current Item Display */}
          {currentItem && (
            <div className={`p-4 rounded-lg border-2 ${
              isMcTime ? 'bg-purple-50 border-purple-300' : 'bg-blue-50 border-blue-300'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-3 py-1 rounded text-sm font-bold ${
                  isMcTime ? 'bg-purple-200 text-purple-800' : 'bg-blue-200 text-blue-800'
                }`}>
                  {isMcTime ? '사회자 타임' : '세션'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{currentItem.title}</h3>
              {isMcTime && currentItem.script && (
                <p className="text-gray-600 text-sm mt-2 line-clamp-3">{currentItem.script}</p>
              )}
              {!isMcTime && currentItem.description && (
                <p className="text-gray-600 text-sm mt-2">{currentItem.description}</p>
              )}
            </div>
          )}
        </div>

        {/* Event Control */}
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-4">이벤트 제어</h2>
          <div className="flex flex-wrap gap-3">
            {!state?.isRunning ? (
              <button
                onClick={onStart}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
              >
                Start Event
              </button>
            ) : (
              <>
                <button
                  onClick={onNext}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Next
                </button>
                <button
                  onClick={onStop}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
                >
                  Stop
                </button>
              </>
            )}
            <button
              onClick={onEmergencyStop}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition"
            >
              비상 정지
            </button>
          </div>
        </div>

        {/* Voice Session Control (MC_TIME only) */}
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-4">음성 세션 제어</h2>
          <div className="flex flex-wrap gap-3">
            {!state?.voiceSessionActive ? (
              <button
                onClick={onVoiceSessionStart}
                disabled={!state?.isRunning || !isMcTime}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                음성 세션 시작
              </button>
            ) : (
              <button
                onClick={onVoiceSessionStop}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition"
              >
                음성 세션 종료
              </button>
            )}
            <button
              onClick={onAudioToggle}
              className={`px-6 py-3 rounded-lg font-medium transition ${
                state?.audioEnabled
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-gray-400 hover:bg-gray-500 text-white'
              }`}
            >
              {state?.audioEnabled ? '소리 켜짐' : '소리 꺼짐'}
            </button>
          </div>
          {!isMcTime && state?.isRunning && (
            <p className="mt-3 text-sm text-gray-500">
              * 음성 세션은 사회자 타임에서만 시작할 수 있습니다.
            </p>
          )}
        </div>

        {/* Progress List */}
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-4">진행 순서</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {state?.playbook.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border transition ${
                  item.id === state?.currentItemId
                    ? item.type === 'MC_TIME'
                      ? 'bg-purple-50 border-purple-300'
                      : 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    item.type === 'MC_TIME'
                      ? 'bg-purple-200 text-purple-700'
                      : 'bg-blue-200 text-blue-700'
                  }`}>
                    {item.type === 'MC_TIME' ? 'MC' : 'SESSION'}
                  </span>
                  <span className={`text-sm ${
                    item.id === state?.currentItemId ? 'font-bold' : 'text-gray-600'
                  }`}>
                    {item.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logs Panel */}
      <div className="bg-white rounded-xl p-6 shadow">
        <h2 className="text-lg font-semibold mb-4">실시간 로그</h2>
        <div className="bg-gray-900 rounded-lg p-4 h-[600px] overflow-y-auto">
          {state?.logs.length === 0 ? (
            <p className="text-gray-500 text-sm">로그가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {state?.logs.slice().reverse().map((log, idx) => (
                <div key={idx} className="text-sm font-mono">
                  <span className="text-gray-500">
                    {new Date(log.time).toLocaleTimeString()}
                  </span>
                  <span className="text-green-400 ml-2">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Settings Tab Component
function SettingsTab({
  settings,
  setSettings,
  onSave,
  saveMessage,
}: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  onSave: () => void;
  saveMessage: string | null;
}) {
  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl p-6 shadow">
        <h2 className="text-lg font-semibold mb-6">설정</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Avatar ID
            </label>
            <input
              type="text"
              value={settings.avatarId}
              onChange={(e) => setSettings({ ...settings, avatarId: e.target.value })}
              placeholder="default"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              HeyGen 아바타 ID (기본값: default)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MC 이름
            </label>
            <input
              type="text"
              value={settings.mcName}
              onChange={(e) => setSettings({ ...settings, mcName: e.target.value })}
              placeholder="두에나"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              공동사회자가 이 이름으로 부를 때만 AI가 응답합니다.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              설정 저장
            </button>
            {saveMessage && (
              <span className="text-green-600 text-sm">{saveMessage}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Playbook Editor Tab Component
function PlaybookEditorTab({
  playbook,
  selectedItem,
  onSelectItem,
  onItemChange,
  onAddItem,
  onDeleteItem,
  onMoveItem,
  onSave,
  onExport,
  onImport,
  onDownloadSample,
  fileInputRef,
  isSaving,
  saveMessage,
}: {
  playbook: PlaybookItem[];
  selectedItem: PlaybookItem | null;
  onSelectItem: (item: PlaybookItem) => void;
  onItemChange: (field: keyof PlaybookItem, value: string) => void;
  onAddItem: (type: 'MC_TIME' | 'SESSION') => void;
  onDeleteItem: (id: string) => void;
  onMoveItem: (id: string, direction: 'up' | 'down') => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadSample: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isSaving: boolean;
  saveMessage: string | null;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Item List */}
      <div className="bg-white rounded-xl p-6 shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">항목 목록</h2>
          <div className="flex gap-2">
            <button
              onClick={() => onAddItem('MC_TIME')}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition"
              title="사회자 타임 추가"
            >
              + MC
            </button>
            <button
              onClick={() => onAddItem('SESSION')}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition"
              title="세션 추가"
            >
              + 세션
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {playbook.map((item, index) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border transition cursor-pointer ${
                selectedItem?.id === item.id
                  ? item.type === 'MC_TIME'
                    ? 'bg-purple-50 border-purple-300'
                    : 'bg-blue-50 border-blue-300'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => onSelectItem(item)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                    item.type === 'MC_TIME'
                      ? 'bg-purple-200 text-purple-700'
                      : 'bg-blue-200 text-blue-700'
                  }`}>
                    {item.type === 'MC_TIME' ? 'MC' : 'S'}
                  </span>
                  <span className="text-sm truncate">{item.title}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveItem(item.id, 'up'); }}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveItem(item.id, 'down'); }}
                    disabled={index === playbook.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    ▼
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Import/Export */}
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onExport}
              className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition"
            >
              내보내기
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition"
            >
              가져오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={onImport}
              className="hidden"
            />
          </div>
          <button
            onClick={onDownloadSample}
            className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded transition"
          >
            샘플 JSON 다운로드
          </button>
        </div>
      </div>

      {/* Editor Form */}
      <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">편집</h2>
          <div className="flex items-center gap-3">
            {saveMessage && (
              <span className={`text-sm ${
                saveMessage.includes('완료') || saveMessage.includes('되었')
                  ? 'text-green-600'
                  : 'text-orange-600'
              }`}>
                {saveMessage}
              </span>
            )}
            <button
              onClick={onSave}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition"
            >
              {isSaving ? '저장 중...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {selectedItem ? (
          <div className="space-y-6">
            {/* Type (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                타입
              </label>
              <span className={`inline-block px-4 py-2 rounded-lg font-medium ${
                selectedItem.type === 'MC_TIME'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {selectedItem.type === 'MC_TIME' ? '사회자 타임' : '세션'}
              </span>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제목
              </label>
              <input
                type="text"
                value={selectedItem.title}
                onChange={(e) => onItemChange('title', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* MC_TIME specific fields */}
            {selectedItem.type === 'MC_TIME' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    대본 (Script)
                  </label>
                  <textarea
                    value={selectedItem.script || ''}
                    onChange={(e) => onItemChange('script', e.target.value)}
                    rows={5}
                    placeholder="AI 사회자가 참고할 대본을 입력하세요"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    공동사회자의 질문에 대한 예시 답변입니다.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI 행동 지침 (System Instruction)
                  </label>
                  <textarea
                    value={selectedItem.systemInstruction || ''}
                    onChange={(e) => onItemChange('systemInstruction', e.target.value)}
                    rows={4}
                    placeholder="AI의 역할과 행동 방식을 지정하세요"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              </>
            )}

            {/* SESSION specific fields */}
            {selectedItem.type === 'SESSION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명 (Description)
                </label>
                <textarea
                  value={selectedItem.description || ''}
                  onChange={(e) => onItemChange('description', e.target.value)}
                  rows={3}
                  placeholder="세션에 대한 설명을 입력하세요"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                <p className="mt-1 text-sm text-gray-500">
                  세션 중에는 AI 사회자가 등장하지 않습니다.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            편집할 항목을 선택해주세요.
          </div>
        )}
      </div>
    </div>
  );
}
