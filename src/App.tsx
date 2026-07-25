import React from 'react';
import { useState, useEffect } from 'react';
import { AuthPage } from './components/AuthPage';
import { UserDashboard } from './components/UserDashboard';
import { SupportDashboard } from './components/SupportDashboard';
import { NotificationBell } from './components/NotificationBell';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/sonner';
import { LogOut } from 'lucide-react';
import { mapSupabaseUser, supabase } from './utils/supabase/SupabaseClient';

export interface User {
  id: string;
  email: string;
  user_metadata: {
    name: string;
    role: 'user' | 'support';
  };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session check error:', error);
          localStorage.removeItem('access_token');
        } else if (session?.user && session.access_token) {
          setUser(mapSupabaseUser(session.user));
          setAccessToken(session.access_token);
        }
      } catch (error) {
        console.error('Session check error:', error);
        localStorage.removeItem('access_token');
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const handleLogin = (user: User, token: string) => {
    setUser(user);
    setAccessToken(token);
    localStorage.setItem('access_token', token);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('access_token');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !accessToken) {
    return <AuthPage onLogin={handleLogin} />;
  }

  const isSupport = user.user_metadata?.role === 'support';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/peb.png"
                alt="PLN Pelayanan Energi Batam"
                className="h-12 w-auto object-contain"
              />
              <div>
                <h1 className="text-lg font-bold text-slate-900">IT Helpdesk Sistem</h1>
                <p className="text-slate-600 text-sm">
                  {isSupport ? 'IT Support Portal' : 'User Portal'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-slate-900 text-sm font-medium">{user.user_metadata?.name}</p>
                <p className="text-slate-500 text-xs">{user.email}</p>
              </div>
              <NotificationBell userId={user.id} />
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isSupport ? (
          <SupportDashboard accessToken={accessToken} />
        ) : (
          <UserDashboard user={user} accessToken={accessToken} />
        )}
      </main>

      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-slate-500">
            Powered by Forward Chaining  • IT Helpdesk System v1.0
          </p>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
