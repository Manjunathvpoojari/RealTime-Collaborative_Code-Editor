const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const db = require('../db/queries');

/* POST /api/boards/:boardId/columns */
router.post('/:boardId/columns', authenticate, async (req, res) => {
  const { boardId } = req.params;
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  try {
    const access = await db.isBoardMember(boardId, req.user.id);
    if (!access.rows.length) return res.status(403).json({ error: 'Access denied' });
    const cols = await db.getColumnsForBoard(boardId);
    const result = await db.createColumn(boardId, title.trim(), cols.rows.length);
    res.status(201).json({ column: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* PATCH /api/boards/:boardId/columns/:columnId */
router.patch('/:boardId/columns/:columnId', authenticate, async (req, res) => {
  const { boardId, columnId } = req.params;
  const { title } = req.body;
  try {
    const access = await db.isBoardMember(boardId, req.user.id);
    if (!access.rows.length) return res.status(403).json({ error: 'Access denied' });
    const result = await db.updateColumn(columnId, title);
    res.json({ column: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* DELETE /api/boards/:boardId/columns/:columnId */
router.delete('/:boardId/columns/:columnId', authenticate, async (req, res) => {
  const { boardId, columnId } = req.params;
  try {
    const access = await db.isBoardMember(boardId, req.user.id);
    if (!access.rows.length) return res.status(403).json({ error: 'Access denied' });
    await db.deleteColumn(columnId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
