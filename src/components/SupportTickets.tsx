import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Ticket, ChevronDown, ChevronUp, Send, Search, Lightbulb, RefreshCw } from 'lucide-react';
import { supabaseAdmin } from '../utils/supabase/adminClient';

interface SupportTicketsProps {
  accessToken: string;
}

interface TicketData {
  id: string;
  title: string;
  description: string;
  symptoms: string[];
  category: string;
  priority: string;
  status: string;
  submittedBy: string;
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

export function SupportTickets({ accessToken }: SupportTicketsProps) {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create Rule State
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<TicketData | null>(null);
  const [newDamageName, setNewDamageName] = useState('');
  const [newDamageDesc, setNewDamageDesc] = useState('');
  const [newSolutionTitle, setNewSolutionTitle] = useState('');
  const [newSolutionCategory, setNewSolutionCategory] = useState('');
  const [newSolutionSteps, setNewSolutionSteps] = useState('');
  const [savingRule, setSavingRule] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

      const parsed = (data || []).map(row => row.value as TicketData);
      parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setTickets(parsed);
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      if (!silent) setError(err.message || 'Failed to fetch tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    // Poll every 30 seconds to pick up user comments
    intervalRef.current = setInterval(() => fetchTickets(true), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTickets]);

  const handleUpdateTicket = async (ticketId: string, updates: Partial<TicketData>) => {
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;

      const updatedTicket = { ...ticket, ...updates, updatedAt: new Date().toISOString() };

      const { error: dbErr } = await supabaseAdmin
        .from('kv_store_688b6236')
        .update({ value: updatedTicket })
        .eq('key', ticketId);

      if (dbErr) throw new Error(dbErr.message);

      setTickets(tickets.map((t) => (t.id === ticketId ? updatedTicket : t)));
    } catch (err: any) {
      console.error('Error updating ticket:', err);
      setError(err.message || 'Failed to update ticket');
    }
  };

  const handleAddComment = async (ticketId: string, customContent?: string, authorName = 'IT Support') => {
    const contentToUse = customContent || commentText;
    if (!contentToUse.trim()) return;

    setSendingComment(true);
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) throw new Error('Ticket not found');

