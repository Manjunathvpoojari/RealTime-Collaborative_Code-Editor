import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import { getBoard, getCodeSession, saveCodeSession } from '../api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c',
  'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
  'html', 'css', 'json', 'sql', 'bash', 'yaml', 'markdown',
];

const DEFAULT_CODE = {
  javascript: '// Start coding together!\nfunction hello() {\n  console.log("Hello, World!");\n}\n\nhello();',
  typescript: '// Start coding together!\nfunction hello(name: string): void {\n  console.log(`Hello, ${name}!`);\n}\n\nhello("World");',
  python:     '# Start coding together!\ndef hello():\n    print("Hello, World!")\n\nhello()',
  java:       '// Start coding together!\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  cpp:        '// Start coding together!\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  html:       '<!-- Start coding together! -->\n<!DOCTYPE html>\n<html>\n  <head><title>My Page</title></head>\n  <body>\n    <h1>Hello, World!</h1>\n  </body>\n</html>',
};

export default function EditorPage() {
  const { boardId } = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { emit, on } = useSocket();

  const [board, setBoard]           = useState(null);
  const [language, setLanguage]     = useState('javascript');
  const [code, setCode]             = useState(DEFAULT_CODE.javascript);
  const [peers, setPeers]           = useState([]);
  const [saving, setSaving]         = useState(false);
  const [lastSaved, setLastSaved]   = useState(null);
  const [isReceiving, setIsReceiving] = useState(false);
  const editorRef = useRef(null);

  /* ── Load board + saved code ───────────────────────────── */
  useEffect(() => {
    getBoard(boardId)
      .then(res => setBoard(res.data.board))
      .catch(() => { toast.error('Board not found'); navigate('/dashboard'); });

    getCodeSession(boardId).then(res => {
      if (res.data.session) {
        setCode(res.data.session.code);
        setLanguage(res.data.session.language);
        setLastSaved(new Date(res.data.session.updated_at));
        toast.success('Previous session loaded', { icon: '💾' });
      }
    }).catch(() => {});
  }, [boardId, navigate]);

  /* ── Join editor room ──────────────────────────────────── */
  useEffect(() => {
    if (!boardId) return;
    emit('editor:join', { boardId });
    return () => emit('editor:leave', { boardId });
  }, [boardId, emit]);

  /* ── Listen for remote changes ─────────────────────────── */
  useEffect(() => {
    if (!boardId) return;
    const offs = [
      on('editor:changed', ({ value, language: lang }) => {
        setIsReceiving(true);
        setCode(value);
        setLanguage(lang);
        setTimeout(() => setIsReceiving(false), 50);
      }),
      on('editor:language_changed', ({ language: lang, userName }) => {
        setLanguage(lang);
        setCode(DEFAULT_CODE[lang] || `// Start coding in ${lang}!`);
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
  }, [boardId, on]);

  /* ── Handle local code change ──────────────────────────── */
  const handleChange = useCallback((value) => {
    if (isReceiving) return;
    setCode(value);
    emit('editor:change', { boardId, value, language });
  }, [boardId, emit, language, isReceiving]);

  /* ── Handle language change ────────────────────────────── */
  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    const newCode = DEFAULT_CODE[lang] || `// Start coding in ${lang}!`;
    setCode(newCode);
    emit('editor:language_change', { boardId, language: lang });
    emit('editor:change', { boardId, value: newCode, language: lang });
  };

  /* ── Save to database ──────────────────────────────────── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveCodeSession(boardId, code, language);
      setLastSaved(new Date());
      toast.success('Code saved!', { icon: '💾' });
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [boardId, code, language]);

  /* ── Ctrl+S to save ────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  /* ── Handle cursor move ────────────────────────────────── */
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

  const isDark = theme === 'dark';

  return (
    <div
      className="h-screen flex flex-col overflow-hidden transition-colors duration-200"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 px-4 h-12 flex items-center gap-3 border-b transition-colors duration-200"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        {/* Back */}
        <button
          onClick={() => navigate(`/board/${boardId}`)}
          className="text-sm flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-brand-500/10"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Board
        </button>

        <div className="w-px h-4" style={{ background: 'var(--border)' }} />

        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-500" />
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {board?.title} — Editor
          </span>
        </div>

        {/* Language selector */}
        <select
          value={language}
          onChange={handleLanguageChange}
          className="ml-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 border capitalize transition-colors"
          style={{
            background: 'var(--bg-input)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {LANGUAGES.map(lang => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {/* Last saved */}
          {lastSaved && (
            <span className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}

          {/* Peers */}
          {peers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {peers.length} peer{peers.length !== 1 ? 's' : ''}
              </span>
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

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            {saving ? '⏳ Saving…' : '💾 Save'}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all hover:border-brand-500 text-base"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
            title={isDark ? 'Light mode' : 'Dark mode'}
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

      {/* ── Monaco Editor ───────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleChange}
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
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>

      {/* ── Status bar ─────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 py-1 flex items-center gap-4 border-t text-[11px] transition-colors"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
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
  );
}