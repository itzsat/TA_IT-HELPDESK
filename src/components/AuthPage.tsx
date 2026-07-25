import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { User } from '../App';
import { mapSupabaseUser, supabase } from '../utils/supabase/SupabaseClient';

interface AuthPageProps {
  onLogin: (user: User, token: string) => void;
}

function authErrorMessage(err: unknown): string {
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    return [
      'Tidak ada koneksi ke Supabase (bukan kesalahan kata sandi).',
      'Pastikan Anda menjalankan `npm run dev` agar proxy Vite aktif, coba jaringan lain, matikan ekstensi browser, atau izinkan lalu lintas ke *.supabase.co.',
    ].join(' ');
  }
  if (err instanceof Error && /unexpected end of json|json\.parse|is not valid json/i.test(err.message)) {
    return [
      'Respons server tidak valid (bukan JSON).',
      'Periksa VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env.local, pastikan keduanya dari project Supabase yang sama, lalu restart npm run dev.',
    ].join(' ');
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Terjadi kesalahan';
}

export function AuthPage({ onLogin }: AuthPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw new Error(error.message);
      if (!data.user || !data.session) {
        throw new Error('Tidak ada sesi. Periksa konfirmasi email di proyek Supabase.');
      }

      onLogin(mapSupabaseUser(data.user), data.session.access_token);
    } catch (err: unknown) {
      console.error('Sign in error:', err);
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-6 mb-4">
            <img src="/peb.png" alt="PEB" className="h-12 w-auto object-contain" />
            <img src="/danantara.png" alt="Danantara" className="h-8 w-auto object-contain" />
          </div>
          <h1 className="mb-1">Sistem IT Helpdesk</h1>
          <p className="text-slate-500 text-sm">Masukkan kredensial Anda untuk mengakses sistem</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Masuk</CardTitle>
            <CardDescription>
              Akun dibuat oleh Administrator. Hubungi IT Support jika belum memiliki akun.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata Sandi</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sedang masuk...' : 'Masuk'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