      const comment = {
        id: `comment_${Date.now()}`,
        author: authorName,
        authorRole: 'support',
        content: contentToUse,
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
      if (!customContent) setCommentText('');
    } catch (err: any) {
      console.error('Error adding comment:', err);
      setError(err.message || 'Failed to add comment');
    } finally {
      setSendingComment(false);
    }
  };

  const handleCreateRule = async () => {
    if (!activeTicket) return;
    setSavingRule(true);
    try {
      // 1. Generate new IDs
      const timestamp = Date.now();
      const dmgCode = `K_${timestamp}`;
      const ruleCode = `RULE_${timestamp}`;
      const solCode = `SOL_${timestamp}`;

      // 2. Insert Damage
      const { error: dmgErr } = await supabaseAdmin.from('damages').insert({
        code: dmgCode,
        name: newDamageName,
        description: newDamageDesc
      });
      if (dmgErr) throw new Error("Damage Error: " + dmgErr.message);

      // 3. Insert Solution
      const stepsArray = newSolutionSteps.split('\n').map(s => s.trim()).filter(s => s);
      const { error: solErr } = await supabaseAdmin.from('solutions').insert({
        code: solCode,
        damage_code: dmgCode,
        description: newSolutionTitle,
        steps: stepsArray
      });
      if (solErr) throw new Error("Solution Error: " + solErr.message);

      // 4. Insert Rule based on ticket's symptoms
      let symptomCodes = activeTicket.symptoms || [];

      if (symptomCodes.length === 0) {
        const newSymCode = `G_${timestamp}`;
        const { error: symErr } = await supabaseAdmin.from('symptoms').insert({
          code: newSymCode,
          name: activeTicket.title,
          category: activeTicket.category || 'Other'
        });
        if (symErr) throw new Error("Symptom Error: " + symErr.message);
        symptomCodes = [newSymCode];
      }

      const { error: ruleErr } = await supabaseAdmin.from('rules').insert({
        code: ruleCode,
        damage_code: dmgCode,
        symptom_codes: symptomCodes,
        confidence: 0.9
      });
      if (ruleErr) throw new Error("Rule Error: " + ruleErr.message);

      // 5. Update Ticket Status to resolved and add auto comment
      await handleUpdateTicket(activeTicket.id, { status: 'resolved' });
      
      const solutionMessage = `Sistem Knowledge Base telah diperbarui! Tiket diselesaikan dengan solusi berikut:\n\n**${newSolutionTitle}**\n${stepsArray.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
      
      await handleAddComment(
        activeTicket.id,
        solutionMessage,
        'Sistem Otomatis'
      );

      setRuleDialogOpen(false);
      setActiveTicket(null);
      setNewDamageName('');
      setNewDamageDesc('');
      setNewSolutionTitle('');
      setNewSolutionCategory('');
      setNewSolutionSteps('');
      alert("Aturan berhasil dibuat dan tiket telah diselesaikan!");
    } catch (err: any) {
      console.error('Error creating rule:', err);
      setError(err.message || 'Gagal membuat aturan baru');
    } finally {
      setSavingRule(false);
    }
  };

  const openRuleDialog = (ticket: TicketData) => {
    setActiveTicket(ticket);
    setNewDamageDesc(ticket.description);
    setNewDamageName(ticket.title);
    setRuleDialogOpen(true);
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in-progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
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
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
    } catch (e) {
      return dateString;
    }
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

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Semua Tiket Dukungan</CardTitle>
            <CardDescription>
              Kelola dan balas permintaan dukungan pengguna
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
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari tiket..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter berdasarkan status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">Tidak ada tiket ditemukan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
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
                          <span>{ticket.submittedBy}</span>
                          <span>•</span>
                          <span>{formatDate(ticket.createdAt)}</span>
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
                        <h5 className="text-slate-900 mb-2">Deskripsi Masalah:</h5>
                        <p className="text-slate-600">{ticket.description}</p>
                      </div>

                      {Array.isArray(ticket.symptoms) && ticket.symptoms.length > 0 && (
                        <div>
                          <h5 className="text-slate-900 mb-2">Gejala Terdeteksi:</h5>
                          <div className="flex flex-wrap gap-2">
                            {ticket.symptoms.map(sym => (
                              <Badge key={sym} variant="outline">{sym}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Update controls */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white border border-slate-200 rounded-lg">
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select
                            value={ticket.status || 'open'}
                            onValueChange={(value: string) =>
                              handleUpdateTicket(ticket.id, { status: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Assign To</Label>
                          <Select
                            value={ticket.assignedTo || 'unassigned'}
                            onValueChange={(value: string) =>
                              handleUpdateTicket(ticket.id, { assignedTo: value === 'unassigned' ? undefined : value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              <SelectItem value="Rio Renaldo">Rio Renaldo</SelectItem>
                              <SelectItem value="Bagasatria">Bagasatria</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Comments */}
                      {Array.isArray(ticket.comments) && ticket.comments.length > 0 && (
                        <div>
                          <h5 className="text-slate-900 mb-3">Tanggapan:</h5>
                          <div className="space-y-3">
                            {ticket.comments.map((comment) => (
                              <div
                                key={comment.id}
                                className={`p-3 rounded-lg ${comment.authorRole === 'support'
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

                      {/* Add comment & Add Rule */}
                      <div className="space-y-2 border-t border-slate-200 pt-4 mt-4">
                        <Label>Tambah Tanggapan / Solusi</Label>
                        <Textarea
                          placeholder="Tulis tanggapan Anda untuk pengguna..."
                          value={commentText}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommentText(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleAddComment(ticket.id)}
                            disabled={!commentText.trim() || sendingComment}
                            className="flex-1"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {sendingComment ? 'Mengirim...' : 'Kirim Tanggapan'}
                          </Button>

                          <Dialog open={ruleDialogOpen && activeTicket?.id === ticket.id} onOpenChange={(open: boolean) => {
                            if (!open) {
                              setRuleDialogOpen(false);
                              setActiveTicket(null);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="secondary"
                                className="flex-1 bg-purple-100 text-purple-700 hover:bg-purple-200"
                                onClick={() => openRuleDialog(ticket)}
                              >
                                <Lightbulb className="w-4 h-4 mr-2" />
                                Jadikan Aturan Baru
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Jadikan Aturan Knowledge Base</DialogTitle>
                                <DialogDescription>
                                  Ubah tiket ini menjadi aturan otomatis agar keluhan serupa bisa diselesaikan oleh sistem.
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                  <Label>Gejala (dari tiket)</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {Array.isArray(activeTicket?.symptoms) && activeTicket.symptoms.length > 0 ? activeTicket.symptoms.map(sym => (
                                      <Badge key={sym} variant="outline" className="bg-slate-50">{sym}</Badge>
                                    )) : (
                                      <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                        Tiket ini tidak memiliki gejala. Sistem akan otomatis mendaftarkan keluhan <b>"{activeTicket?.title}"</b> sebagai gejala baru.
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-2 border-t pt-4">
                                  <Label className="text-purple-700 font-semibold">1. Definisi Masalah / Kerusakan</Label>
                                  <Input
                                    placeholder="Nama Masalah (contoh: Kerusakan WiFi Adaptor)"
                                    value={newDamageName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDamageName(e.target.value)}
                                  />
                                  <Textarea
                                    placeholder="Deskripsi Masalah"
                                    value={newDamageDesc}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewDamageDesc(e.target.value)}
                                    rows={2}
                                  />
                                </div>

                                <div className="space-y-2 border-t pt-4">
                                  <Label className="text-purple-700 font-semibold">2. Solusi Langkah Demi Langkah</Label>
                                  <Input
                                    placeholder="Judul Solusi (contoh: Cara Reset Network Adapter)"
                                    value={newSolutionTitle}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSolutionTitle(e.target.value)}
                                  />
                                  <Textarea
                                    placeholder="Langkah 1\nLangkah 2\nLangkah 3"
                                    value={newSolutionSteps}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewSolutionSteps(e.target.value)}
                                    rows={4}
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end gap-2 mt-4">
                                <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Batal</Button>
                                <Button
                                  onClick={handleCreateRule}
                                  disabled={savingRule || !newDamageName || !newSolutionTitle || !newSolutionSteps}
                                >
                                  {savingRule ? 'Menyimpan...' : 'Simpan ke Knowledge Base'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
