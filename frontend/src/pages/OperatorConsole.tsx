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

  const handlePrevious = async () => {
    try {
      const res = await fetch('/api/previous', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '이전 단계로 돌아갈 수 없습니다. (서버 재시작이 필요할 수 있습니다)');
      }
    } catch (err) {
      console.error('Failed to go previous:', err);
      alert('서버와 통신할 수 없습니다.');
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
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-cyan-500 selection:text-black">
      {/* Header */}
      <header className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
            <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-100">
              <span className="hidden sm:inline">AI MC </span><span className="text-cyan-400">OPERATOR</span><span className="hidden sm:inline"> CONSOLE</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex bg-gray-900 rounded-lg p-0.5 sm:p-1 border border-gray-800">
              {(['live', 'settings', 'editor'] as TabType[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${activeTab === tab
                    ? 'bg-gray-800 text-cyan-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                  {tab === 'live' ? (<><span className="sm:hidden">LIVE</span><span className="hidden sm:inline">LIVE CONTROL</span></>) : tab === 'settings' ? 'SETTINGS' : 'EDITOR'}
                </button>
              ))}
            </div>
            <Link
              to="/"
              target="_blank"
              className="p-2 sm:px-4 sm:py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg border border-gray-700 transition flex items-center gap-2"
            >
              <span className="hidden sm:inline">Main Stage</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto p-3 sm:p-6">
        {activeTab === 'live' && (
          <LiveControlTab
            state={state}
            currentItem={currentItem}
            onStart={handleStart}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onStop={handleStop}
            onEmergencyStop={handleEmergencyStop}
            onVoiceSessionStart={handleVoiceSessionStart}
            onVoiceSessionStop={handleVoiceSessionStop}
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
  onPrevious,
  onNext,
  onStop,
  onEmergencyStop,
  onVoiceSessionStart,
  onVoiceSessionStop,
}: {
  state: AppState | null;
  currentItem: PlaybookItem | undefined;
  onStart: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onStop: () => void;
  onEmergencyStop: () => void;
  onVoiceSessionStart: () => void;
  onVoiceSessionStop: () => void;
}) {
  const isMcTime = currentItem?.type === 'MC_TIME';

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 lg:h-[calc(100vh-8rem)]">
      {/* LEFT COLUMN: STATUS & CONTROLS (3/12) */}
      <div className="lg:col-span-3 flex flex-col gap-4 lg:gap-6">
        {/* Main Control Deck */}
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800/50 rounded-xl lg:rounded-2xl p-4 lg:p-6 lg:flex-1 flex flex-col">
          {/* Emergency Stop - Moved to TOP as requested */}
          <div className="mb-4 lg:mb-8 pb-4 lg:pb-6 border-b border-gray-800">
            <h2 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Emergency Override</h2>
            <button
              onClick={onEmergencyStop}
              className="w-full py-3 lg:py-4 bg-red-950/80 hover:bg-red-900 text-red-500 hover:text-red-400 rounded-lg font-bold text-sm lg:text-base border border-red-900/50 shadow-[0_0_15px_rgba(220,38,38,0.2)] transition-all active:scale-[0.98]"
            >
              EMERGENCY STOP
            </button>
          </div>

          {/* Updated Control Deck with Voice Controls */}
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 lg:mb-4">Playback Control</h2>
          <div className="grid grid-cols-2 gap-2 lg:gap-3 mb-4 lg:mb-6">
            {!state?.isRunning ? (
              <button
                onClick={onStart}
                className="col-span-2 py-6 lg:py-8 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-base lg:text-lg shadow-lg shadow-green-900/20 transition-all active:scale-[0.98]"
              >
                START EVENT
              </button>
            ) : (
              <>
                <button
                  onClick={onPrevious}
                  className="py-4 lg:py-6 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold text-sm lg:text-base border border-gray-700 transition-all active:scale-[0.98]"
                >
                  ◀ PREV
                </button>
                <button
                  onClick={onNext}
                  className="py-4 lg:py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm lg:text-base shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
                >
                  NEXT ▶
                </button>

                {/* Voice Control - Moved Here */}
                {isMcTime && (
                  <div className="col-span-2 mt-2">
                    {!state?.voiceSessionActive ? (
                      <button
                        onClick={onVoiceSessionStart}
                        className="w-full py-3 lg:py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm lg:text-base shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center gap-2 animate-pulse"
                      >
                        <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        ACTIVATE VOICE
                      </button>
                    ) : (
                      <button
                        onClick={onVoiceSessionStop}
                        className="w-full py-3 lg:py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm lg:text-base shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                        MUTE VOICE
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={onStop}
                  className="col-span-2 py-3 lg:py-4 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl font-medium text-sm lg:text-base border border-gray-700 transition-all mt-2"
                >
                  STOP EVENT
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Panel */}
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800/50 rounded-xl lg:rounded-2xl p-4 lg:p-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 lg:mb-4">System Status</h2>
          <div className="flex lg:flex-col gap-3 lg:gap-4">
            <div className="flex-1 lg:flex-none flex items-center justify-between p-2 lg:p-3 bg-gray-950/50 rounded-lg border border-gray-800">
              <span className="text-gray-400 text-xs lg:text-sm font-medium">Event</span>
              <div className="flex items-center gap-1 lg:gap-2">
                <span className={`w-2 h-2 rounded-full ${state?.isRunning ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}`}></span>
                <span className={`text-xs lg:text-sm font-bold ${state?.isRunning ? 'text-green-400' : 'text-gray-500'}`}>
                  {state?.isRunning ? 'RUNNING' : 'IDLE'}
                </span>
              </div>
            </div>
            <div className="flex-1 lg:flex-none flex items-center justify-between p-2 lg:p-3 bg-gray-950/50 rounded-lg border border-gray-800">
              <span className="text-gray-400 text-xs lg:text-sm font-medium">Audio</span>
              <div className="flex items-center gap-1 lg:gap-2">
                <span className={`w-2 h-2 rounded-full ${state?.voiceSessionActive ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]' : 'bg-gray-600'}`}></span>
                <span className={`text-xs lg:text-sm font-bold ${state?.voiceSessionActive ? 'text-purple-400' : 'text-gray-500'}`}>
                  {state?.voiceSessionActive ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER COLUMN: TELEPROMPTER & SCRIPT (5/12) */}
      <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-6 order-first lg:order-none">
        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-xl lg:rounded-2xl p-4 lg:p-8 lg:flex-1 flex flex-col relative overflow-hidden shadow-2xl min-h-[200px] lg:min-h-0">
          {/* Teleprompter Glass Overlay Reflection */}
          <div className="absolute top-0 left-0 right-0 h-16 lg:h-32 bg-gradient-to-b from-gray-800/20 to-transparent pointer-events-none"></div>

          <div className="flex items-start justify-between mb-4 lg:mb-8 relative z-10">
            <div className="flex flex-col gap-1 lg:gap-2">
              <div className="flex items-center gap-2 lg:gap-3">
                <span className={`px-1.5 lg:px-2 py-0.5 lg:py-1 text-[10px] lg:text-xs font-bold rounded ${isMcTime ? 'bg-purple-900/50 text-purple-300 border border-purple-700' : 'bg-blue-900/50 text-blue-300 border border-blue-700'}`}>
                  {isMcTime ? 'MC TIME' : 'SESSION'}
                </span>
                <h2 className="text-gray-400 text-xs lg:text-sm font-mono uppercase hidden sm:block">Current Segment</h2>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-4">
              {/* Voice Control Moved to Left Panel */}
              {state?.isRunning && (
                <div className="animate-pulse flex items-center gap-1 lg:gap-2 bg-red-950/50 px-2 lg:px-3 py-0.5 lg:py-1 rounded border border-red-900/50">
                  <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-red-500 rounded-full"></span>
                  <span className="text-red-500 text-[10px] lg:text-xs font-bold">ON AIR</span>
                </div>
              )}
            </div>
          </div>

          {currentItem ? (
            <div className="flex-1 flex flex-col justify-start pt-2 lg:pt-4 overflow-y-auto pr-2 lg:pr-4 scrollbar-thin scrollbar-thumb-gray-700">
              <h1 className="text-lg lg:text-2xl font-bold text-white mb-3 lg:mb-6 leading-tight">
                {currentItem.title}
              </h1>
              {isMcTime && currentItem.script && (
                <div className="bg-black/40 rounded-lg lg:rounded-xl p-3 lg:p-6 border-l-4 border-purple-500">
                  <p className="text-sm lg:text-lg text-gray-200 leading-relaxed font-medium whitespace-pre-wrap">
                    {currentItem.script}
                  </p>
                </div>
              )}
              {!isMcTime && currentItem.description && (
                <p className="text-sm lg:text-lg text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {currentItem.description}
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <p className="text-base lg:text-xl">Waiting to start...</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: PLAYLIST & LOGS (4/12) */}
      <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-6">
        {/* Playlist */}
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800/50 rounded-xl lg:rounded-2xl p-4 lg:p-6 lg:flex-1 flex flex-col min-h-0 max-h-[200px] lg:max-h-none">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 lg:mb-4">Run Order</h2>
          <div className="overflow-y-auto pr-2 space-y-1.5 lg:space-y-2 flex-1 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            {state?.playbook.map((item, idx) => {
              const isActive = item.id === state?.currentItemId;
              return (
                <div
                  key={item.id}
                  className={`p-2 lg:p-3 rounded-lg border transition-all ${isActive
                    ? item.type === 'MC_TIME'
                      ? 'bg-purple-900/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)] translate-x-1'
                      : 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)] translate-x-1'
                    : 'bg-gray-950/50 border-gray-800 hover:bg-gray-800'
                    }`}
                >
                  <div className="flex items-center gap-2 lg:gap-3">
                    <span className="text-gray-600 font-mono text-[10px] lg:text-xs w-4 lg:w-5">{(idx + 1).toString().padStart(2, '0')}</span>
                    <span className={`text-[9px] lg:text-[10px] px-1 lg:px-1.5 py-0.5 rounded border ${item.type === 'MC_TIME'
                      ? 'bg-purple-900/30 text-purple-300 border-purple-800'
                      : 'bg-blue-900/30 text-blue-300 border-blue-800'
                      }`}>
                      {item.type === 'MC_TIME' ? 'MC' : 'SES'}
                    </span>
                    <span className={`text-xs lg:text-sm truncate font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                      {item.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Console Logs - Hidden on mobile for simplicity */}
        <div className="hidden lg:flex bg-black/80 backdrop-blur border border-gray-800 rounded-2xl p-4 h-64 flex-col font-mono text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 uppercase tracking-wider text-[10px]">System Log</span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 p-2 scrollbar-thin scrollbar-thumb-gray-800">
            {state?.logs.length === 0 ? (
              <p className="text-gray-700 italic">No activity recorded.</p>
            ) : (
              state?.logs.slice().reverse().map((log, idx) => (
                <div key={idx} className="flex gap-2 hover:bg-white/5 p-0.5 rounded">
                  <span className="text-gray-600 shrink-0">
                    {new Date(log.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="text-green-400/90 break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Settings Tab Component (Dark Mode)
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
    <div className="max-w-3xl mx-auto py-4 lg:py-12">
      <div className="bg-gray-900 border border-gray-800 rounded-xl lg:rounded-2xl p-4 lg:p-8 shadow-xl">
        <h2 className="text-lg lg:text-xl font-bold text-white mb-4 lg:mb-8 flex items-center gap-2 lg:gap-3">
          <span className="p-1.5 lg:p-2 bg-gray-800 rounded-lg text-sm lg:text-base">⚙️</span>
          Configuration
        </h2>

        <div className="space-y-4 lg:space-y-8">
          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-400 mb-1.5 lg:mb-2">
              HeyGen Avatar ID
            </label>
            <input
              type="text"
              value={settings.avatarId}
              onChange={(e) => setSettings({ ...settings, avatarId: e.target.value })}
              className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-gray-950 border border-gray-700 rounded-lg lg:rounded-xl text-sm lg:text-base text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-600"
              placeholder="Enter Avatar ID"
            />
            <p className="mt-1.5 lg:mt-2 text-xs lg:text-sm text-gray-500">
              The external ID provided by HeyGen API.
            </p>
          </div>

          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-400 mb-1.5 lg:mb-2">
              MC Wake Word
            </label>
            <input
              type="text"
              value={settings.mcName}
              onChange={(e) => setSettings({ ...settings, mcName: e.target.value })}
              className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-gray-950 border border-gray-700 rounded-lg lg:rounded-xl text-sm lg:text-base text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-600"
              placeholder="두에나"
            />
            <p className="mt-1.5 lg:mt-2 text-xs lg:text-sm text-gray-500">
              The name the AI will respond to during voice sessions.
            </p>
          </div>

          <div className="pt-2 lg:pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:gap-4">
            <button
              onClick={onSave}
              className="px-6 lg:px-8 py-2.5 lg:py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg lg:rounded-xl font-bold text-sm lg:text-base transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
            >
              Save Configuration
            </button>
            {saveMessage && (
              <div className="flex items-center justify-center gap-2 text-green-400 bg-green-900/20 px-3 lg:px-4 py-2 rounded-lg border border-green-900/50 text-xs lg:text-sm">
                <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {saveMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Playbook Editor Tab Component (Dark Mode)
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
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadSample: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  saveMessage: string | null;
  isSaving: boolean;
  saveMessage: string | null;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 font-sans">
      {/* List Column */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl lg:rounded-2xl p-4 lg:p-6 flex flex-col max-h-[50vh] lg:max-h-none lg:h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h2 className="text-base lg:text-lg font-bold text-gray-200">Timeline</h2>
          <div className="flex gap-1.5 lg:gap-2">
            <button
              onClick={() => onAddItem('MC_TIME')}
              className="px-2 lg:px-3 py-1 lg:py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-600/50 text-[10px] lg:text-xs font-bold rounded transition"
            >
              + MC
            </button>
            <button
              onClick={() => onAddItem('SESSION')}
              className="px-2 lg:px-3 py-1 lg:py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-600/50 text-[10px] lg:text-xs font-bold rounded transition"
            >
              + SES
            </button>
          </div>
        </div>

        <div className="space-y-1.5 lg:space-y-2 flex-1 overflow-y-auto pr-1 lg:pr-2 scrollbar-thin scrollbar-thumb-gray-700">
          {playbook.map((item, index) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className={`group p-2 lg:p-3 rounded-lg border cursor-pointer transition-all ${selectedItem?.id === item.id
                ? 'bg-gray-800 border-gray-600 shadow-lg'
                : 'bg-gray-950/50 border-gray-800 hover:border-gray-700 hover:bg-gray-900'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                  <span className={`text-[9px] lg:text-[10px] px-1 lg:px-1.5 py-0.5 rounded border ${item.type === 'MC_TIME'
                    ? 'bg-purple-900/20 text-purple-400 border-purple-800'
                    : 'bg-blue-900/20 text-blue-400 border-blue-800'
                    }`}>
                    {item.type === 'MC_TIME' ? 'MC' : 'SES'}
                  </span>
                  <span className="text-xs lg:text-sm font-medium text-gray-300 truncate group-hover:text-white transition-colors">{item.title}</span>
                </div>
                <div className="flex gap-0.5 lg:gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveItem(item.id, 'up'); }}
                    disabled={index === 0}
                    className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-30 text-xs lg:text-sm"
                  >
                    ▲
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveItem(item.id, 'down'); }}
                    disabled={index === playbook.length - 1}
                    className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-30 text-xs lg:text-sm"
                  >
                    ▼
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                    className="p-1 text-red-900 hover:text-red-500 text-xs lg:text-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Bar */}
        <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-gray-800 grid grid-cols-2 gap-2 lg:gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 lg:px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] lg:text-xs font-bold rounded-lg transition"
          >
            IMPORT
          </button>
          <button
            onClick={onExport}
            className="px-2 lg:px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] lg:text-xs font-bold rounded-lg transition"
          >
            EXPORT
          </button>
          <button
            onClick={onDownloadSample}
            className="col-span-2 px-2 lg:px-4 py-2 bg-gray-950 hover:bg-gray-900 text-gray-500 hover:text-gray-400 text-[10px] lg:text-xs font-bold rounded-lg transition border border-gray-800"
          >
            DOWNLOAD SAMPLE
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={onImport}
            className="hidden"
          />
        </div>
      </div>

      {/* Editor Column */}
      <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl lg:rounded-2xl p-4 lg:p-6 min-h-[300px] lg:h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 lg:mb-6">
          <h2 className="text-base lg:text-lg font-bold text-gray-200">Details Editor</h2>
          <div className="flex items-center gap-2 lg:gap-3">
            {saveMessage && (
              <span className={`text-xs lg:text-sm ${saveMessage.includes('완료') || saveMessage.includes('저장되었습니다')
                ? 'text-green-400'
                : 'text-orange-400'
                }`}>
                {saveMessage}
              </span>
            )}
            <button
              onClick={onSave}
              disabled={isSaving}
              className="px-4 lg:px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 text-white rounded-lg font-bold text-xs lg:text-sm transition shadow-lg shadow-blue-900/20"
            >
              {isSaving ? 'SAVING...' : 'SAVE'}
            </button>
          </div>
        </div>

        {selectedItem ? (
          <div className="space-y-4 lg:space-y-6 overflow-y-auto flex-1 pr-1 lg:pr-2 scrollbar-thin scrollbar-thumb-gray-700">
            {/* Type Badge */}
            <div className="flex flex-wrap items-center gap-2 lg:gap-4">
              <span className={`inline-block px-2 lg:px-3 py-0.5 lg:py-1 rounded text-[10px] lg:text-xs font-bold uppercase tracking-wider ${selectedItem.type === 'MC_TIME'
                ? 'bg-purple-900/30 text-purple-300 border border-purple-800'
                : 'bg-blue-900/30 text-blue-300 border border-blue-800'
                }`}>
                {selectedItem.type === 'MC_TIME' ? 'MC Segment' : 'Session'}
              </span>
              <span className="text-[10px] lg:text-xs text-gray-500 font-mono truncate max-w-[150px] lg:max-w-none">{selectedItem.id}</span>
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 lg:mb-2">
                Title
              </label>
              <input
                type="text"
                value={selectedItem.title}
                onChange={(e) => onItemChange('title', e.target.value)}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-gray-950 border border-gray-700 rounded-lg lg:rounded-xl text-sm lg:text-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-700"
              />
            </div>

            {/* MC_TIME Fields */}
            {selectedItem.type === 'MC_TIME' && (
              <>
                <div className="flex-1">
                  <label className="block text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 lg:mb-2">
                    Script / Teleprompter
                  </label>
                  <textarea
                    value={selectedItem.script || ''}
                    onChange={(e) => onItemChange('script', e.target.value)}
                    rows={6}
                    className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-gray-950 border border-gray-700 rounded-lg lg:rounded-xl text-sm lg:text-base text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder-gray-700 font-medium leading-relaxed resize-none"
                    placeholder="Write the script here..."
                  />
                  <p className="mt-1.5 lg:mt-2 text-[10px] lg:text-xs text-gray-500">
                    This text will be displayed on the teleprompter during the show.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 lg:mb-2">
                    System Instruction (AI Core)
                  </label>
                  <textarea
                    value={selectedItem.systemInstruction || ''}
                    onChange={(e) => onItemChange('systemInstruction', e.target.value)}
                    rows={3}
                    className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-gray-950 border border-gray-700 rounded-lg lg:rounded-xl text-xs lg:text-sm text-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder-gray-700 resize-none font-mono"
                  />
                </div>
              </>
            )}

            {/* SESSION Fields */}
            {selectedItem.type === 'SESSION' && (
              <div>
                <label className="block text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 lg:mb-2">
                  Description / Cues
                </label>
                <textarea
                  value={selectedItem.description || ''}
                  onChange={(e) => onItemChange('description', e.target.value)}
                  rows={6}
                  className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-gray-950 border border-gray-700 rounded-lg lg:rounded-xl text-sm lg:text-base text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-700 resize-none"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <p className="text-sm lg:text-base">Select an item from the timeline to edit</p>
          </div>
        )}
      </div>
    </div>
  );
}
