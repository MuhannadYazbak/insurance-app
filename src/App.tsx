import React, { useState, useEffect } from 'react';
import { DashboardView } from './components/DashboardView';
import { GlobalSearchView } from './components/GlobalSearchView';
import { ClientMainView } from './components/ClientMainView';
import { GlobalNotesView } from './components/GlobalNotesView';

interface Client {
  id: number;
  name: string;
  nationalId: string;
  phone: string;
}

export default function App() {
  // Inside App.tsx state block
const [activeView, setActiveView] = useState<'client-manager' | 'dashboard' | 'search' | 'global-notes'>('client-manager');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const loadClients = async () => {
    const data = await (window as any).electronAPI.getClients();
    setClients(data);
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleSelectClientById = (clientId: number) => {
    const targetClient = clients.find(c => c.id === clientId);
    if (targetClient) {
      setSelectedClient(targetClient);
    }
    setActiveView('client-manager');
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-600">
      {/* Top Application Bar */}
      {activeView === 'client-manager' && (
        <div className="bg-slate-800 text-white p-3 flex justify-between items-center px-6 shadow-md flex-row-reverse">
          <span className="font-bold tracking-wide text-sm">ניהול סוכנות ביטוח</span>
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveView('search')}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold transition"
            >
              🔍 חיפוש גלובלי
            </button>
            <button 
              onClick={() => setActiveView('dashboard')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition"
            >
              📊 לוח בקרה כללי
            </button>
            <button 
              onClick={() => setActiveView('global-notes')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-bold transition"
            >
              📋 משימות ותזכורות
            </button>
          </div>
        </div>
      )}

      {/* --- APP VIEWS --- */}
      
      {/* Slide 1: Decoupled Client Manager Workspace */}
      {activeView === 'client-manager' && (
        <ClientMainView 
          clients={clients}
          loadClients={loadClients}
          selectedClient={selectedClient}
          setSelectedClient={setSelectedClient}
        />
      )}

      {/* Slide 2: Analytics Dashboard */}
      {activeView === 'dashboard' && (
        <DashboardView 
          onBack={() => setActiveView('client-manager')} 
          onSelectClient={handleSelectClientById}
        />
      )}

      {/* Slide 3: Global Search Indexer */}
      {activeView === 'search' && (
        <GlobalSearchView 
          onBack={() => setActiveView('client-manager')} 
          onSelectClient={handleSelectClientById} 
        />
      )}
      {/* Slide 4: Global Agency Tasks Board */}
{activeView === 'global-notes' && (
  <GlobalNotesView 
    onBack={() => setActiveView('client-manager')}
    onSelectClient={handleSelectClientById}
  />
)}
    </div>
  );
}