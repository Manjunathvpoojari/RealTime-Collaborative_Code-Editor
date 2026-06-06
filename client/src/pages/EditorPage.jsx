import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import {
  getBoard, getCodeSession, getCodeVersions,
  getCodeVersionById, createCodeVersion, runCode,
} from '../api';
import { useSocket } from '../hooks/useSocket';
import { useAuth }   from '../context/AuthContext';
import { useTheme }  from '../context/ThemeContext';

const SUPPORTED_RUN = ['javascript', 'python', 'java', 'cpp', 'c', 'typescript'];

const LANGUAGES = [
  'javascript','typescript','python','java','cpp','c',
  'csharp','go','rust','php','ruby','swift','kotlin',
  'html','css','json','sql','bash','yaml','markdown',
];

const DEFAULT_CODE = {
  javascript: '// Start coding together!\nfunction hello() {\n  console.log("Hello, World!");\n}\n\nhello();',
  typescript: '// Start coding!\nfunction hello(name: string): void {\n  console.log(`Hello, ${name}!`);\n}\nhello("World");',
  python:     '# Start coding together!\ndef hello():\n    print("Hello, World!")\n\nhello()',
  java:       '// Start coding together!\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  cpp:        '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  html:       '<!DOCTYPE html>\n<html>\n  <head><title>My Page</title></head>\n  <body>\n    <h1>Hello, World!</h1>\n  </body>\n</html>',
};

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function EditorPage() {
  const { boardId }  = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { emit, on } = useSocket();
  const isDark = theme === 'dark';

  const [board, setBoard]                   = useState(null);
  const [language, setLanguage]             = useState('javascript');
  const [code, setCode]                     = useState(DEFAULT_CODE.javascript);
  const [peers, setPeers]                   = useState([]);
  const [saving, setSaving]                 = useState(false);
  const [lastEditedBy, setLastEditedBy]     = useState(null);
  const [lastEditedAt, setLastEditedAt]     = useState(null);
  const [isReceiving, setIsReceiving]       = useState(false);
  const [showHistory, setShowHistory]       = useState(false);
  const [showOutput, setShowOutput]         = useState(false);
  const [versions, setVersions]             = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [saveMsg, setSaveMsg]               = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(null);
  const [running, setRunning]               = useState(false);
  const [output, setOutput]                 = useState(null); // { stdout, stderr, time, status }
  const editorRef = useRef(null);

  /* ─── styles helper ──────────────────────────────────── */
  const s = {
    bg:     { background: 'var(--bg-primary)' },
    bg2:    { background: 'var(--bg-secondary)' },
    bgCard: { background: 'var(--bg-card)' },
    border: { borderColor: 'var(--border)' },
    text:   { color: 'var(--text-primary)' },
    muted:  { color: 'var(--text-muted)' },
    input:  { background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' },
  };

  /* ── Load board + saved code ────────────────────────── */
  useEffect(() => {
    getBoard(boardId)
      .then(res => setBoard(res.data.board))
      .catch(() => { toast.error('Board not found'); navigate('/dashboard'); });

    getCodeSession(boardId).then(res => {
      if (res.data.session) {
        setCode(res.data.session.code);
        setLanguage(res.data.session.language);
      }
    }).catch(() => {});
  }, [boardId, navigate]);

  /* ── Load versions ──────────────────────────────────── */
  const loadVersions = useCallback(() => {
    setLoadingVersions(true);
    getCodeVersions(boardId)
      .then(res => setVersions(res.data.versions))
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoadingVersions(false));
  }, [boardId]);

  useEffect(() => { if (showHistory) loadVersions(); }, [showHistory, loadVersions]);

  /* ── Socket join/leave ──────────────────────────────── */
  useEffect(() => {
    if (!boardId) return;
    emit('editor:join', { boardId });
    return () => emit('editor:leave', { boardId });
  }, [boardId, emit]);

  /* ── Socket listeners ───────────────────────────────── */
  useEffect(() => {
    if (!boardId) return;
    const offs = [
      on('editor:changed', ({ value, language: lang, userName, userId }) => {
        if (userId === user?.id) return;
        setIsReceiving(true);
        setCode(value);
        setLanguage(lang);
        setLastEditedBy(userName);
        setLastEditedAt(new Date());
        setTimeout(() => setIsReceiving(false), 50);
      }),
      on('editor:language_changed', ({ language: lang, userName }) => {
        setLanguage(lang);
        setCode(DEFAULT_CODE[lang] || `// Start coding in ${lang}!`);
        setLastEditedBy(userName);
        setLastEditedAt(new Date());
        toast(`${userName} switched to ${lang}`, { icon: '🔤', duration: 2000 });
      }),
      on('editor:user_left', ({ userId }) => {
        setPeers(prev => prev.filter(p => p.userId !== userId));
      }),
      on('editor:cursor_update', ({ userId, userName, color, line, column }) => {
        setPeers(prev => {
          const exists = prev.find(p => p.userId === userId);
          if (exists) return prev.map(p => p.userId === userId ? { ...p, line, column } : p);
          return [...prev, { userId, userName, color, line, column }];
        });
      }),
    ];
    return () => offs.forEach(off => off && off());
  }, [boardId, on, user?.id]);

  /* ── Code change ────────────────────────────────────── */
  const handleChange = useCallback((value) => {
    if (isReceiving) return;
    setCode(value);
    setLastEditedBy(user?.name);
    setLastEditedAt(new Date());
    emit('editor:change', { boardId, value, language, userName: user?.name, userId: user?.id });
  }, [boardId, emit, language, isReceiving, user]);

  /* ── Language change ────────────────────────────────── */
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    const newCode = DEFAULT_CODE[lang] || `// Start coding in ${lang}!`;
    setCode(newCode);
    setLastEditedBy(user?.name);
    setLastEditedAt(new Date());
    emit('editor:language_change', { boardId, language: lang });
    emit('editor:change', { boardId, value: newCode, language: lang, userName: user?.name, userId: user?.id });
  };

  /* ── Save ───────────────────────────────────────────── */
  const handleSave = useCallback(async (message = 'Manual save') => {
    setSaving(true);
    try {
      await createCodeVersion(boardId, code, language, message);
      setLastEditedBy(user?.name);
      setLastEditedAt(new Date());
      toast.success(`Saved: "${message}"`, { icon: '💾' });
      setShowSaveDialog(false);
      setSaveMsg('');
      if (showHistory) loadVersions();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [boardId, code, language, user, showHistory, loadVersions]);

  /* ── Run code ───────────────────────────────────────── */
  const handleRun = useCallback(async () => {
    // JavaScript runs in browser directly
    if (language === 'javascript') {
      setRunning(true);
      setShowOutput(true);
      setOutput(null);
      const logs = [];
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      try {
        console.log = (...args) => { logs.push({ type: 'log',   text: args.join(' ') }); };
        console.error = (...args) => { logs.push({ type: 'error', text: args.join(' ') }); };
        console.warn = (...args) => { logs.push({ type: 'warn',  text: args.join(' ') }); };
        const fn = new Function(code);
        const start = performance.now();
        fn();
        const time = ((performance.now() - start) / 1000).toFixed(3);
        setOutput({
          stdout: logs.map(l => l.text).join('\n'),
          stderr: '',
          logs,
          time,
          status: { description: 'Accepted' },
        });
      } catch (err) {
        setOutput({
          stdout: logs.map(l => l.text).join('\n'),
          stderr: err.message,
          logs,
          time: '0',
          status: { description: 'Runtime Error' },
        });
      } finally {
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        setRunning(false);
      }
      return;
    }

    // Python / Java via Judge0
    setRunning(true);
    setShowOutput(true);
    setOutput(null);
    try {
      const res = await runCode(code, language);
      setOutput(res.data);
    } catch {
      setOutput({ stdout: '', stderr: 'Execution service unavailable.', time: '0', status: { description: 'Error' } });
    } finally {
      setRunning(false);
    }
  }, [code, language]);

  /* ── Restore version ────────────────────────────────── */
  const handleRestore = async (versionId) => {
    try {
      const res = await getCodeVersionById(boardId, versionId);
      const v = res.data.version;
      setCode(v.code);
      setLanguage(v.language);
      emit('editor:change', { boardId, value: v.code, language: v.language, userName: user?.name, userId: user?.id });
      setPreviewVersion(null);
      toast.success('Version restored!', { icon: '↩️' });
    } catch {
      toast.error('Failed to restore version');
    }
  };

  /* ── Ctrl+S / Ctrl+Enter ────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); setShowSaveDialog(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRun]);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      emit('editor:cursor', { boardId, line: e.position.lineNumber, column: e.position.column });
    });
  };

  const canRun = SUPPORTED_RUN.includes(language);
  const statusColor = output?.status?.description === 'Accepted' ? '#22c98a' : '#f87171';

  return (
    <div className="h-screen flex flex-col overflow-hidden transition-colors duration-200" style={s.bg}>

      {/* ── TOP HEADER ──────────────────────────────────── */}
      <header
        className="flex-shrink-0 px-4 flex items-center gap-3 border-b transition-colors duration-200"
        style={{ ...s.bg2, ...s.border, height: 52 }}
      >
        {/* Back */}
        <button
          onClick={() => navigate(`/board/${boardId}`)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all hover:border-brand-500 hover:text-brand-500"
          style={{ ...s.bgCard, ...s.border, color: 'var(--text-muted)' }}
        >
          ← Board
        </button>

        <div className="w-px h-5" style={{ background: 'var(--border)' }} />

        {/* Title */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0" />
          <span className="font-semibold text-sm truncate" style={s.text}>
            {board?.title}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-md border font-mono flex-shrink-0"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            editor
          </span>
        </div>

        {/* Language tabs */}
        <div className="hidden md:flex items-center gap-1 ml-2 p-1 rounded-lg border" style={{ ...s.bgCard, ...s.border }}>
          {LANGUAGES.slice(0, 6).map(lang => (
            <button
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize"
              style={{
                background: language === lang ? '#4a8df8' : 'transparent',
                color: language === lang ? '#fff' : 'var(--text-muted)',
              }}
            >
              {lang}
            </button>
          ))}
          <select
            value={LANGUAGES.slice(6).includes(language) ? language : ''}
            onChange={e => e.target.value && handleLanguageChange(e.target.value)}
            className="px-2 py-1 rounded-md text-xs border-0 focus:outline-none capitalize"
            style={{ background: 'transparent', color: 'var(--text-muted)' }}
          >
            <option value="">more…</option>
            {LANGUAGES.slice(6).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">

          {/* Last edit info */}
          {lastEditedBy && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border"
              style={{ ...s.bgCard, ...s.border }}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span style={s.muted}>{lastEditedBy}</span>
              <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{timeAgo(lastEditedAt)}</span>
            </div>
          )}

          {/* Peers */}
          {peers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <div className="flex -space-x-1.5">
                {peers.slice(0, 3).map(p => (
                  <div key={p.userId} title={`${p.userName} — Ln ${p.line}`}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold text-white"
                    style={{ background: p.color, borderColor: 'var(--bg-secondary)' }}>
                    {p.userName?.[0]?.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Run button */}
          {canRun ? (
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-50"
              style={{
                background: running ? 'var(--bg-card)' : '#22c98a',
                color: running ? 'var(--text-muted)' : '#0a0a0a',
                border: running ? '1px solid var(--border)' : 'none',
              }}
              title="Run code (Ctrl+Enter)"
            >
              {running
                ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Running…</>
                : <>▶ Run</>
              }
            </button>
          ) : (
            <div className="text-xs px-3 py-1.5 rounded-lg border" style={{ ...s.bgCard, ...s.border, color: 'var(--text-muted)' }}
              title={`Running ${language} is not supported yet`}>
              ▶ Run
            </div>
          )}

          {/* Output toggle */}
          <button
            onClick={() => setShowOutput(o => !o)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${showOutput ? 'border-brand-500/40 bg-brand-500/10 text-brand-500' : ''}`}
            style={showOutput ? {} : { ...s.bgCard, ...s.border, color: 'var(--text-muted)' }}
          >
            ⬛ Output
          </button>

          {/* History */}
          <button
            onClick={() => setShowHistory(h => !h)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${showHistory ? 'border-brand-500/40 bg-brand-500/10 text-brand-500' : ''}`}
            style={showHistory ? {} : { ...s.bgCard, ...s.border, color: 'var(--text-muted)' }}
          >
            🕓 History
          </button>

          {/* Save */}
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={saving}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition-colors"
            title="Save snapshot (Ctrl+S)"
          >
            {saving ? '⏳' : '💾'} Save
          </button>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all hover:border-brand-500"
            style={{ ...s.bgCard, ...s.border }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* You */}
          <div title={user?.name}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-brand-500"
            style={{ background: user?.avatar_color }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── MAIN AREA ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── EDITOR + OUTPUT ─────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Preview banner */}
          {previewVersion && (
            <div className="flex-shrink-0 px-4 py-2 flex items-center gap-3 border-b"
              style={{ background: 'rgba(240,165,58,0.08)', borderColor: 'rgba(240,165,58,0.3)' }}>
              <span className="text-xs text-amber-400 font-medium flex-1">
                👁 Previewing: "{previewVersion.message}" by {previewVersion.saved_by_name} — {timeAgo(previewVersion.created_at)}
              </span>
              <button onClick={() => handleRestore(previewVersion.id)}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg font-medium">
                ↩ Restore
              </button>
              <button onClick={() => setPreviewVersion(null)}
                className="text-xs text-amber-400 hover:text-amber-300 px-2">✕</button>
            </div>
          )}

          {/* Monaco editor */}
          <div className={`overflow-hidden transition-all ${showOutput ? 'flex-[3]' : 'flex-1'}`}>
            <Editor
              height="100%"
              language={language}
              value={previewVersion ? previewVersion.code : code}
              onChange={previewVersion ? undefined : handleChange}
              onMount={handleEditorMount}
              theme={isDark ? 'vs-dark' : 'light'}
              options={{
                fontSize: 14,
                fontFamily: 'DM Mono, Fira Code, Cascadia Code, monospace',
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                formatOnPaste: true,
                formatOnType: true,
                readOnly: !!previewVersion,
                padding: { top: 12 },
              }}
            />
          </div>

          {/* ── OUTPUT PANEL ─────────────────────────────── */}
          {showOutput && (
            <div className="flex-[2] flex flex-col border-t overflow-hidden" style={{ ...s.border, maxHeight: '40%' }}>

              {/* Output header */}
              <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b" style={{ ...s.bg2, ...s.border }}>
                <span className="text-xs font-semibold font-mono" style={s.text}>Output</span>

                {output?.status && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}>
                    {output.status.description}
                  </span>
                )}

                {output?.time && (
                  <span className="text-xs font-mono" style={s.muted}>⏱ {output.time}s</span>
                )}

                {!canRun && (
                  <span className="text-xs" style={{ color: '#f0a53a' }}>
                    ⚠ {language} execution not supported — only JS, Python, Java
                  </span>
                )}

                <button onClick={() => setOutput(null)} className="ml-auto text-xs px-2 py-1 rounded" style={s.muted}>
                  Clear
                </button>
                <button onClick={() => setShowOutput(false)} className="text-xs px-2 py-1 rounded" style={s.muted}>
                  ✕
                </button>
              </div>

              {/* Output body */}
              <div className="flex-1 overflow-auto p-4 font-mono text-sm" style={{ background: isDark ? '#0d1117' : '#f6f8fa' }}>
                {running && (
                  <div className="flex items-center gap-2" style={{ color: '#22c98a' }}>
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                    <span className="text-xs">Executing code…</span>
                  </div>
                )}

                {!running && !output && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {canRun
                      ? `Press ▶ Run or Ctrl+Enter to execute ${language} code`
                      : `${language} execution is not supported. Switch to JavaScript, Python, or Java to run code.`
                    }
                  </div>
                )}

                {!running && output && (
                  <div className="space-y-2">
                    {/* stdout */}
                    {output.stdout && output.stdout.trim() && (
                      <div>
                        <div className="text-[10px] font-mono mb-1" style={{ color: '#22c98a' }}>STDOUT</div>
                        <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: isDark ? '#e8eaf0' : '#1f2937' }}>
                          {output.stdout}
                        </pre>
                      </div>
                    )}

                    {/* stderr */}
                    {output.stderr && output.stderr.trim() && (
                      <div>
                        <div className="text-[10px] font-mono mb-1" style={{ color: '#f87171' }}>STDERR</div>
                        <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#f87171' }}>
                          {output.stderr}
                        </pre>
                      </div>
                    )}

                    {/* empty output */}
                    {!output.stdout?.trim() && !output.stderr?.trim() && (
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        ✓ Code ran successfully with no output
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── HISTORY SIDEBAR ──────────────────────────────── */}
        {showHistory && (
          <div className="w-72 flex-shrink-0 flex flex-col border-l overflow-hidden" style={{ ...s.bg2, ...s.border }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={s.border}>
              <div>
                <h3 className="text-sm font-semibold" style={s.text}>Version History</h3>
                <p className="text-xs mt-0.5" style={s.muted}>{versions.length} saves</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-sm hover:text-red-400 transition-colors" style={s.muted}>✕</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingVersions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="text-3xl mb-2">💾</div>
                  <p className="text-sm" style={s.muted}>No saves yet</p>
                  <p className="text-xs mt-1" style={s.muted}>Press Ctrl+S to save a snapshot</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {versions.map((v, i) => (
                    <div
                      key={v.id}
                      className={`px-4 py-3 cursor-pointer transition-colors hover:bg-brand-500/5 ${previewVersion?.id === v.id ? 'bg-brand-500/10 border-l-2 border-brand-500' : ''}`}
                      onClick={() => setPreviewVersion(previewVersion?.id === v.id ? null : v)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            {i === 0 && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium">LATEST</span>}
                            <span className="text-xs font-medium truncate" style={s.text}>{v.message}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-medium text-brand-500">{v.saved_by_name}</span>
                            <span style={s.muted} className="text-[10px]">·</span>
                            <span className="text-[10px] capitalize" style={s.muted}>{v.language}</span>
                          </div>
                          <p className="text-[10px] mt-0.5" style={s.muted}>{timeAgo(v.created_at)}</p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleRestore(v.id); }}
                          className="text-[10px] text-brand-500 hover:text-brand-400 px-2 py-1 rounded border border-brand-500/30 hover:bg-brand-500/10 flex-shrink-0 transition-all"
                        >↩ Use</button>
                      </div>
                      <div className="mt-2 rounded text-[10px] font-mono px-2 py-1.5 overflow-hidden"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', maxHeight: 48 }}>
                        {v.code_preview?.slice(0, 100)}…
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── STATUS BAR ───────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 py-1 flex items-center gap-4 border-t text-[11px] font-mono transition-colors"
        style={{ ...s.bg2, ...s.border, color: 'var(--text-muted)' }}
      >
        <span className="capitalize">{language}</span>
        <span>UTF-8</span>
        <span>Spaces: 2</span>
        {canRun && <span style={{ color: '#22c98a' }}>▶ Ctrl+Enter to run</span>}
        <span>💾 Ctrl+S to save</span>
        {peers.length > 0 && (
          <span className="ml-auto text-green-500 animate-pulse">● Live — {peers.length + 1} collaborating</span>
        )}
      </div>

      {/* ── SAVE DIALOG ──────────────────────────────────── */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSaveDialog(false); }}>
          <div className="w-full max-w-sm rounded-2xl p-6 border shadow-2xl" style={{ ...s.bg2, ...s.border }}>
            <h3 className="font-semibold text-base mb-1" style={s.text}>Save Snapshot</h3>
            <p className="text-xs mb-4" style={s.muted}>Describe what changed in this version</p>
            <input
              autoFocus
              type="text"
              value={saveMsg}
              onChange={e => setSaveMsg(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave(saveMsg || 'Manual save');
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
              placeholder="e.g. Added login function"
              className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-500 mb-4"
              style={s.input}
            />
            <div className="flex gap-2">
              <button onClick={() => handleSave(saveMsg || 'Manual save')} disabled={saving}
                className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm">
                {saving ? 'Saving…' : '💾 Save'}
              </button>
              <button onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 rounded-lg text-sm border transition-colors"
                style={{ ...s.bgCard, ...s.border, color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}