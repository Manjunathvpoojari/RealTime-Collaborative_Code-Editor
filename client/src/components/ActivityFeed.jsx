const ACTION_LABELS = {
  'card:create': { icon: '✦', color: 'text-green-400', verb: 'created' },
  'card:move':   { icon: '⇄', color: 'text-blue-400',  verb: 'moved'   },
  'card:update': { icon: '✎', color: 'text-amber-400', verb: 'updated' },
  'card:delete': { icon: '✕', color: 'text-red-400',   verb: 'deleted' },
  'column:create': { icon: '▦', color: 'text-purple-400', verb: 'added column' },
  'column:delete': { icon: '▭', color: 'text-red-400',    verb: 'removed column' },
};

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)   return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function ActivityFeed({ activity }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#252d42] flex-shrink-0">
        <h3 className="text-sm font-semibold text-white">Activity</h3>
        <p className="text-xs text-gray-500 mt-0.5">{activity.length} events</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activity.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-600">No activity yet</div>
        ) : (
          <div className="divide-y divide-[#1c2232]">
            {activity.map((item) => {
              const meta = ACTION_LABELS[item.action] || { icon: '•', color: 'text-gray-400', verb: item.action };
              return (
                <div key={item.id} className="px-4 py-3 hover:bg-[#1c2232] transition-colors">
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0 mt-0.5"
                      style={{ background: item.avatar_color || '#4a8df8' }}
                    >
                      {item.user_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-300 leading-relaxed">
                        <span className="font-semibold text-white">{item.user_name || 'Someone'}</span>
                        {' '}
                        <span className={meta.color}>{meta.verb}</span>
                        {item.payload?.title && (
                          <span className="text-gray-400"> "{item.payload.title}"</span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{timeAgo(item.created_at)}</p>
                    </div>
                    <span className={`text-sm flex-shrink-0 ${meta.color}`}>{meta.icon}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
