import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import {
  getBoard, getCodeSession, getCodeVersions,
  getCodeVersionById, createCodeVersion
} from '../api';
import { useSocket } from '../hooks/useSocket';
import { useAuth }   from '../context/AuthContext';
import { useTheme }  from '../context/ThemeContext';

const LANGUAGES = [
  'javascript','typescript','python','java','cpp','c',
  'csharp','go','rust','php','ruby','swift','kotlin',
  'html','css','json','sql','bash','yaml','markdown',
];

const DEFAULT_CODE = {
  javascript: '// Start coding together!\nfunction hello() {\n  console.log("Hello, World!");\n}\n\nhello();',
  typescript: '// Start coding together!\nfunction hello(name: string): void {\n  console.log(`Hello, ${name}!`);\n}\n\nhello("World");',
  python:     '# Start coding together!\ndef hello():\n    print("Hello, World!")\n\nhello()',
  java:       '// Start coding together!\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  cpp:        '// Start coding together!\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  html:       '<!-- Start coding together! -->\n<!DOCTYPE html>\n<html>\n  <head><title>My Page</title></head>\n  <body>\n    <h1>Hello, World!</h1>\n  </body>\n</html>',
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

  const [board, setBoard]               = useState(null);
  const [language, setLanguage]         = useState('javascript');
  const [code, setCode]                 = useState(DEFAULT_CODE.javascript);
  const [peers, setPeers]               = useState([]);
  const [saving, setSaving]             = useState(false);
  const [lastEditedBy, setLastEditedBy] = useState(null);
  const [lastEditedAt, setLastEditedAt] = useState(null);
  const [isReceiving, setIsReceiving]   = useState(false);
  const [showHistory, setShowHistory]   = useState(false);
  const [versions, setVersions]         = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(null);
  const editorRef = useRef(null);
  const isDark    = theme === 'dark';

  /* ── Load board + saved code ──────────────────────────── */
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

  /* ── Load version history ─────────────────────────────── */
  const loadVersions = useCallback(() => {
    setLoadingVersions(true);
    getCodeVersions(boardId)
      .then(res => setVersions(res.data.versions))
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoadingVersions(false));
  }, [boardId]);

  useEffect(() => {
    if (showHistory) loadVersions();
  }, [showHistory, loadVersions]);

  /* ── Join editor room ─────────────────────────────────── */
  useEffect(() => {
    if (!boardId) return;
    emit('editor:join', { boardId });
    return () => emit('editor:leave', { boardId });
  }, [boardId, emit]);

  /* ── Listen for remote changes ────────────────────────── */
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

  /* ── Handle local code change ─────────────────────────── */
  const handleChange = useCallback((value) => {
    if (isReceiving) return;
    setCode(value);
    setLastEditedBy(user?.name);
    setLastEditedAt(new Date());
    emit('editor:change', { boardId, value, language, userName: user?.name, userId: user?.id });
  }, [boardId, emit, language, isReceiving, user]);

  /* ── Handle language change ───────────────────────────── */
  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    const newCode = DEFAULT_CODE[lang] || `// Start coding in ${lang}!`;
    setCode(newCode);
    setLastEditedBy(user?.name);
    setLastEditedAt(new Date());
    emit('editor:language_change', { boardId, language: lang });
    emit('editor:change', { boardId, value: newCode, language: lang, userName: user?.name, userId: user?.id });
  };

  /* ── Save with message ────────────────────────────────── */
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

  /* ── Restore a version ────────────────────────────────── */
  const handleRestore = async (versionId) => {
    try {
      const res = await getCodeVersionById(boardId, versionId);
      const v = res.data.version;
      setCode(v.code);
      setLanguage(v.language);
      emit('editor:change', { boardId, value: v.code, language: v.language, userName: user?.name, userId: user?.id });
      emit('editor:language_change', { boardId, language: v.language });
      setPreviewVersion(null);
      toast.success('Version restored!', { icon: '↩️' });
    } catch {
      toast.error('Failed to restore version');
    }
  };

  /* ── Ctrl+S ───────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setShowSaveDialog(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      emit('editor:cursor', {
        boardId,
        line:   e.position.lineNumber,
        column: e.position.column,
      });
    });
  };

  /* ── styles ───────────────────────────────────────────── */
  const s = {
    bg2:    { background: 'var(--bg-secondary)' },
    bgCard: { background: 'var(--bg-card)' },
    border: { borderColor: 'var(--border)' },
    text:   { color: 'var(--text-primary)' },
    muted:  { color: 'var(--text-muted)' },
    input:  { background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' },
  };

  return (
    <div className="h-screen flex overflow-hidden transition-colors duration-200" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Main editor area ──────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="flex-shrink-0 px-4 h-12 flex items-center gap-3 border-b" style={{ ...s.bg2, ...s.border }}>
          <button
            onClick={() => navigate(`/board/${boardId}`)}
            className="text-sm flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-brand-500/10 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            ← Board
          </button>
          <div className="w-px h-4" style={s.border} />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-brand-500" />
            <span className="font-semibold text-sm truncate" style={s.text}>
              {board?.title} — Editor
            </span>
          </div>

          <select
            value={language}
            onChange={handleLanguageChange}
            className="ml-1 rounded-lg px-3 py-1.5 text-sm border focus:outline-none capitalize"
            style={s.input}
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <div className="ml-auto flex items-center gap-2">

            {/* Last edited by */}
            {lastEditedBy && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border" style={{ ...s.bgCard, ...s.border }}>
                <span style={s.muted}>Last edit:</span>
                <span className="font-medium" style={s.text}>{lastEditedBy}</span>
                {lastEditedAt && <span style={s.muted}>{timeAgo(lastEditedAt)}</span>}
              </div>
            )}

            {/* Peers */}
            {peers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs" style={s.muted}>{peers.length} peer{peers.length !== 1 ? 's' : ''}</span>
                <div className="flex -space-x-1.5">
                  {peers.slice(0, 4).map(p => (
                    <div
                      key={p.userId}
                      title={`${p.userName} — Ln ${p.line}, Col ${p.column}`}
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold text-white"
                      style={{ background: p.color, borderColor: 'var(--bg-secondary)' }}
                    >
                      {p.userName?.[0]?.toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History toggle */}
            <button
              onClick={() => setShowHistory(h => !h)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${showHistory ? 'text-brand-500 border-brand-500/40 bg-brand-500/10' : 'hover:border-brand-500'}`}
              style={showHistory ? {} : { ...s.bgCard, ...s.border, color: 'var(--text-secondary)' }}
            >
              🕓 History
            </button>

            {/* Save button */}
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={saving}
              className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              {saving ? '⏳' : '💾'} Save
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all hover:border-brand-500 text-base"
              style={{ ...s.bgCard, ...s.border }}
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {/* You */}
            <div
              title={user?.name}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-brand-500"
              style={{ background: user?.avatar_color }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Monaco */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={language}
            value={previewVersion ? previewVersion.code : code}
            onChange={previewVersion ? undefined : handleChange}
            onMount={handleEditorMount}
            theme={isDark ? 'vs-dark' : 'light'}
            options={{
              fontSize: 14,
              fontFamily: 'DM Mono, Fira Code, monospace',
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              readOnly: !!previewVersion,
            }}
          />
        </div>

        {/* Preview banner */}
        {previewVersion && (
          <div className="flex-shrink-0 px-4 py-2 bg-amber-500/10 border-t border-amber-500/30 flex items-center gap-3">
            <span className="text-xs text-amber-400 font-medium">
              👁 Previewing: "{previewVersion.message}" by {previewVersion.saved_by_name} — {timeAgo(previewVersion.created_at)}
            </span>
            <button
              onClick={() => handleRestore(previewVersion.id)}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg font-medium"
            >
              ↩ Restore this version
            </button>
            <button
              onClick={() => setPreviewVersion(null)}
              className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded"
            >
              ✕ Cancel preview
            </button>
          </div>
        )}

        {/* Status bar */}
        <div
          className="flex-shrink-0 px-4 py-1 flex items-center gap-4 border-t text-[11px]"
          style={{ ...s.bg2, ...s.border, color: 'var(--text-muted)' }}
        >
          <span className="capitalize">{language}</span>
          <span>UTF-8</span>
          <span>Spaces: 2</span>
          {peers.length > 0 && (
            <span className="ml-auto text-green-500 animate-pulse">
              ● Live — {peers.length + 1} collaborating
            </span>
          )}
        </div>
      </div>

      {/* ── History sidebar ────────────────────────────────── */}
      {showHistory && (
        <div
          className="w-72 flex-shrink-0 flex flex-col border-l overflow-hidden"
          style={{ ...s.bg2, ...s.border }}
        >
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
                <p className="text-xs mt-1" style={s.muted}>Click Save to create your first snapshot</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {versions.map((v, i) => (
                  <div
                    key={v.id}
                    className={`px-4 py-3 transition-colors cursor-pointer hover:bg-brand-500/5 ${previewVersion?.id === v.id ? 'bg-brand-500/10 border-l-2 border-brand-500' : ''}`}
                    onClick={() => setPreviewVersion(previewVersion?.id === v.id ? null : v)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          {i === 0 && (
                            <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium">LATEST</span>
                          )}
                          <span className="text-xs font-medium truncate" style={s.text}>{v.message}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-brand-500">{v.saved_by_name}</span>
                          <span className="text-[10px]" style={s.muted}>·</span>
                          <span className="text-[10px] capitalize" style={s.muted}>{v.language}</span>
                        </div>
                        <p className="text-[10px] mt-0.5" style={s.muted}>{timeAgo(v.created_at)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestore(v.id); }}
                        className="text-[10px] text-brand-500 hover:text-brand-400 px-2 py-1 rounded border border-brand-500/30 hover:bg-brand-500/10 flex-shrink-0 transition-all"
                      >
                        ↩ Use
                      </button>
                    </div>
                    {/* Code preview snippet */}
                    <div
                      className="mt-2 rounded text-[10px] font-mono px-2 py-1.5 overflow-hidden"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', maxHeight: 48 }}
                    >
                      {v.code_preview?.slice(0, 100)}…
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Save dialog ────────────────────────────────────── */}
      {showSaveDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaveDialog(false); }}
        >
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
              <button
                onClick={() => handleSave(saveMsg || 'Manual save')}
                disabled={saving}
                className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {saving ? 'Saving…' : '💾 Save'}
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 rounded-lg text-sm border transition-colors"
                style={{ ...s.bgCard, ...s.border, color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}