# CollabBoard — Real-time Collaborative Kanban & Code Editor

<div align="center">

![CollabBoard Banner](https://img.shields.io/badge/CollabBoard-Real--time%20Collaboration-4a8df8?style=for-the-badge&logo=trello&logoColor=white)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Railway-blueviolet?style=for-the-badge&logo=railway)](https://industrious-happiness-production-2025.up.railway.app)
[![Node.js](https://img.shields.io/badge/Node.js-20-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-black?style=for-the-badge&logo=socket.io)](https://socket.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)](https://redis.io)

**A full-stack real-time collaborative platform combining a Kanban board and a VS Code-style code editor — built for teams to plan, track, and code together from anywhere.**

[Live Demo](https://industrious-happiness-production-2025.up.railway.app) · [Report Bug](https://github.com/Manjunathvpoojari/RealTime-Collaborative_Code-Editor/issues) · [Request Feature](https://github.com/Manjunathvpoojari/RealTime-Collaborative_Code-Editor/issues)

</div>

---

## 📸 Overview

CollabBoard brings together two powerful collaboration tools in one app:

- A **real-time Kanban board** (like Trello) where teams manage tasks with drag-and-drop cards
- A **collaborative code editor** (powered by Monaco — the same engine as VS Code) where multiple people can write and review code simultaneously

Every action — moving a card, typing code, or adding a column — syncs instantly to all connected teammates with zero page refresh.

---

## ✨ Features

### 🗂 Kanban Board
| Feature | Details |
|---|---|
| **Real-time sync** | Card moves, edits, and deletes broadcast instantly via Socket.io |
| **Drag and drop** | Smooth @dnd-kit powered DnD with optimistic UI — zero-latency feel |
| **Live cursors** | See every teammate's mouse cursor moving in real time |
| **User presence** | Avatar bar shows who's currently online on the board |
| **Activity feed** | Full log of every board event — who did what and when |
| **Card details** | Assignee, label, color stripe, description per card |
| **Conflict resolution** | Server-authoritative positions with client ack/rollback |
| **Invite members** | Invite teammates by email to any board |

### ⌨️ Code Editor
| Feature | Details |
|---|---|
| **Monaco Editor** | Full VS Code-style editor with syntax highlighting |
| **20+ languages** | JavaScript, TypeScript, Python, Java, C++, Go, Rust, and more |
| **Live collaboration** | Multiple users type simultaneously, changes sync in real time |
| **Version history** | Save named snapshots — like Git commits for your code |
| **Restore versions** | Preview and restore any previous version with one click |
| **Last edited by** | See who last changed the code and when |
| **Ctrl+S to save** | Familiar keyboard shortcut to save a version snapshot |

### 🎨 UI & UX
| Feature | Details |
|---|---|
| **Light / Dark mode** | Toggle between themes, preference saved locally |
| **3-tab board view** | Switch between Board, Code, and Activity in one place |
| **Responsive design** | Works on desktop and tablet |
| **JWT authentication** | Secure login with token-based auth for REST and WebSocket |

---

## 🏗 Architecture

```
Browser (React + Zustand)
    │  REST (axios)         WebSocket (Socket.io-client)
    ▼                       ▼
Express REST API ◄──────► Socket.io Server
    │                       │
    ▼                       ▼
PostgreSQL              Redis pub/sub
(persistent store)      (multi-instance broadcast)
```

### Optimistic UI Flow (Drag and Drop)
```
1. User drags card      → local state updates instantly (feels instant)
2. card:move emitted    → full position list sent to server
3. Server validates     → writes to PostgreSQL, publishes to Redis
4. Other clients        → receive card:moved, update their state
5. Sender receives ack  → reconciles or rolls back on conflict
```

---

## 🗂 Project Structure

```
RealTime-Collaborative_Code-Editor/
├── docker-compose.yml
├── server/
│   ├── index.js                  ← Express + Socket.io entry point
│   ├── routes/
│   │   ├── auth.js               ← register, login, /me
│   │   ├── boards.js             ← CRUD, invite, code session, versions
│   │   ├── columns.js            ← column CRUD
│   │   └── cards.js              ← card CRUD
│   ├── sockets/
│   │   ├── index.js              ← wires all socket handlers
│   │   ├── boardHandlers.js      ← card/column events + code editor events
│   │   └── presenceHandlers.js   ← cursor throttle, join/leave
│   ├── middleware/
│   │   └── auth.js               ← JWT for REST + Socket
│   └── db/
│       ├── schema.sql            ← full database schema
│       ├── pool.js               ← PostgreSQL connection pool
│       ├── queries.js            ← all SQL queries
│       └── init.js               ← schema initializer
└── client/
    ├── Dockerfile
    ├── server.cjs                ← Express static file server for production
    ├── vite.config.js
    └── src/
        ├── api/                  ← axios client + all API calls
        ├── context/              ← AuthContext, ThemeContext
        ├── hooks/                ← useSocket, useBoard
        ├── store/                ← Zustand boardStore
        ├── pages/                ← Login, Register, Dashboard, Board, Editor
        └── components/           ← BoardColumn, CardItem, CardModal,
                                     PresenceBar, LiveCursors, ActivityFeed
```

---

## 🗄 Database Schema

```
users           — id, email, name, avatar_color, password_hash
boards          — id, title, description, owner_id
board_members   — board_id, user_id, role (owner | member)
columns         — id, board_id, title, position
cards           — id, column_id, board_id, title, description,
                  position, assignee_id, color, label, version
activity_log    — id, board_id, user_id, action, payload (JSONB)
code_sessions   — id, board_id, code, language, saved_by, updated_at
code_versions   — id, board_id, code, language, saved_by_name,
                  message, created_at
```

---

## ⚡ Socket.io Event Reference

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `board:join` | `{ boardId }` | Join a board room |
| `board:leave` | `{ boardId }` | Leave a board room |
| `card:create` | `{ boardId, columnId, title, description }` | Create a card |
| `card:move` | `{ boardId, cardId, movedCards }` | Reorder / move card |
| `card:update` | `{ boardId, cardId, updates }` | Edit card fields |
| `card:delete` | `{ boardId, cardId }` | Delete a card |
| `column:create` | `{ boardId, title }` | Create a column |
| `column:update` | `{ boardId, columnId, title }` | Rename a column |
| `column:delete` | `{ boardId, columnId }` | Delete a column |
| `cursor:move` | `{ boardId, x, y }` | Broadcast cursor position (throttled 20/s) |
| `presence:join` | `{ boardId }` | Announce user presence |
| `editor:join` | `{ boardId }` | Join editor room |
| `editor:change` | `{ boardId, value, language }` | Broadcast code change |
| `editor:language_change` | `{ boardId, language }` | Broadcast language switch |
| `editor:cursor` | `{ boardId, line, column }` | Broadcast editor cursor |

### Server → Client
| Event | Description |
|---|---|
| `card:created/moved/updated/deleted` | Card state changes |
| `card:move:ack` | Sender confirmation — success or rollback |
| `column:created/updated/deleted` | Column changes |
| `presence:update` | Current online members list |
| `cursor:update` | Another user's cursor position |
| `board:user_joined/left` | Join/leave notifications |
| `editor:changed` | Remote code change |
| `editor:language_changed` | Remote language switch |
| `editor:cursor_update` | Remote editor cursor position |

---

## 🚀 Quick Start (Docker — Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Run locally

```bash
git clone https://github.com/Manjunathvpoojari/RealTime-Collaborative_Code-Editor.git
cd RealTime-Collaborative_Code-Editor

docker-compose up --build
```

| Service | URL |
|---|---|
| App (client) | http://localhost:5173 |
| API (server) | http://localhost:3001/api/health |

---

## 🛠 Local Development (Without Docker)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### 1. Database setup

```bash
psql -U postgres -c "CREATE DATABASE collab_db;"
psql -U postgres -c "CREATE USER collab WITH PASSWORD 'collab123';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE collab_db TO collab;"
```

### 2. Server

```bash
cd server
cp .env.example .env      # fill in DATABASE_URL, REDIS_URL, JWT_SECRET
npm install
node db/init.js           # initialise schema
npm run dev               # starts on :3001
```

### 3. Client

```bash
cd client
npm install
npm run dev               # starts on :5173
```

---

## 🔐 Environment Variables

### Server (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `JWT_SECRET` | — | **Change this in production!** |
| `JWT_EXPIRY` | `7d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:5173` | CORS allowed origin |
| `NODE_ENV` | `development` | Environment |

### Client

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend server URL (required in production) |

---

## 🌐 Deploying to Railway

### Live deployment
- **Client:** https://industrious-happiness-production-2025.up.railway.app
- **Server:** https://realtime-collaborativecode-editor-production.up.railway.app

### Deploy your own

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) and create a new project
3. Add **PostgreSQL** and **Redis** database services
4. Add your **server** repo (root directory: `server`)
5. Add your **client** repo (root directory: `client`)
6. Set environment variables on each service (see table above)
7. Generate domains for both services — server on port `3001`, client on port `8080`
8. Update `CLIENT_URL` on server and `VITE_API_URL` on client with the generated URLs
9. Redeploy both services

Every `git push` to `main` triggers an automatic redeploy on Railway.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Zustand |
| Editor | Monaco Editor (@monaco-editor/react) |
| Drag and Drop | @dnd-kit/core, @dnd-kit/sortable |
| Real-time | Socket.io 4.7 (client + server) |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 16 |
| Cache / Pub-Sub | Redis 7, @socket.io/redis-adapter |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Deployment | Docker, Railway |

---

## 🤝 Contributing

Contributions are welcome!

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
git commit -m "Add your feature"
git push origin feature/your-feature-name
# Open a Pull Request
```

---

## 📄 License

MIT License — feel free to use this project for learning or building on top of it.

---

<div align="center">

Built with ♥ by [Manjunath V Poojari](https://github.com/Manjunathvpoojari)

⭐ Star this repo if you found it useful!

</div>