# CollabBoard — Real-time Collaborative Kanban

A full-stack real-time Kanban board built with **React + Vite**, **Node.js + Express**, **Socket.io**, **PostgreSQL**, and **Redis**.

---

## ✦ Features

| Feature | Details |
|---|---|
| **Real-time sync** | All card moves, edits, and deletes broadcast instantly via Socket.io |
| **Drag-and-drop** | @dnd-kit with optimistic UI — zero-latency feel |
| **Live cursors** | See where every teammate's mouse is in real time |
| **User presence** | Avatar bar shows who's online on the board |
| **Activity feed** | Full sidebar log of every board event |
| **Card details** | Assignee, label, color stripe, description |
| **Conflict resolution** | Server-authoritative positions + client ack/rollback |
| **JWT auth** | Secure REST + WebSocket handshake |
| **Invite members** | Invite by email to any board |
| **Redis pub/sub** | Multi-instance horizontal scaling via @socket.io/redis-adapter |

---

## 🗂 Project structure

```
collab-app/
├── docker-compose.yml
├── server/
│   ├── index.js                 ← Express + Socket.io entry
│   ├── routes/
│   │   ├── auth.js              ← register, login, /me
│   │   ├── boards.js            ← CRUD + invite
│   │   ├── columns.js
│   │   └── cards.js
│   ├── sockets/
│   │   ├── index.js             ← wires all socket handlers
│   │   ├── boardHandlers.js     ← card:move/create/update/delete, column events
│   │   └── presenceHandlers.js  ← cursor throttle, join/leave
│   ├── middleware/
│   │   └── auth.js              ← JWT for REST + Socket
│   └── db/
│       ├── schema.sql
│       ├── pool.js
│       ├── queries.js
│       └── init.js
└── client/
    └── src/
        ├── api/                 ← axios client + all API calls
        ├── context/             ← AuthContext
        ├── hooks/               ← useSocket, useBoard
        ├── store/               ← Zustand boardStore
        ├── pages/               ← Login, Register, Dashboard, Board
        └── components/          ← BoardColumn, CardItem, CardModal,
                                    PresenceBar, LiveCursors, ActivityFeed
```

---

## 🚀 Quick start (Docker — recommended)

```bash
git clone <your-repo>
cd collab-app

# Start everything (Postgres + Redis + server + client)
docker-compose up --build

# App:    http://localhost:5173
# API:    http://localhost:3001/api/health
```

---

## 🛠 Local development (without Docker)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### 1. Database

```bash
psql -U postgres -c "CREATE DATABASE collab_db;"
psql -U postgres -c "CREATE USER collab WITH PASSWORD 'collab123';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE collab_db TO collab;"
```

### 2. Server

```bash
cd server
cp .env.example .env          # edit DATABASE_URL / REDIS_URL / JWT_SECRET
npm install
node db/init.js                # run schema
npm run dev                    # starts on :3001
```

### 3. Client

```bash
cd client
npm install
npm run dev                    # starts on :5173
```

---

## ⚡ Socket.io event reference

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `board:join` | `{ boardId }` | Join a board room |
| `board:leave` | `{ boardId }` | Leave a board room |
| `card:create` | `{ boardId, columnId, title, description }` | Create a new card |
| `card:move` | `{ boardId, cardId, movedCards }` | Reorder / move card between columns |
| `card:update` | `{ boardId, cardId, updates }` | Edit card fields |
| `card:delete` | `{ boardId, cardId }` | Delete a card |
| `column:create` | `{ boardId, title }` | Create a column |
| `column:update` | `{ boardId, columnId, title }` | Rename a column |
| `column:delete` | `{ boardId, columnId }` | Delete a column |
| `cursor:move` | `{ boardId, x, y }` | Broadcast cursor position (throttled 20/s) |
| `presence:join` | `{ boardId }` | Announce user presence |

### Server → Client
| Event | Description |
|---|---|
| `card:created` | New card + activity entry |
| `card:moved` | Authoritative card positions |
| `card:move:ack` | Sender confirmation (success / conflict) |
| `card:updated` | Updated card fields |
| `card:deleted` | Deleted card ID |
| `column:created/updated/deleted` | Column changes |
| `presence:update` | Current online members |
| `cursor:update` | Another user's cursor position |
| `board:user_joined/left` | Join / leave notifications |

---

## 🗄 Database schema

```
users          — id, email, name, avatar_color, password_hash
boards         — id, title, description, owner_id
board_members  — board_id, user_id, role (owner|member)
columns        — id, board_id, title, position
cards          — id, column_id, board_id, title, description,
                 position, assignee_id, color, label, version
activity_log   — id, board_id, user_id, action, payload (JSONB)
```

---

## 🌐 Deploying to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli
railway login

# Create project
railway init

# Add services: PostgreSQL + Redis (from Railway dashboard)

# Set env vars
railway variables set JWT_SECRET=your-secret NODE_ENV=production

# Deploy
railway up
```

---

## 🔐 Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis URL |
| `JWT_SECRET` | — | **Change in production!** |
| `JWT_EXPIRY` | `7d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin |

---

## 🏗 Architecture

```
Browser (React + Zustand)
    │  REST (axios)       WebSocket (Socket.io-client)
    ▼                     ▼
Express REST API ◄───► Socket.io Server
    │                     │
    ▼                     ▼
PostgreSQL            Redis pub/sub
(persistent store)    (multi-instance broadcast)
```

Optimistic UI flow:
1. User drags card → local state updates instantly
2. `card:move` emitted with full position list
3. Server validates, writes to Postgres, publishes to Redis
4. All other clients receive `card:moved` and update
5. Sender receives `card:move:ack` — reconciles or rolls back

---

Built with ♥ using React, Node.js, Socket.io, PostgreSQL, Redis
