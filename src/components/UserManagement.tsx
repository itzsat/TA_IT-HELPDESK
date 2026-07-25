import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/SupabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Trash2, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'support'>('user');

  const fetchUsers = async () => {
    setLoading(true);
    // CATATAN: Untuk sistem production, endpoint ini sebaiknya menggunakan 
    // Edge Function khusus dengan Service Role untuk keamanan.
    // Di sini kita fetch users dummy (bisa diganti sesuai arsitektur database).
    try {
      // Karena supabase.auth.admin hanya bisa diakses via server, 
      // kita harus punya tabel 'profiles' atau view khusus.
      // Sebagai workaround untuk UI, kita bisa menggunakan tabel 'users' jika ada,
      // atau membuat Edge Function.
      // ...
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role }
        }
      });
      if (error) throw error;
      toast.success('Pengguna berhasil dibuat');
      setDialogOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat pengguna');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Manajemen Pengguna</h2>
          <p className="text-sm text-slate-500">Kelola akun pengguna dan IT Support</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Buat Akun
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Akun Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} minLength={6} required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <select 
                  className="w-full px-3 py-2 border rounded-md" 
                  value={role} 
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value as 'user'|'support')}
                >
                  <option value="user">User (Pengguna)</option>
                  <option value="support">IT Support</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                Data pengguna akan dimuat dari Supabase Admin API
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
