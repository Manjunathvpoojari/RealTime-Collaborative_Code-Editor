const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db        = require('../db/queries');
const { authenticate } = require('../middleware/auth');

const AVATAR_COLORS = ['#4a8df8','#22c98a','#f0a53a','#9b8df8','#f87171','#38bdf8','#a78bfa'];
const pickColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, name: user.name, avatar_color: user.avatar_color },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );

/* POST /api/auth/register */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().isLength({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name } = req.body;
    try {
      const existing = await db.findUserByEmail(email);
      if (existing.rows.length) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const result = await db.createUser(email, name, passwordHash, pickColor());
      const user = result.rows[0];
      res.status(201).json({ token: signToken(user), user });
    } catch (err) {
      console.error('[register]', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/* POST /api/auth/login */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const result = await db.findUserByEmail(email);
      if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const { password_hash, ...safeUser } = user;
      res.json({ token: signToken(safeUser), user: safeUser });
    } catch (err) {
      console.error('[login]', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/* GET /api/auth/me */
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.findUserById(req.user.id);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
