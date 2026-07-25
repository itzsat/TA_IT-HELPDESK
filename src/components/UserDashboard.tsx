import React, { useState } from 'react';
import { User } from '../App';
import { Button } from './ui/button';
import { ProblemReportForm } from './ProblemReportForm';
import { ReportHistory } from './ReportHistory';
import { UserTickets } from './UserTickets';
import { MessageSquare, History, Ticket } from 'lucide-react';

interface UserDashboardProps {
  user: User;
  accessToken: string;
}

type View = 'chat' | 'history' | 'tickets';

export function UserDashboard({ user, accessToken }: UserDashboardProps) {
  const [currentView, setCurrentView] = useState<View>('chat');

  return (
    <div>
      {/* Navigation */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="mb-1">Selamat datang, {user.user_metadata?.name}!</h2>
          <p className="text-slate-600">
            {currentView === 'chat' && 'Tanyakan keluhan IT yang kamu alami'}
            {currentView === 'history' && 'Lihat riwayat laporan masalah Anda'}
            {currentView === 'tickets' && 'Lacak tiket dukungan Anda yang terbuka'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={currentView === 'chat' ? 'default' : 'outline'}
            onClick={() => setCurrentView('chat')}
            className="gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Tanya Dukungan
          </Button>
          <Button
            variant={currentView === 'history' ? 'default' : 'outline'}
            onClick={() => setCurrentView('history')}
            className="gap-2"
          >
            <History className="w-4 h-4" />
            Riwayat
          </Button>
          <Button
            variant={currentView === 'tickets' ? 'default' : 'outline'}
            onClick={() => setCurrentView('tickets')}
            className="gap-2"
          >
            <Ticket className="w-4 h-4" />
            Tiket Saya
          </Button>
        </div>
      </div>

      {/* Content */}
      <div>
        {currentView === 'chat' && (
          <ProblemReportForm 
            accessToken={accessToken}
            user={user}
            onSuccess={() => setCurrentView('tickets')}
          />
        )}
        
        {currentView === 'history' && (
          <ReportHistory accessToken={accessToken} user={user} />
        )}
        
        {currentView === 'tickets' && (
          <UserTickets accessToken={accessToken} user={user} />
        )}
      </div>
    </div>
  );
}
