import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Ticket, ChevronDown, ChevronUp, Send, RefreshCw } from 'lucide-react';
import { supabaseAdmin } from '../utils/supabase/adminClient';
import { User } from '../App';

interface UserTicketsProps {
  accessToken: string;
  user: User;
}

interface TicketData {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  submittedBy: string;
  userId: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  comments: Array<{
    id: string;
    author: string;
    authorRole: string;
    content: string;
    timestamp: string;
  }>;
}

export function UserTickets({ accessToken, user }: UserTicketsProps) {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error: dbErr } = await supabaseAdmin
        .from('kv_store_688b6236')
        .select('*')
        .like('key', 'ticket_%');

      if (dbErr) throw new Error(dbErr.message);

      let parsed = (data || []).map(row => row.value as TicketData);
      // Filter by current user
      parsed = parsed.filter(t => t.userId === user.id);
      parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setTickets(parsed);
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      if (!silent) setError(err.message || 'Failed to fetch tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchTickets();
    // Poll every 30 seconds to pick up admin updates
    intervalRef.current = setInterval(() => fetchTickets(true), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTickets]);

  const handleAddComment = async (ticketId: string) => {
    if (!commentText.trim()) return;

    setSendingComment(true);
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) throw new Error('Ticket not found');

      const comment = {
        id: `comment_${Date.now()}`,
        author: user.user_metadata?.name || user.email || 'User',
        authorRole: 'user',
        content: commentText,
        timestamp: new Date().toISOString()
      };

      const updatedComments = [...(ticket.comments || []), comment];
      const updatedTicket = { ...ticket, comments: updatedComments, updatedAt: new Date().toISOString() };

      const { error: dbErr } = await supabaseAdmin
        .from('kv_store_688b6236')
        .update({ value: updatedTicket })
        .eq('key', ticketId);

      if (dbErr) throw new Error(dbErr.message);

      setTickets(tickets.map((t) => (t.id === ticketId ? updatedTicket : t)));
      setCommentText('');
    } catch (err: any) {
      console.error('Error adding comment:', err);
      setError(err.message || 'Failed to add comment');
    } finally {
      setSendingComment(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-purple-100 text-purple-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Memuat tiket...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tiket Dukungan Saya</CardTitle>
          <CardDescription>
            Lacak status permintaan dukungan Anda
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchTickets(true)}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Memperbarui...' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <div className="text-center py-12">
            <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Tidak ada tiket dukungan</p>
            <p className="text-slate-500 mt-2">
              Tiket akan dibuat ketika solusi otomatis tidak tersedia
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50"
                  onClick={() =>
                    setExpandedTicket(
                      expandedTicket === ticket.id ? null : ticket.id
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status}
                        </Badge>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        <span className="text-slate-500">
                          #{ticket.id.split('_')[1]}
                        </span>
                      </div>
                      <h4 className="text-slate-900 mb-1">{ticket.title}</h4>
                      <div className="flex items-center gap-4 text-slate-500">
                        <span>{ticket.category}</span>
                        <span>•</span>
                        <span>{formatDate(ticket.createdAt)}</span>
                        {ticket.assignedTo && (
                          <>
                            <span>•</span>
                            <span>Ditugaskan kepada {ticket.assignedTo}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      {expandedTicket === ticket.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {expandedTicket === ticket.id && (
                  <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-4">
                    <div>
                      <h5 className="text-slate-900 mb-2">Deskripsi:</h5>
                      <p className="text-slate-600">{ticket.description}</p>
                    </div>

                    {ticket.comments && ticket.comments.length > 0 && (
                      <div>
                        <h5 className="text-slate-900 mb-3">Komentar:</h5>
                        <div className="space-y-3">
                          {ticket.comments.map((comment) => (
                            <div
                              key={comment.id}
                              className={`p-3 rounded-lg ${
                                comment.authorRole === 'support'
                                  ? 'bg-blue-50 border border-blue-200'
                                  : 'bg-white border border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-slate-900">
                                  {comment.author}
                                </span>
                                {comment.authorRole === 'support' && (
                                  <Badge className="bg-blue-600">IT Support</Badge>
                                )}
                                <span className="text-slate-500">
                                  {formatDate(comment.timestamp)}
                                </span>
                              </div>
                              <p className="text-slate-700">{comment.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {ticket.status !== 'closed' && (
                      <div className="space-y-2">
                        <h5 className="text-slate-900">Tambah komentar:</h5>
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Tulis pesan Anda..."
                            value={commentText}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommentText(e.target.value)}
                            rows={3}
                            className="flex-1"
                          />
                        </div>
                        <Button
                          onClick={() => handleAddComment(ticket.id)}
                          disabled={!commentText.trim() || sendingComment}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {sendingComment ? 'Mengirim...' : 'Kirim Komentar'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
