import { useBoardStore } from '../store/boardStore';

export default function LiveCursors({ currentUserId }) {
  const cursors = useBoardStore(s => s.cursors);

  return (
    <>
      {Object.entries(cursors).map(([userId, data]) => {
        if (userId === currentUserId) return null;
        return (
          <div
            key={userId}
            className="pointer-events-none absolute z-40 transition-all duration-75"
            style={{ left: data.x, top: data.y }}
          >
            {/* Cursor SVG */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
              <path d="M0 0L0 16L4.5 12L7.5 19L9.5 18L6.5 11L12 11L0 0Z" fill={data.color || '#4a8df8'} />
            </svg>
            {/* Name label */}
            <div
              className="absolute top-4 left-3 text-[10px] font-semibold text-white px-1.5 py-0.5 rounded whitespace-nowrap"
              style={{ background: data.color || '#4a8df8' }}
            >
              {data.name}
            </div>
          </div>
        );
      })}
    </>
  );
}
