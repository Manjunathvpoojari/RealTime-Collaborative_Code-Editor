import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getBoards, createBoard, deleteBoard } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { disconnectSocket } from '../hooks/useSocket';

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [boards, setBoards]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc]   = useState('');
  const [creating, setCreating] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    getBoards()
      .then(res => setBoards(res.data.boards))
      .catch(() => toast.error('Failed to load boards'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await createBoard({ title: newTitle.trim(), description: newDesc.trim() });
      setBoards(prev => [res.data.board, ...prev]);
      setShowNew(false); setNewTitle(''); setNewDesc('');
      toast.success('Board created!');
      navigate(`/board/${res.data.board.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create board');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, boardId) => {
    e.stopPropagation();
    if (!confirm('Delete this board? This cannot be undone.')) return;
    try {
      await deleteBoard(boardId);
      setBoards(prev => prev.filter(b => b.id !== boardId));
      toast.success('Board deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleSignOut = () => {
    disconnectSocket();
    signOut();
    navigate('/login');
  };

  /* ── styles ─────────────────────────────────────────────── */
  const bg      = isDark ? '#0f1117' : '#f0f2f7';
  const headerBg = isDark ? '#161b27' : '#ffffff';
  const border   = isDark ? '#252d42' : '#e2e6f0';
  const cardBg   = isDark ? '#161b27' : '#ffffff';
  const inputBg  = isDark ? '#1c2232' : '#f8f9fc';

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ background: bg }}>

      {/* Header */}
      <header className="border-b transition-colors duration-200" style={{ background: headerBg, borderColor: border }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="8" rx="1.5" fill="white" fillOpacity=".9"/>
                <rect x="9" y="1" width="6" height="5" rx="1.5" fill="white" fillOpacity=".6"/>
                <rect x="9" y="8" width="6" height="7" rx="1.5" fill="white" fillOpacity=".6"/>
                <rect x="1" y="11" width="6" height="4" rx="1.5" fill="white" fillOpacity=".9"/>
              </svg>
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>CollabBoard</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                style={{ background: user?.avatar_color }}
              >
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm hidden sm:block" style={{ color: 'var(--text-secondary)' }}>{user?.name}</span>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all hover:border-brand-500 text-base"
              style={{ background: inputBg, borderColor: border }}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            <button
              onClick={handleSignOut}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>My Boards</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {boards.length} board{boards.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <span className="text-lg leading-none">+</span> New board
          </button>
        </div>

        {/* New board form */}
        {showNew && (
          <div
            className="rounded-xl p-5 mb-6 border animate-slide-down"
            style={{ background: headerBg, borderColor: border }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Create new board</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Board name"
                className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-500"
                style={{ background: inputBg, borderColor: border, color: 'var(--text-primary)' }}
              />
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-500"
                style={{ background: inputBg, borderColor: border, color: 'var(--text-primary)' }}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
                >
                  {creating ? 'Creating…' : 'Create board'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNew(false); setNewTitle(''); setNewDesc(''); }}
                  className="px-4 py-2 rounded-lg text-sm border transition-colors"
                  style={{ background: inputBg, borderColor: border, color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Board grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl h-32 animate-pulse border" style={{ background: headerBg, borderColor: border }} />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 border" style={{ background: inputBg, borderColor: border }}>
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" className="opacity-40">
                <rect x="1" y="1" width="6" height="8" rx="1.5" fill="currentColor"/>
                <rect x="9" y="1" width="6" height="5" rx="1.5" fill="currentColor"/>
                <rect x="9" y="8" width="6" height="7" rx="1.5" fill="currentColor"/>
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No boards yet — create your first one above</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map(board => (
              <div
                key={board.id}
                onClick={() => navigate(`/board/${board.id}`)}
                className="group rounded-xl p-5 cursor-pointer transition-all relative border hover:shadow-lg"
                style={{ background: cardBg, borderColor: border }}
              >
                {board.owner_id === user?.id && (
                  <button
                    onClick={(e) => handleDelete(e, board.id)}
                    className="absolute top-3 right-3 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs hover:text-red-400"
                    style={{ color: 'var(--text-muted)', background: inputBg }}
                  >
                    ✕
                  </button>
                )}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="1" width="6" height="8" rx="1.5" fill="#4a8df8" fillOpacity=".8"/>
                      <rect x="9" y="1" width="6" height="5" rx="1.5" fill="#4a8df8" fillOpacity=".5"/>
                      <rect x="9" y="8" width="6" height="7" rx="1.5" fill="#4a8df8" fillOpacity=".5"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{board.title}</h3>
                    {board.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{board.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {board.member_count} member{board.member_count !== 1 ? 's' : ''}
                    </span>
                    {board.role === 'owner' && (
                      <span className="text-[10px] bg-brand-500/10 text-brand-500 px-1.5 py-0.5 rounded font-medium">owner</span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(board.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}