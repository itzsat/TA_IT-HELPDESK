import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Info, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useNotifications, Notification } from '../hooks/useNotifications';

interface NotificationBellProps {
  userId: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  return `${days} hari lalu`;
}

function NotifIcon({ type }: { type: Notification['type'] }) {
  if (type === 'success') return <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />;
  if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />;
  return <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = () => {
    setOpen(prev => !prev);
  };

  const handleMarkAsRead = (id: number) => {
    markAsRead(id);
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Notifikasi</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-slate-500">{unreadCount} belum dibaca</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="Tandai semua sudah dibaca"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Tidak ada notifikasi</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 ${
                    !notif.is_read ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <NotifIcon type={notif.type} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!notif.is_read ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.body}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                  {!notif.is_read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
