require('dotenv').config();
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const helmet  = require('helmet');
const { Server } = require('socket.io');

const authRoutes   = require('./routes/auth');
const boardRoutes  = require('./routes/boards');
const columnRoutes = require('./routes/columns');
const cardRoutes   = require('./routes/cards');
const setupSockets = require('./sockets');
const { authenticateSocket } = require('./middleware/auth');

const app    = express();
const server = http.createServer(app);

/* ── Middleware ─────────────────────────────────────────────── */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

/* ── REST Routes ────────────────────────────────────────────── */
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));
app.use('/api/auth',   authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/boards', columnRoutes);
app.use('/api/boards', cardRoutes);

/* ── Socket.io ──────────────────────────────────────────────── */
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

/* Optional: Redis pub/sub adapter for multi-instance scaling */
(async () => {
  try {
    const { createClient } = require('redis');
    const { createAdapter } = require('@socket.io/redis-adapter');
    const pub = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    io.adapter(createAdapter(pub, sub));
    console.log('✓ Redis pub/sub adapter active');
  } catch (err) {
    console.warn('⚠  Redis unavailable — running single-instance mode:', err.message);
  }
})();

/* Socket auth + handlers */
io.use(authenticateSocket);
setupSockets(io);

/* ── Start ──────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✓ Server listening on http://localhost:${PORT}`);
});
