const pool = require('./pool');

/* ─── Users ─────────────────────────────────────────────────── */
const findUserByEmail = (email) =>
  pool.query('SELECT * FROM users WHERE email = $1', [email]);

const findUserById = (id) =>
  pool.query(
    'SELECT id, email, name, avatar_color, created_at FROM users WHERE id = $1',
    [id]
  );

const createUser = (email, name, passwordHash, avatarColor) =>
  pool.query(
    `INSERT INTO users (email, name, password_hash, avatar_color)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, avatar_color, created_at`,
    [email, name, passwordHash, avatarColor]
  );

/* ─── Boards ─────────────────────────────────────────────────── */
const getBoardsForUser = (userId) =>
  pool.query(
    `SELECT b.*, u.name AS owner_name, bm.role,
       (SELECT COUNT(*) FROM board_members WHERE board_id = b.id)::int AS member_count
     FROM boards b
     JOIN board_members bm ON b.id = bm.board_id
     JOIN users u ON b.owner_id = u.id
     WHERE bm.user_id = $1
     ORDER BY b.updated_at DESC`,
    [userId]
  );

const getBoardById = (boardId) =>
  pool.query('SELECT * FROM boards WHERE id = $1', [boardId]);

const createBoard = (title, description, ownerId) =>
  pool.query(
    'INSERT INTO boards (title, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
    [title, description, ownerId]
  );

const updateBoard = (boardId, title, description) =>
  pool.query(
    `UPDATE boards SET title = $1, description = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [title, description, boardId]
  );

const deleteBoard = (boardId) =>
  pool.query('DELETE FROM boards WHERE id = $1', [boardId]);

/* ─── Board members ──────────────────────────────────────────── */
const addBoardMember = (boardId, userId, role = 'member') =>
  pool.query(
    `INSERT INTO board_members (board_id, user_id, role)
     VALUES ($1, $2, $3) ON CONFLICT (board_id, user_id) DO NOTHING`,
    [boardId, userId, role]
  );

const getBoardMembers = (boardId) =>
  pool.query(
    `SELECT u.id, u.name, u.email, u.avatar_color, bm.role, bm.joined_at
     FROM board_members bm
     JOIN users u ON bm.user_id = u.id
     WHERE bm.board_id = $1
     ORDER BY bm.joined_at`,
    [boardId]
  );

const isBoardMember = (boardId, userId) =>
  pool.query(
    'SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2',
    [boardId, userId]
  );

/* ─── Columns ────────────────────────────────────────────────── */
const getColumnsForBoard = (boardId) =>
  pool.query(
    'SELECT * FROM columns WHERE board_id = $1 ORDER BY position',
    [boardId]
  );

const createColumn = (boardId, title, position) =>
  pool.query(
    'INSERT INTO columns (board_id, title, position) VALUES ($1, $2, $3) RETURNING *',
    [boardId, title, position]
  );

const updateColumn = (columnId, title) =>
  pool.query(
    'UPDATE columns SET title = $1 WHERE id = $2 RETURNING *',
    [title, columnId]
  );

const deleteColumn = (columnId) =>
  pool.query('DELETE FROM columns WHERE id = $1', [columnId]);

/* ─── Cards ──────────────────────────────────────────────────── */
const getCardsForBoard = (boardId) =>
  pool.query(
    `SELECT c.*, u.name AS assignee_name, u.avatar_color AS assignee_color
     FROM cards c
     LEFT JOIN users u ON c.assignee_id = u.id
     WHERE c.board_id = $1
     ORDER BY c.column_id, c.position`,
    [boardId]
  );

const countCardsInColumn = (columnId) =>
  pool.query('SELECT COUNT(*)::int AS count FROM cards WHERE column_id = $1', [columnId]);

const createCard = (columnId, boardId, title, description, position, createdBy) =>
  pool.query(
    `INSERT INTO cards (column_id, board_id, title, description, position, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [columnId, boardId, title, description, position, createdBy]
  );

const updateCard = (cardId, { title, description, assigneeId, color, label }) =>
  pool.query(
    `UPDATE cards SET
       title       = COALESCE($1, title),
       description = COALESCE($2, description),
       assignee_id = $3,
       color       = $4,
       label       = $5,
       version     = version + 1,
       updated_at  = NOW()
     WHERE id = $6 RETURNING *`,
    [title, description, assigneeId ?? null, color ?? null, label ?? null, cardId]
  );

/** Atomically reposition multiple cards in one transaction */
const updateCardPositions = async (cards) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { id, position, columnId } of cards) {
      await client.query(
        'UPDATE cards SET position = $1, column_id = $2, updated_at = NOW() WHERE id = $3',
        [position, columnId, id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const deleteCard = (cardId) =>
  pool.query('DELETE FROM cards WHERE id = $1', [cardId]);

/* ─── Activity log ───────────────────────────────────────────── */
const logActivity = (boardId, userId, action, payload) =>
  pool.query(
    `INSERT INTO activity_log (board_id, user_id, action, payload)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [boardId, userId, action, JSON.stringify(payload)]
  );

const getActivityForBoard = (boardId, limit = 50) =>
  pool.query(
    `SELECT al.*, u.name AS user_name, u.avatar_color
     FROM activity_log al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.board_id = $1
     ORDER BY al.created_at DESC
     LIMIT $2`,
    [boardId, limit]
  );

module.exports = {
  findUserByEmail, findUserById, createUser,
  getBoardsForUser, getBoardById, createBoard, updateBoard, deleteBoard,
  addBoardMember, getBoardMembers, isBoardMember,
  getColumnsForBoard, createColumn, updateColumn, deleteColumn,
  getCardsForBoard, countCardsInColumn, createCard, updateCard,
  updateCardPositions, deleteCard,
  logActivity, getActivityForBoard,
};
