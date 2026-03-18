import { useBoardStore } from '../store/boardStore';

export default function PresenceBar() {
  const presence = useBoardStore(s => s.presence);
  if (!presence.length) return null;

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1.5">
        {presence.slice(0, 6).map((u) => (
          <div
            key={u.id}
            title={`${u.name} (online)`}
            className="w-7 h-7 rounded-full border-2 border-[#161b27] flex items-center justify-center text-xs font-semibold text-white transition-all hover:z-10 hover:scale-110"
            style={{ background: u.avatar_color }}
          >
            {u.name?.[0]?.toUpperCase()}
          </div>
        ))}
        {presence.length > 6 && (
          <div className="w-7 h-7 rounded-full border-2 border-[#161b27] bg-[#252d42] flex items-center justify-center text-[10px] text-gray-400">
            +{presence.length - 6}
          </div>
        )}
      </div>
      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse ml-1" title="Live" />
    </div>
  );
}
