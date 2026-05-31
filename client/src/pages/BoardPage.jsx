import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import toast from 'react-hot-toast';
import { getBoard, inviteMember, getCodeSession } from '../api';
import { useBoardStore }  from '../store/boardStore';
import { useBoard }       from '../hooks/useBoard';
import { useAuth }        from '../context/AuthContext';
import { useTheme }       from '../context/ThemeContext';
import { disconnectSocket } from '../hooks/useSocket';
import BoardColumn       from '../components/BoardColumn';
import CardItem          from '../components/CardItem';
import ActivityFeed      from '../components/ActivityFeed';
import PresenceBar       from '../components/PresenceBar';
import LiveCursors       from '../components/LiveCursors';
import CardModal         from '../components/CardModal';

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const { theme, toggleTheme } = useTheme();

  const { board, columns, cards, activity, members, reset } = useBoardStore();
  const { moveCard, createCard, updateCard, deleteCard,
          createColumn, updateColumn, deleteColumn, emitCursor } = useBoard(boardId);

  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('board'); // 'board' | 'code' | 'activity'
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInvite]    = useState('');
  const [inviting, setInviting]     = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [editCard, setEditCard]     = useState(null);
  const [codeSession, setCodeSession] = useState(null);
  const boardRef = useRef(null);
  const isDark = theme === 'dark';

  /* ── Load initial board state ─────────────────────────── */
  useEffect(() => {
    setLoading(true);
    getBoard(boardId)
      .then(res => useBoardStore.getState().setBoard(res.data))
      .catch(() => { toast.error('Board not found'); navigate('/dashboard'); })
      .finally(() => setLoading(false));
    return () => reset();
  }, [boardId, navigate, reset]);

  /* ── Load code session preview ────────────────────────── */
  useEffect(() => {
    getCodeSession(boardId)
      .then(res => { if (res.data.session) setCodeSession(res.data.session); })
      .catch(() => {});
  }, [boardId]);

  /* ── Cursor broadcasting ──────────────────────────────── */
  const handleMouseMove = useCallback((e) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    emitCursor(Math.round(e.clientX - rect.left), Math.round(e.clientY - rect.top));
  }, [emitCursor]);

  /* ── DnD sensors ──────────────────────────────────────── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart({ active }) {
    const card = cards.find(c => c.id === active.id);
    setActiveCard(card || null);
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null);
    if (!over || active.id === over.id) return;

    const draggedCard = cards.find(c => c.id === active.id);
    if (!draggedCard) return;

    const overCard  = cards.find(c => c.id === over.id);
    const overColId = overCard ? overCard.column_id : over.id;

    const sameCol = draggedCard.column_id === overColId;
    const colCards = cards
      .filter(c => c.column_id === overColId || (sameCol && c.column_id === draggedCard.column_id))
      .filter(c => sameCol || c.id !== draggedCard.id)
      .sort((a, b) => a.position - b.position);

    let newCards;
    if (sameCol) {
      const oldIdx = colCards.findIndex(c => c.id === active.id);
      const newIdx = colCards.findIndex(c => c.id === over.id);
      newCards = arrayMove(colCards, oldIdx, newIdx);
    } else {
      const overIdx = overCard ? colCards.findIndex(c => c.id === over.id) : colCards.length;
      newCards = [...colCards.slice(0, overIdx), draggedCard, ...colCards.slice(overIdx)];
    }

    const movedCards = newCards.map((c, i) => ({
      id: c.id, columnId: overColId, position: i,
    }));

    if (!sameCol) {
      const srcRemaining = cards
        .filter(c => c.column_id === draggedCard.column_id && c.id !== draggedCard.id)
        .sort((a, b) => a.position - b.position)
        .map((c, i) => ({ id: c.id, columnId: draggedCard.column_id, position: i }));
      movedCards.push(...srcRemaining);
    }

    const allUpdated = cards.map(c => {
      const m = movedCards.find(x => x.id === c.id);
      return m ? { ...c, column_id: m.columnId, position: m.position } : c;
    });
    useBoardStore.getState().optimisticMove(draggedCard.id, overColId, allUpdated);
    moveCard(draggedCard.id, movedCards);
  }

  /* ── Invite member ────────────────────────────────────── */
  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      await inviteMember(boardId, inviteEmail.trim());
      toast.success('Member invited!');
      setShowInvite(false); setInvite('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  /* ── Theme-aware styles ───────────────────────────────── */
  const headerBg     = isDark ? '#161b27' : '#ffffff';
  const headerBorder = isDark ? '#252d42' : '#e2e6f0';
  const tabActiveBg  = '#4a8df8';
  const tabInactive  = isDark ? '#1c2232' : '#f0f2f7';
  const tabInactiveText = isDark ? '#9ca3af' : '#6b7280';

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden transition-colors duration-200" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Board header ────────────────────────────────── */}
      <header
        className="flex-shrink-0 border-b px-4 h-13 flex items-center gap-3 transition-colors duration-200"
        style={{ background: headerBg, borderColor: headerBorder }}
      >
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm flex items-center gap-1 transition-colors mr-1 hover:opacity-70"
          style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
        >
          ← <span className="hidden sm:inline">Boards</span>
        </button>

        <h1 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {board?.title}
        </h1>

        <div className="flex items-center gap-2 ml-auto">
          <PresenceBar />

          <button
            onClick={() => setShowInvite(!showInvite)}
            className="text-xs px-3 py-1.5 rounded-lg border transition-all"
            style={{
              color: isDark ? '#9ca3af' : '#6b7280',
              background: isDark ? '#1c2232' : '#f8f9fc',
              borderColor: headerBorder,
            }}
          >
            + Invite
          </button>

          {/* Tab switcher */}
          <div
            className="flex items-center rounded-lg p-0.5 gap-0.5 border"
            style={{ background: tabInactive, borderColor: headerBorder }}
          >
            {[
              { key: 'board',    label: '⬛ Board'    },
              { key: 'code',     label: '⌨ Code'      },
              { key: 'activity', label: '📋 Activity'  },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="text-xs px-3 py-1.5 rounded-md transition-all font-medium"
                style={{
                  background:  activeTab === tab.key ? tabActiveBg : 'transparent',
                  color:       activeTab === tab.key ? '#ffffff'    : tabInactiveText,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all hover:border-brand-500 text-base"
            style={{ background: isDark ? '#1c2232' : '#f8f9fc', borderColor: headerBorder }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* ── Invite bar ──────────────────────────────────── */}
      {showInvite && (
        <div
          className="border-b px-4 py-3 animate-slide-down"
          style={{ background: headerBg, borderColor: headerBorder }}
        >
          <form onSubmit={handleInvite} className="flex gap-2 max-w-sm">
            <input
              autoFocus
              type="email"
              value={inviteEmail}
              onChange={e => setInvite(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1 rounded-lg px-3 py-2 text-sm border focus:outline-none focus:border-brand-500"
              style={{ background: isDark ? '#1c2232' : '#f8f9fc', borderColor: headerBorder, color: 'var(--text-primary)' }}
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
            >
              {inviting ? '…' : 'Send'}
            </button>
            <button type="button" onClick={() => setShowInvite(false)} className="text-sm px-2" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>✕</button>
          </form>
        </div>
      )}

      {/* ── Main content area ────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── BOARD TAB ──────────────────────────────────── */}
        <div className={`flex-1 overflow-hidden ${activeTab !== 'board' ? 'hidden' : 'flex'}`}>
          <div
            ref={boardRef}
            onMouseMove={handleMouseMove}
            className="flex-1 overflow-x-auto overflow-y-hidden relative"
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 p-4 h-full items-start w-max">
                {columns
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map(col => (
                    <BoardColumn
                      key={col.id}
                      column={col}
                      cards={cards.filter(c => c.column_id === col.id).sort((a, b) => a.position - b.position)}
                      onCreateCard={(title) => createCard(col.id, title, '')}
                      onUpdateColumn={(title) => updateColumn(col.id, title)}
                      onDeleteColumn={() => deleteColumn(col.id)}
                      onOpenCard={setEditCard}
                      currentUserId={user?.id}
                    />
                  ))}
                <AddColumnButton onCreate={createColumn} />
              </div>

              <DragOverlay dropAnimation={dropAnimation}>
                {activeCard && <CardItem card={activeCard} isDragging />}
              </DragOverlay>
            </DndContext>

            <LiveCursors currentUserId={user?.id} />
          </div>
        </div>

        {/* ── CODE TAB ───────────────────────────────────── */}
        {activeTab === 'code' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
            <div
              className="w-full max-w-lg rounded-2xl p-8 border shadow-lg"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
            >
              <div className="text-4xl mb-3 text-center">⌨️</div>
              <h2 className="font-semibold text-lg mb-1 text-center" style={{ color: 'var(--text-primary)' }}>
                Code Editor
              </h2>
              <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
                Collaborate on code in real time. Edits sync live with full version history.
              </p>

              {/* Code preview */}
              {codeSession ? (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-medium capitalize px-2 py-0.5 rounded"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                    >
                      {codeSession.language}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Last saved {new Date(codeSession.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div
                    className="rounded-xl px-4 py-3 text-xs font-mono overflow-hidden border"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-secondary)',
                      maxHeight: 120,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {codeSession.code?.slice(0, 300)}{codeSession.code?.length > 300 ? '…' : ''}
                  </div>
                </div>
              ) : (
                <div
                  className="mb-5 rounded-xl px-4 py-6 text-xs text-center border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  No code saved yet — open the editor to start!
                </div>
              )}

              <button
                onClick={() => navigate(`/editor/${boardId}`)}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>⌨</span> Open Full Editor
              </button>
            </div>
          </div>
        )}

        {/* ── ACTIVITY TAB ───────────────────────────────── */}
        {activeTab === 'activity' && (
          <div
            className="flex-1 overflow-y-auto animate-fade-in"
            style={{ background: 'var(--bg-secondary)' }}
          >
            <ActivityFeed activity={activity} />
          </div>
        )}

      </div>

      {/* ── Card modal ──────────────────────────────────── */}
      {editCard && (
        <CardModal
          card={editCard}
          members={members}
          boardId={boardId}
          onClose={() => setEditCard(null)}
          onUpdate={(updates) => { updateCard(editCard.id, updates); setEditCard(null); }}
          onDelete={() => { deleteCard(editCard.id); setEditCard(null); }}
        />
      )}
    </div>
  );
}

/* ── Add Column Button ──────────────────────────────────────── */
function AddColumnButton({ onCreate }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle]   = useState('');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim());
    setTitle(''); setAdding(false);
  };

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="w-64 flex-shrink-0 h-10 flex items-center gap-2 text-sm border border-dashed rounded-xl px-4 transition-all"
        style={{
          color: isDark ? '#6b7280' : '#9ca3af',
          background: isDark ? 'rgba(22,27,39,0.6)' : 'rgba(240,242,247,0.8)',
          borderColor: isDark ? '#252d42' : '#e2e6f0',
        }}
      >
        <span className="text-lg leading-none">+</span> Add column
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-64 flex-shrink-0 rounded-xl p-3 flex flex-col gap-2 border"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
    >
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Column name"
        className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:border-brand-500"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        onKeyDown={e => e.key === 'Escape' && setAdding(false)}
      />
      <div className="flex gap-2">
        <button type="submit" className="bg-brand-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg">Add</button>
        <button type="button" onClick={() => setAdding(false)} className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>Cancel</button>
      </div>
    </form>
  );
}