const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const db   = require('../db/queries');
const pool = require('../db/pool');

/* POST /api/boards/:boardId/cards */
router.post('/:boardId/cards', authenticate, async (req, res) => {
  const { boardId } = req.params;
  const { columnId, title, description = '' } = req.body;
  if (!columnId || !title?.trim()) return res.status(400).json({ error: 'columnId and title required' });
  try {
    const access = await db.isBoardMember(boardId, req.user.id);
    if (!access.rows.length) return res.status(403).json({ error: 'Access denied' });
    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM cards WHERE column_id = $1', [columnId]);
    const position = countRes.rows[0].count;
    const result = await db.createCard(columnId, boardId, title.trim(), description, position, req.user.id);
    res.status(201).json({ card: result.rows[0] });
  } catch (err) {
    console.error('[POST /cards]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* PATCH /api/boards/:boardId/cards/:cardId */
router.patch('/:boardId/cards/:cardId', authenticate, async (req, res) => {
  const { boardId, cardId } = req.params;
  try {
    const access = await db.isBoardMember(boardId, req.user.id);
    if (!access.rows.length) return res.status(403).json({ error: 'Access denied' });
    const result = await db.updateCard(cardId, req.body);
    res.json({ card: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* DELETE /api/boards/:boardId/cards/:cardId */
router.delete('/:boardId/cards/:cardId', authenticate, async (req, res) => {
  const { boardId, cardId } = req.params;
  try {
    const access = await db.isBoardMember(boardId, req.user.id);
    if (!access.rows.length) return res.status(403).json({ error: 'Access denied' });
    await db.deleteCard(cardId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
