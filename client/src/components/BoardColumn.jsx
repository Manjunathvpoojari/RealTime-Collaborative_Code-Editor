import { useState } from 'react';
import { SortableContext, verticalListSortingStrategy, useDroppable } from '@dnd-kit/sortable';
import CardItem from './CardItem';

export default function BoardColumn({
  column, cards, onCreateCard, onUpdateColumn, onDeleteColumn, onOpenCard, currentUserId
}) {
  const [addingCard, setAddingCard] = useState(false);
  const [cardTitle, setCardTitle]   = useState('');
  const [editingTitle, setEditing]  = useState(false);
  const [colTitle, setColTitle]     = useState(column.title);
  const [showMenu, setShowMenu]     = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const submitCard = (e) => {
    e?.preventDefault();
    if (!cardTitle.trim()) return;
    onCreateCard(cardTitle.trim());
    setCardTitle(''); setAddingCard(false);
  };

  const submitTitle = (e) => {
    e?.preventDefault();
    if (colTitle.trim() && colTitle !== column.title) onUpdateColumn(colTitle.trim());
    setEditing(false);
  };

  return (
    <div className="w-64 flex-shrink-0 flex flex-col max-h-full">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-2 px-1 group">
        {editingTitle ? (
          <form onSubmit={submitTitle} className="flex-1">
            <input
              autoFocus
              value={colTitle}
              onChange={e => setColTitle(e.target.value)}
              onBlur={submitTitle}
              onKeyDown={e => e.key === 'Escape' && setEditing(false)}
              className="w-full bg-[#1c2232] border border-brand-500 rounded px-2 py-1 text-sm font-semibold text-white focus:outline-none"
            />
          </form>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 text-left text-sm font-semibold text-gray-200 hover:text-white"
          >
            {column.title}
          </button>
        )}
        <span className="text-xs text-gray-600 bg-[#1c2232] px-1.5 py-0.5 rounded font-mono">
          {cards.length}
        </span>
        {/* Column menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-[#1c2232] opacity-0 group-hover:opacity-100 transition-all text-sm"
          >
            ⋯
          </button>
          {showMenu && (
            <div className="absolute right-0 top-7 w-36 bg-[#1c2232] border border-[#252d42] rounded-lg py-1 z-30 shadow-modal animate-fade-in">
              <button
                onClick={() => { setEditing(true); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#252d42]"
              >
                Rename column
              </button>
              <button
                onClick={() => { onDeleteColumn(); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-[#252d42]"
              >
                Delete column
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto min-h-[40px] rounded-xl transition-colors ${
          isOver ? 'bg-brand-500/5 ring-1 ring-brand-500/20' : ''
        }`}
      >
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 p-1">
            {cards.map(card => (
              <CardItem
                key={card.id}
                card={card}
                onClick={() => onOpenCard(card)}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      {/* Add card */}
      {addingCard ? (
        <form onSubmit={submitCard} className="mt-2 flex flex-col gap-2">
          <textarea
            autoFocus
            value={cardTitle}
            onChange={e => setCardTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitCard(); }
              if (e.key === 'Escape') setAddingCard(false);
            }}
            placeholder="Card title…"
            rows={2}
            className="w-full bg-[#161b27] border border-brand-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-brand-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg">Add card</button>
            <button type="button" onClick={() => { setAddingCard(false); setCardTitle(''); }} className="text-gray-500 hover:text-white text-xs px-2">Cancel</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAddingCard(true)}
          className="mt-2 w-full text-left text-xs text-gray-600 hover:text-gray-300 py-2 px-3 rounded-lg hover:bg-[#1c2232] transition-all flex items-center gap-1.5"
        >
          <span className="text-base leading-none">+</span> Add a card
        </button>
      )}
    </div>
  );
}
