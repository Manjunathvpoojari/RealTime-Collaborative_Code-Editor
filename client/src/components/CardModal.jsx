import { useState, useEffect } from 'react';

const LABELS = ['bug', 'feature', 'design', 'docs', 'infra'];
const COLORS  = ['#4a8df8', '#22c98a', '#f0a53a', '#9b8df8', '#f87171', '#38bdf8', null];

export default function CardModal({ card, members, onClose, onUpdate, onDelete }) {
  const [title, setTitle]   = useState(card.title);
  const [desc, setDesc]     = useState(card.description || '');
  const [label, setLabel]   = useState(card.label || '');
  const [color, setColor]   = useState(card.color || null);
  const [assignee, setAss]  = useState(card.assignee_id || '');
  const [dirty, setDirty]   = useState(false);

  useEffect(() => {
    setDirty(
      title !== card.title || desc !== (card.description || '') ||
      label !== (card.label || '') || color !== (card.color || null) ||
      assignee !== (card.assignee_id || '')
    );
  }, [title, desc, label, color, assignee, card]);

  const save = () => {
    if (!title.trim()) return;
    onUpdate({ title: title.trim(), description: desc, label: label || null, color, assigneeId: assignee || null });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-[#161b27] border border-[#252d42] rounded-2xl shadow-modal animate-slide-up overflow-hidden">
        {/* Color bar */}
        {color && <div className="h-1.5 w-full" style={{ background: color }} />}

        <div className="p-6">
          {/* Title */}
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-transparent text-white font-semibold text-lg leading-snug focus:outline-none resize-none mb-4"
            rows={2}
          />

          {/* Description */}
          <div className="mb-5">
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Description</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Add a description…"
              rows={4}
              className="w-full bg-[#1c2232] border border-[#252d42] rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Assignee */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Assignee</label>
              <select
                value={assignee}
                onChange={e => setAss(e.target.value)}
                className="w-full bg-[#1c2232] border border-[#252d42] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
              >
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {/* Label */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Label</label>
              <select
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="w-full bg-[#1c2232] border border-[#252d42] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
              >
                <option value="">None</option>
                {LABELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Color */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 mb-2 block">Card color</label>
            <div className="flex gap-2">
              {COLORS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${!c ? 'bg-[#252d42] flex items-center justify-center' : ''} ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#161b27]' : ''}`}
                  style={c ? { background: c } : {}}
                  title={c || 'No color'}
                >
                  {!c && <span className="text-gray-500 text-sm">×</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={onDelete}
              className="text-xs text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-all"
            >
              Delete card
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg bg-[#1c2232] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!dirty}
                className="text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
