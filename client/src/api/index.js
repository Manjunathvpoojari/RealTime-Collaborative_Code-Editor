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



/* ── Code Sessions ───────────────────────────────────────── */
export const getCodeSession  = (boardId)              => api.get(`/boards/${boardId}/code`);
export const saveCodeSession = (boardId, code, lang)  => api.post(`/boards/${boardId}/code`, { code, language: lang });


/* ── Code Versions ───────────────────────────────────────── */
export const getCodeVersions   = (boardId)                    => api.get(`/boards/${boardId}/versions`);
export const getCodeVersionById = (boardId, versionId)        => api.get(`/boards/${boardId}/versions/${versionId}`);
export const createCodeVersion  = (boardId, code, lang, msg)  => api.post(`/boards/${boardId}/versions`, { code, language: lang, message: msg });
/* ── Code Runner ─────────────────────────────────────────── */
export const runCode = (code, language) => api.post('/boards/run', { code, language });