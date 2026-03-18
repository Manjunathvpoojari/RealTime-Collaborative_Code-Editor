const boardHandlers    = require('./boardHandlers');
const presenceHandlers = require('./presenceHandlers');

module.exports = function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`↑ ${socket.user.name} connected  [${socket.id}]`);

    boardHandlers(io, socket);
    presenceHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`↓ ${socket.user.name} disconnected [${socket.id}]`);
    });
  });
};
