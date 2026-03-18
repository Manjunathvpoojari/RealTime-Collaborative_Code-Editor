// In-memory presence: boardId → Map<socketId, userInfo>
// For multi-instance: replace with Redis HSET/HGETALL
const boardPresence = new Map();
const cursorThrottle = new Map(); // socketId → lastEmitMs

module.exports = function presenceHandlers(io, socket) {
  const user = socket.user;

  socket.on('presence:join', ({ boardId }) => {
    if (!boardPresence.has(boardId)) boardPresence.set(boardId, new Map());
    boardPresence.get(boardId).set(socket.id, {
      id: user.id, name: user.name, avatar_color: user.avatar_color,
    });
    broadcastPresence(io, boardId);
  });

  socket.on('cursor:move', ({ boardId, x, y }) => {
    const now = Date.now();
    if (now - (cursorThrottle.get(socket.id) || 0) < 50) return; // max 20/s
    cursorThrottle.set(socket.id, now);
    socket.to(`board:${boardId}`).emit('cursor:update', {
      userId: user.id, name: user.name, color: user.avatar_color, x, y,
    });
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (!room.startsWith('board:')) continue;
      const boardId = room.replace('board:', '');
      if (boardPresence.has(boardId)) {
        boardPresence.get(boardId).delete(socket.id);
        broadcastPresence(io, boardId, room);
      }
    }
    cursorThrottle.delete(socket.id);
  });
};

function broadcastPresence(io, boardId, room) {
  const members = Array.from((boardPresence.get(boardId) || new Map()).values());
  io.to(room || `board:${boardId}`).emit('presence:update', { members });
}
