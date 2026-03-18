const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const db = require('../db/queries');

/* GET /api/boards */
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.getBoardsForUser(req.user.id);
    res.json({ boards: result.rows });
  } catch (err) {
    console.error('[GET /boards]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* POST /api/boards */
router.post('/',
  authenticate,
  [body('title').trim().isLength({ min: 1, max: 255 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description = '' } = req.body;
    try {
      const boardRes = await db.createBoard(title, description, req.user.id);
      const board = boardRes.rows[0];
      // Owner is also a member with role 'owner'
      await db.addBoardMember(board.id, req.user.id, 'owner');
      // Seed three default columns
      await Promise.all([
        db.createColumn(board.id, 'To Do', 0),
        db.createColumn(board.id, 'In Progress', 1),
        db.createColumn(board.id, 'Done', 2),
      ]);
      res.status(201).json({ board });
    } catch (err) {
      console.error('[POST /boards]', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/* GET /api/boards/:boardId  — full board state */
router.get('/:boardId', authenticate, async (req, res) => {
  const { boardId } = req.params;
  try {
    const access = await db.isBoardMember(boardId, req.user.id);
    if (!access.rows.length) return res.status(403).json({ error: 'Access denied' });

    const [board, columns, cards, members, activity] = await Promise.all([
      db.getBoardById(boardId),
      db.getColumnsForBoard(boardId),
      db.getCardsForBoard(boardId),
      db.getBoardMembers(boardId),
      db.getActivityForBoard(boardId, 40),
    ]);

    if (!board.rows.length) return res.status(404).json({ error: 'Board not found' });

    res.json({
      board:    board.rows[0],
      columns:  columns.rows,
      cards:    cards.rows,
      members:  members.rows,
      activity: activity.rows,
    });
  } catch (err) {
    console.error('[GET /boards/:id]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* PATCH /api/boards/:boardId */
router.patch('/:boardId', authenticate, async (req, res) => {
  const { boardId } = req.params;
  const { title, description } = req.body;
  try {
    const access = await db.isBoardMember(boardId, req.user.id);
    if (!access.rows.length) return res.status(403).json({ error: 'Access denied' });
    const result = await db.updateBoard(boardId, title, description);
    res.json({ board: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* DELETE /api/boards/:boardId */
router.delete('/:boardId', authenticate, async (req, res) => {
  const { boardId } = req.params;
  try {
    const board = await db.getBoardById(boardId);
    if (!board.rows.length) return res.status(404).json({ error: 'Not found' });
    if (board.rows[0].owner_id !== req.user.id)
      return res.status(403).json({ error: 'Only the owner can delete this board' });
    await db.deleteBoard(boardId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* POST /api/boards/:boardId/invite */
router.post('/:boardId/invite', authenticate, async (req, res) => {
  const { boardId } = req.params;
  const { email } = req.body;
  try {
    const access = await db.isBoardMember(boardId, req.user.id);
    if (!access.rows.length) return res.status(403).json({ error: 'Access denied' });

    const userRes = await db.findUserByEmail(email);
    if (!userRes.rows.length) return res.status(404).json({ error: 'No user found with that email' });

    const invited = userRes.rows[0];
    await db.addBoardMember(boardId, invited.id, 'member');
    res.json({ user: { id: invited.id, name: invited.name, email: invited.email, avatar_color: invited.avatar_color, role: 'member' } });
  } catch (err) {
    console.error('[invite]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
