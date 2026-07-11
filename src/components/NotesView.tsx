import React, { useState, useEffect } from 'react';

interface Note {
  id: number;
  clientId: number;
  text: string;
  status: 'todo' | 'done' | 'try-again';
  createdAt: string;
}

interface NotesViewProps {
  clientId: number;
}

export const NotesView: React.FC<NotesViewProps> = ({ clientId }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'todo' | 'done' | 'try-again'>('todo');

  const fetchNotes = async () => {
    const res = await (window as any).electronAPI.getClientNotes(clientId);
    if (res.success) {
      setNotes(res.notes);
    }
  };

  useEffect(() => {
    fetchNotes();
    setIsFormOpen(false); // Reset form state when switching clients
    setText('');
  }, [clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const res = await (window as any).electronAPI.addClientNote({ clientId, text, status });
    if (res.success) {
      setText('');
      setStatus('todo');
      setIsFormOpen(false);
      fetchNotes();
    } else {
      alert(`שגיאה בהוספת תזכורת: ${res.error}`);
    }
  };

  const handleStatusChange = async (noteId: number, newStatus: 'todo' | 'done' | 'try-again') => {
    const res = await (window as any).electronAPI.updateNoteStatus(noteId, newStatus);
    if (res.success) {
      fetchNotes();
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

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top action bar */}
      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
        <span className="text-xs font-semibold text-slate-500">תיעוד אירועים, משימות והערות שירות</span>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            isFormOpen ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isFormOpen ? 'סגור טופס ✕' : 'הוסף תיעוד / משימה +'}
        </button>
      </div>

      {/* Dynamic Hidden Add Form */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 animate-fadeIn">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">תוכן ההערה / סיכום שיחה</label>
            <textarea
              rows={3}
              className="w-full p-2.5 border text-xs rounded-xl focus:ring-2 focus:ring-blue-500 bg-white resize-none outline-none font-medium"
              placeholder="הקלד כאן פרטים חשובים, סיכום שיחת טלפון, תנאים מבוקשים..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500">סטטוס משימה:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="text-xs p-1.5 border rounded-lg bg-white cursor-pointer focus:outline-none"
              >
                <option value="todo">לטיפול (Todo)</option>
                <option value="try-again">אין מענה / לנסות שוב (Try Again)</option>
                <option value="done">טופל בהצלחה (Done)</option>
              </select>
            </div>
            
            <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-sm">
              שמור הערה במערכת
            </button>
          </div>
        </form>
      )}

      {/* Notes Feed Stream Container */}
      <div className="space-y-2.5">
        {notes.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs border border-dashed rounded-xl bg-white">
            טרם נרשמו הערות או משימות בתיק לקוח זה.
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="bg-white p-3 border rounded-xl shadow-sm flex flex-col sm:flex-row justify-between sm:items-start gap-2">
              <div className="space-y-1 max-w-xl">
                <p className="text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                <span className="text-[10px] text-slate-400 font-mono block">תאריך רישום: {note.createdAt}</span>
              </div>

              {/* In-line Status Modifier Selector */}
              {/* Find this block inside the notes.map loop in NotesView.tsx */}
<div className="flex items-center gap-1.5 self-end sm:self-start">
  <select
    value={note.status}
    disabled={note.status === 'done'} // ◄--- ADD THIS LINE TO DISABLE IT
    onChange={(e) => handleStatusChange(note.id, e.target.value as any)}
    className={`text-[11px] font-bold p-1 px-2.5 rounded-md border focus:outline-none transition-colors ${
      note.status === 'done' 
        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 cursor-not-allowed opacity-90' // Styling for disabled state
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
    </div>
  );
};