const db   = require('../db/queries');
const pool = require('../db/pool');

module.exports = function boardHandlers(io, socket) {
  const user = socket.user;

  /* ── Join / Leave ─────────────────────────────────────────── */
  socket.on('board:join', async ({ boardId }) => {
    const access = await db.isBoardMember(boardId, user.id).catch(() => ({ rows: [] }));
    if (!access.rows.length) { socket.emit('error', { message: 'Access denied' }); return; }

    socket.join(`board:${boardId}`);
    socket.emit('board:joined', { boardId });
    socket.to(`board:${boardId}`).emit('board:user_joined', {
      user: { id: user.id, name: user.name, avatar_color: user.avatar_color },
    });
  });

  socket.on('board:leave', ({ boardId }) => {
    socket.leave(`board:${boardId}`);
    socket.to(`board:${boardId}`).emit('board:user_left', { userId: user.id });
  });

  /* ── Card: move (drag-and-drop) ───────────────────────────── */
  socket.on('card:move', async ({ boardId, cardId, movedCards }) => {
    try {
      // movedCards = [{id, columnId, position}, ...]  — full reconciliation
      await db.updateCardPositions(movedCards);

      const actRes = await db.logActivity(boardId, user.id, 'card:move', {
        cardId, userName: user.name,
      });

      // Tell every OTHER client the authoritative positions
      socket.to(`board:${boardId}`).emit('card:moved', {
        movedCards,
        activity: enrich(actRes.rows[0], user),
      });

      // Ack to sender (confirms server accepted the move)
      socket.emit('card:move:ack', { success: true, cardId, movedCards });
    } catch (err) {
      console.error('[card:move]', err.message);
      socket.emit('card:move:ack', { success: false, cardId, error: err.message });
    }
  });

  /* ── Card: create ─────────────────────────────────────────── */
  socket.on('card:create', async ({ boardId, columnId, title, description = '' }) => {
    try {
      const countRes = await pool.query(
        'SELECT COUNT(*)::int AS count FROM cards WHERE column_id = $1', [columnId]
      );
      const position = countRes.rows[0].count;
      const cardRes = await db.createCard(columnId, boardId, title, description, position, user.id);
      const card = cardRes.rows[0];

      const actRes = await db.logActivity(boardId, user.id, 'card:create', {
        cardId: card.id, title, userName: user.name,
      });

      // Broadcast to ALL clients (including sender) so state is consistent
      io.to(`board:${boardId}`).emit('card:created', {
        card,
        activity: enrich(actRes.rows[0], user),
      });
    } catch (err) {
      console.error('[card:create]', err.message);
      socket.emit('error', { message: 'Failed to create card' });
    }
  });

  /* ── Card: update ─────────────────────────────────────────── */
  socket.on('card:update', async ({ boardId, cardId, updates }) => {
    try {
      const cardRes = await db.updateCard(cardId, updates);
      const card = cardRes.rows[0];

      const actRes = await db.logActivity(boardId, user.id, 'card:update', {
        cardId, userName: user.name,
      });

      io.to(`board:${boardId}`).emit('card:updated', {
        card,
        activity: enrich(actRes.rows[0], user),
      });
    } catch (err) {
      console.error('[card:update]', err.message);
    }
  });

  /* ── Card: delete ─────────────────────────────────────────── */
  socket.on('card:delete', async ({ boardId, cardId }) => {
    try {
      await db.deleteCard(cardId);
      const actRes = await db.logActivity(boardId, user.id, 'card:delete', {
        cardId, userName: user.name,
      });
      io.to(`board:${boardId}`).emit('card:deleted', {
        cardId,
        activity: enrich(actRes.rows[0], user),
      });
    } catch (err) {
      console.error('[card:delete]', err.message);
    }
  });

  /* ── Column: create ───────────────────────────────────────── */
  socket.on('column:create', async ({ boardId, title }) => {
    try {
      const colsRes = await db.getColumnsForBoard(boardId);
      const colRes = await db.createColumn(boardId, title, colsRes.rows.length);
      const column = colRes.rows[0];

      const actRes = await db.logActivity(boardId, user.id, 'column:create', {
        columnId: column.id, title, userName: user.name,
      });

      io.to(`board:${boardId}`).emit('column:created', {
        column,
        activity: enrich(actRes.rows[0], user),
      });
    } catch (err) {
      console.error('[column:create]', err.message);
    }
  });

  /* ── Column: update (rename) ──────────────────────────────── */
  socket.on('column:update', async ({ boardId, columnId, title }) => {
    try {
      const colRes = await db.updateColumn(columnId, title);
      io.to(`board:${boardId}`).emit('column:updated', { column: colRes.rows[0] });
    } catch (err) {
      console.error('[column:update]', err.message);
    }
  });

  /* ── Column: delete ───────────────────────────────────────── */
  socket.on('column:delete', async ({ boardId, columnId }) => {
    try {
      await db.deleteColumn(columnId);
      const actRes = await db.logActivity(boardId, user.id, 'column:delete', {
        columnId, userName: user.name,
      });
      io.to(`board:${boardId}`).emit('column:deleted', {
        columnId,
        activity: enrich(actRes.rows[0], user),
      });
    } catch (err) {
      console.error('[column:delete]', err.message);
    }
  });
};

function enrich(activityRow, user) {
  return { ...activityRow, user_name: user.name, avatar_color: user.avatar_color };
}
