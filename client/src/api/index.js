import api from './client';

/* ── Auth ────────────────────────────────────────────────────── */
export const register = (data)  => api.post('/auth/register', data);
export const login    = (data)  => api.post('/auth/login', data);
export const fetchMe  = ()      => api.get('/auth/me');

/* ── Boards ──────────────────────────────────────────────────── */
export const getBoards      = ()                   => api.get('/boards');
export const getBoard       = (id)                 => api.get(`/boards/${id}`);
export const createBoard    = (data)               => api.post('/boards', data);
export const updateBoard    = (id, data)           => api.patch(`/boards/${id}`, data);
export const deleteBoard    = (id)                 => api.delete(`/boards/${id}`);
export const inviteMember   = (boardId, email)     => api.post(`/boards/${boardId}/invite`, { email });

/* ── Columns ─────────────────────────────────────────────────── */
export const createColumn   = (boardId, title)     => api.post(`/boards/${boardId}/columns`, { title });
export const updateColumn   = (boardId, colId, t)  => api.patch(`/boards/${boardId}/columns/${colId}`, { title: t });
export const deleteColumn   = (boardId, colId)     => api.delete(`/boards/${boardId}/columns/${colId}`);

/* ── Cards ───────────────────────────────────────────────────── */
export const createCard     = (boardId, data)      => api.post(`/boards/${boardId}/cards`, data);
export const updateCard     = (boardId, id, data)  => api.patch(`/boards/${boardId}/cards/${id}`, data);
export const deleteCard     = (boardId, id)        => api.delete(`/boards/${boardId}/cards/${id}`);
