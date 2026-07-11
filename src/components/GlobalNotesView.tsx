import React, { useState, useEffect } from 'react';

interface GlobalNote {
  id: number;
  clientId: number;
  clientName: string;
  text: string;
  status: 'todo' | 'done' | 'try-again';
  createdAt: string;
}

interface GlobalNotesViewProps {
  onBack: () => void;
  onSelectClient: (clientId: number) => void;
}

export const GlobalNotesView: React.FC<GlobalNotesViewProps> = ({ onBack, onSelectClient }) => {
  const [allNotes, setAllNotes] = useState<GlobalNote[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'try-again' | 'done'>('all');
  const [loading, setLoading] = useState(true);

  const fetchGlobalNotes = async () => {
    setLoading(true);
    const res = await (window as any).electronAPI.getAllNotes();
    if (res.success) {
      setAllNotes(res.notes);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGlobalNotes();
  }, []);

  const handleStatusChange = async (noteId: number, newStatus: 'todo' | 'done' | 'try-again') => {
    const res = await (window as any).electronAPI.updateNoteStatus(noteId, newStatus);
    if (res.success) {
      fetchGlobalNotes();
    }
  };

  const getStatusStyle = (s: string) => {
    switch (s) {
      case 'done': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'try-again': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'done': return 'בוצע ✓';
      case 'try-again': return 'לא ענה / לנסות שוב 📞';
      default: return 'לטיפול (משימה) ⏳';
    }
  };

  const filteredNotes = allNotes.filter(note => {
    if (filter === 'all') return true;
    return note.status === filter;
  });

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-6 flex flex-col items-center" dir="rtl">
      <header className="w-full max-w-5xl mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">מרכז משימות ותזכורות סוכנות</h1>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition shadow-sm"
        >
          חזור לניהול לקוחות →
        </button>
      </header>

      <main className="w-full max-w-5xl bg-white p-6 rounded-xl shadow-sm flex flex-col gap-6">
        {/* Filter Navigation Menu Bar */}
        <div className="flex border-b justify-start gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
              filter === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            כל הרישומים ({allNotes.length})
          </button>
          <button
            onClick={() => setFilter('todo')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
              filter === 'todo' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            משימות לטיפול ({allNotes.filter(n => n.status === 'todo').length})
          </button>
          <button
            onClick={() => setFilter('try-again')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
              filter === 'try-again' ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            אין מענה / לנסות שוב ({allNotes.filter(n => n.status === 'try-again').length})
          </button>
          <button
            onClick={() => setFilter('done')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
              filter === 'done' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            משימות שבוצעו ({allNotes.filter(n => n.status === 'done').length})
          </button>
        </div>

        {/* Notes Action Matrix Grid */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-10 text-xs text-gray-400">טוען משימות...</div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs border border-dashed rounded-xl bg-gray-50">
              לא נמצאו משימות בקטגוריה זו.
            </div>
          ) : (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                className="bg-white p-4 border rounded-xl shadow-sm hover:border-gray-300 transition flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-right"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => onSelectClient(note.clientId)}
                      className="text-sm font-bold text-blue-600 hover:underline bg-blue-50 px-2.5 py-0.5 rounded-md transition"
                      title="לחץ למעבר ישיר לכרטיס הלקוח"
                    >
                      👤 {note.clientName}
                    </button>
                    <span className="text-[10px] text-gray-400 font-mono">{note.createdAt}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {note.text}
                  </p>
                </div>

                {/* Inline Quick Action Dropdown Status Selector */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <select
                    value={note.status}
                    disabled={note.status === 'done'}
                    onChange={(e) => handleStatusChange(note.id, e.target.value as any)}
                    className={`text-[11px] font-bold p-1 px-2.5 rounded-md border focus:outline-none transition-colors ${
                      note.status === 'done'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 cursor-not-allowed opacity-90'
                        : getStatusStyle(note.status)
                    }`}
                  >
                    <option value="todo">{getStatusLabel('todo')}</option>
                    <option value="try-again">{getStatusLabel('try-again')}</option>
                    <option value="done">{getStatusLabel('done')}</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};