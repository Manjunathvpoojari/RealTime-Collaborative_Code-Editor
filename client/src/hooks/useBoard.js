import { useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSocket } from './useSocket';
import { useBoardStore } from '../store/boardStore';
import { useAuth } from '../context/AuthContext';

export function useBoard(boardId) {
  const { user } = useAuth();
  const { emit, on } = useSocket();
  const store = useBoardStore();

  /* ── Join / leave board room ──────────────────────────────── */
  useEffect(() => {
    if (!boardId) return;
    emit('board:join',    { boardId });
    emit('presence:join', { boardId });

    return () => emit('board:leave', { boardId });
  }, [boardId, emit]);

  /* ── Listen for incoming events ───────────────────────────── */
  useEffect(() => {
    if (!boardId) return;

    const offs = [
      on('board:user_joined', ({ user: u }) => {
        toast(`${u.name} joined the board`, { icon: '👋', duration: 3000 });
      }),
      on('board:user_left', ({ userId }) => {
        store.removeCursor(userId);
      }),

      on('presence:update', ({ members }) => store.setPresence(members)),

      on('cursor:update', ({ userId, ...data }) => {
        if (userId !== user?.id) store.setCursor(userId, data);
      }),

      on('card:created', ({ card, activity }) => {
        store.addCard(card);
        if (activity) store.prependActivity(activity);
      }),
      on('card:moved', ({ movedCards, activity }) => {
        store.applyCardPositions(movedCards);
        if (activity) store.prependActivity(activity);
      }),
      on('card:move:ack', ({ success, movedCards, error }) => {
        if (!success) {
          toast.error('Move failed — reverting');
          console.error('card:move failed:', error);
        } else if (movedCards) {
          store.applyCardPositions(movedCards);
        }
      }),
      on('card:updated', ({ card, activity }) => {
        store.updateCard(card);
        if (activity) store.prependActivity(activity);
      }),
      on('card:deleted', ({ cardId, activity }) => {
        store.removeCard(cardId);
        if (activity) store.prependActivity(activity);
      }),

      on('column:created', ({ column, activity }) => {
        store.addColumn(column);
        if (activity) store.prependActivity(activity);
      }),
      on('column:updated', ({ column }) => store.updateColumn(column)),
      on('column:deleted', ({ columnId, activity }) => {
        store.removeColumn(columnId);
        if (activity) store.prependActivity(activity);
      }),
    ];

    return () => offs.forEach(off => off && off());
  }, [boardId, on, store, user?.id]);

  /* ── Emit helpers ─────────────────────────────────────────── */
  const moveCard = useCallback((cardId, movedCards) => {
    emit('card:move', { boardId, cardId, movedCards });
  }, [boardId, emit]);

  const createCard = useCallback((columnId, title, description) => {
    emit('card:create', { boardId, columnId, title, description });
  }, [boardId, emit]);

  const updateCard = useCallback((cardId, updates) => {
    emit('card:update', { boardId, cardId, updates });
  }, [boardId, emit]);

  const deleteCard = useCallback((cardId) => {
    emit('card:delete', { boardId, cardId });
  }, [boardId, emit]);

  const createColumn = useCallback((title) => {
    emit('column:create', { boardId, title });
  }, [boardId, emit]);

  const updateColumn = useCallback((columnId, title) => {
    emit('column:update', { boardId, columnId, title });
  }, [boardId, emit]);

  const deleteColumn = useCallback((columnId) => {
    emit('column:delete', { boardId, columnId });
  }, [boardId, emit]);

  const emitCursor = useCallback((x, y) => {
    emit('cursor:move', { boardId, x, y });
  }, [boardId, emit]);

  return {
    moveCard, createCard, updateCard, deleteCard,
    createColumn, updateColumn, deleteColumn,
    emitCursor,
  };
}
