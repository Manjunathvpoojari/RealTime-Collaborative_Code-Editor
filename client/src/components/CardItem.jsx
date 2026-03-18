import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const LABEL_COLORS = {
  bug:      'bg-red-500/20 text-red-400',
  feature:  'bg-brand-500/20 text-brand-400',
  design:   'bg-purple-500/20 text-purple-400',
  docs:     'bg-gray-500/20 text-gray-400',
  infra:    'bg-amber-500/20 text-amber-400',
};

export default function CardItem({ card, onClick, isDragging, currentUserId }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging: isSortDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group bg-[#1c2232] border rounded-xl px-3 py-2.5 cursor-pointer select-none transition-all
        ${isDragging
          ? 'border-brand-500 shadow-card-hover rotate-1 scale-105'
          : 'border-[#252d42] hover:border-[#3a4664] hover:shadow-card'
        }`}
    >
      {/* Color stripe */}
      {card.color && (
        <div
          className="w-full h-1 rounded-full mb-2 -mt-0.5"
          style={{ background: card.color }}
        />
      )}

      {/* Label */}
      {card.label && (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded mb-1.5 inline-block ${LABEL_COLORS[card.label] || 'bg-gray-500/20 text-gray-400'}`}>
          {card.label}
        </span>
      )}

      <p className="text-sm text-gray-200 leading-snug break-words">{card.title}</p>

      {card.description && (
        <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">{card.description}</p>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {card.assignee_id && (
            <div
              title={card.assignee_name}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white"
              style={{ background: card.assignee_color || '#4a8df8' }}
            >
              {card.assignee_name?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className="text-[10px] text-gray-700 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
