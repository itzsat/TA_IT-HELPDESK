import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { SupportTickets } from './SupportTickets';
import { KnowledgeBaseManager } from './KnowledgeBaseManager';
import { UserManagement } from './UserManagement';

interface SupportDashboardProps {
  accessToken: string;
}

export function SupportDashboard({ accessToken }: SupportDashboardProps) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="mb-2">IT Support Dashboard</h2>
        <p className="text-slate-600">
        </p>
      </div>

      <Tabs defaultValue="tickets">
        <TabsList className="mb-6">
          <TabsTrigger value="tickets">Tiket Dukungan</TabsTrigger>
          <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
          <TabsTrigger value="users">Pengguna</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <SupportTickets accessToken={accessToken} />
        </TabsContent>

        <TabsContent value="knowledge-base">
          <KnowledgeBaseManager accessToken={accessToken} />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
