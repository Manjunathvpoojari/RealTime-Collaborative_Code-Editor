import { create } from 'zustand';

export const useBoardStore = create((set, get) => ({
  board:      null,
  columns:    [],
  cards:      [],   // flat array — keyed by id
  members:    [],
  activity:   [],
  presence:   [],   // users currently online on this board
  cursors:    {},   // { userId: {x,y,name,color} }

  /* ─── Load full board state from REST ─────────────────────── */
  setBoard: ({ board, columns, cards, members, activity }) =>
    set({ board, columns, cards, members, activity }),

  /* ─── Columns ────────────────────────────────────────────── */
  addColumn: (col) =>
    set((s) => ({ columns: [...s.columns, col] })),

  updateColumn: (col) =>
    set((s) => ({ columns: s.columns.map(c => c.id === col.id ? col : c) })),

  removeColumn: (columnId) =>
    set((s) => ({
      columns: s.columns.filter(c => c.id !== columnId),
      cards:   s.cards.filter(c => c.column_id !== columnId),
    })),

  /* ─── Cards ──────────────────────────────────────────────── */
  addCard: (card) =>
    set((s) => ({ cards: [...s.cards, card] })),

  updateCard: (card) =>
    set((s) => ({ cards: s.cards.map(c => c.id === card.id ? { ...c, ...card } : c) })),

  removeCard: (cardId) =>
    set((s) => ({ cards: s.cards.filter(c => c.id !== cardId) })),

  /** Apply authoritative positions from server ack/broadcast */
  applyCardPositions: (movedCards) =>
    set((s) => {
      const map = Object.fromEntries(movedCards.map(m => [m.id, m]));
      return {
        cards: s.cards.map(c =>
          map[c.id]
            ? { ...c, column_id: map[c.id].columnId, position: map[c.id].position }
            : c
        ),
      };
    }),

  /** Optimistic local drag — called before emitting to server */
  optimisticMove: (cardId, newColumnId, newCards) =>
    set({ cards: newCards }),

  /* ─── Activity ───────────────────────────────────────────── */
  prependActivity: (item) =>
    set((s) => ({ activity: [item, ...s.activity].slice(0, 60) })),

  /* ─── Presence / Cursors ─────────────────────────────────── */
  setPresence: (members) => set({ presence: members }),

  setCursor: (userId, data) =>
    set((s) => ({ cursors: { ...s.cursors, [userId]: data } })),

  removeCursor: (userId) =>
    set((s) => {
      const next = { ...s.cursors };
      delete next[userId];
      return { cursors: next };
    }),

  reset: () =>
    set({ board: null, columns: [], cards: [], members: [], activity: [], presence: [], cursors: {} }),
}));
