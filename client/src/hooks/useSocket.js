import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

let sharedSocket = null;

// In production VITE_API_URL points to the API server (e.g. https://my-server.up.railway.app).
// In dev, the Vite proxy handles /socket.io so we connect to '/'.
const SOCKET_URL = import.meta.env.VITE_API_URL || '/';

export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!sharedSocket || !sharedSocket.connected) {
      sharedSocket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }
    socketRef.current = sharedSocket;

    return () => {
      // Don't disconnect on unmount — socket is shared across board views
    };
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef, emit, on };
}

export function disconnectSocket() {
  sharedSocket?.disconnect();
  sharedSocket = null;
}
