import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase/SupabaseClient';

export interface Notification {
  id: number;
  user_id: string;
  title: string;
  body: string | null;
  type: 'info' | 'success' | 'warning';
  is_read: boolean;
  ticket_id: string | null;
  created_at: string;
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Fetch existing notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && data) {
      setNotifications(data as Notification[]);
    }
    setLoading(false);
  }, [userId]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: number) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
    );
  }, []);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    // Realtime subscription — listen for new notifications
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  return { notifications, unreadCount, loading, markAsRead, markAllRead };
}
