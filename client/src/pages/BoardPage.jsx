import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import toast from 'react-hot-toast';
import { getBoard, inviteMember } from '../api';
import { useBoardStore }  from '../store/boardStore';
import { useBoard }       from '../hooks/useBoard';
import { useAuth }        from '../context/AuthContext';
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

  const { board, columns, cards, activity, members, reset } = useBoardStore();
  const { moveCard, createCard, updateCard, deleteCard,
          createColumn, updateColumn, deleteColumn, emitCursor } = useBoard(boardId);

  const [loading, setLoading]       = useState(true);
  const [showActivity, setAct]      = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInvite]    = useState('');
  const [inviting, setInviting]     = useState(false);
  const [activeCard, setActiveCard] = useState(null);  // card being dragged
  const [editCard, setEditCard]     = useState(null);  // card open in modal
  const boardRef = useRef(null);

  /* ── Load initial board state ──────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    getBoard(boardId)
      .then(res => useBoardStore.getState().setBoard(res.data))
      .catch(() => { toast.error('Board not found'); navigate('/dashboard'); })
      .finally(() => setLoading(false));
    return () => reset();
  }, [boardId, navigate, reset]);

  /* ── Cursor broadcasting ───────────────────────────────────── */
  const handleMouseMove = useCallback((e) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    emitCursor(Math.round(e.clientX - rect.left), Math.round(e.clientY - rect.top));
  }, [emitCursor]);

  /* ── DnD sensors ───────────────────────────────────────────── */
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

    const overCard   = cards.find(c => c.id === over.id);
    const overColId  = overCard ? overCard.column_id : over.id; // over column directly

    // Compute new sorted cards for the affected columns
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

    // Also include cards from source column when cross-column
    if (!sameCol) {
      const srcRemaining = cards
        .filter(c => c.column_id === draggedCard.column_id && c.id !== draggedCard.id)
        .sort((a, b) => a.position - b.position)
        .map((c, i) => ({ id: c.id, columnId: draggedCard.column_id, position: i }));
      movedCards.push(...srcRemaining);
    }

    // Optimistic update
    const allUpdated = cards.map(c => {
      const m = movedCards.find(x => x.id === c.id);
      return m ? { ...c, column_id: m.columnId, position: m.position } : c;
    });
    useBoardStore.getState().optimisticMove(draggedCard.id, overColId, allUpdated);

    // Emit to server
    moveCard(draggedCard.id, movedCards);
  }

  /* ── Invite member ─────────────────────────────────────────── */
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

  if (loading) {
    return (
      <div className="h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
  };

  return (
    <div className="h-screen bg-[#0f1117] flex flex-col overflow-hidden">
      {/* Board header */}
      <header className="flex-shrink-0 border-b border-[#252d42] bg-[#161b27] px-4 h-13 flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 transition-colors mr-1"
        >
          ← <span className="hidden sm:inline">Boards</span>
        </button>

        <h1 className="font-semibold text-white text-sm truncate">{board?.title}</h1>

        <div className="flex items-center gap-2 ml-auto">
          <PresenceBar />

          <button
            onClick={() => setShowInvite(!showInvite)}
            className="text-xs text-gray-400 hover:text-white bg-[#1c2232] hover:bg-[#252d42] border border-[#252d42] px-3 py-1.5 rounded-lg transition-all"
          >
            + Invite
          </button>

          <button
            onClick={() => setAct(!showActivity)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              showActivity
                ? 'text-brand-500 bg-brand-500/10 border-brand-500/30'
                : 'text-gray-400 hover:text-white bg-[#1c2232] border-[#252d42]'
            }`}
          >
            Activity
          </button>
        </div>
      </header>

      {/* Invite modal inline */}
      {showInvite && (
        <div className="border-b border-[#252d42] bg-[#161b27] px-4 py-3 animate-slide-down">
          <form onSubmit={handleInvite} className="flex gap-2 max-w-sm">
            <input
              autoFocus
              type="email"
              value={inviteEmail}
              onChange={e => setInvite(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1 bg-[#1c2232] border border-[#252d42] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
            >
              {inviting ? '…' : 'Send'}
            </button>
            <button type="button" onClick={() => setShowInvite(false)} className="text-gray-500 hover:text-white text-sm px-2">✕</button>
          </form>
        </div>
      )}

      {/* Board canvas */}
      <div className="flex flex-1 overflow-hidden">
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

              {/* Add column */}
              <AddColumnButton onCreate={createColumn} />
            </div>

            <DragOverlay dropAnimation={dropAnimation}>
              {activeCard && <CardItem card={activeCard} isDragging />}
            </DragOverlay>
          </DndContext>

          <LiveCursors currentUserId={user?.id} />
        </div>

        {/* Activity sidebar */}
        {showActivity && (
          <div className="w-72 flex-shrink-0 border-l border-[#252d42] bg-[#161b27] overflow-y-auto animate-fade-in">
            <ActivityFeed activity={activity} />
          </div>
        )}
      </div>

      {/* Card modal */}
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

function AddColumnButton({ onCreate }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle]   = useState('');

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
        className="w-64 flex-shrink-0 h-10 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 bg-[#161b27]/60 hover:bg-[#161b27] border border-dashed border-[#252d42] hover:border-[#3a4664] rounded-xl px-4 transition-all"
      >
        <span className="text-lg leading-none">+</span> Add column
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="w-64 flex-shrink-0 bg-[#161b27] border border-[#252d42] rounded-xl p-3 flex flex-col gap-2">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Column name"
        className="w-full bg-[#1c2232] border border-[#252d42] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
        onKeyDown={e => e.key === 'Escape' && setAdding(false)}
      />
      <div className="flex gap-2">
        <button type="submit" className="bg-brand-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg">Add</button>
        <button type="button" onClick={() => setAdding(false)} className="text-gray-500 hover:text-white text-xs px-2">Cancel</button>
      </div>
    </form>
  );
}
