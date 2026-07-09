import React, { useState, useEffect } from 'react';

interface GlobalSearchViewProps {
  onBack: () => void;
  onSelectClient: (clientId: number) => void;
}

export const GlobalSearchView: React.FC<GlobalSearchViewProps> = ({ onBack, onSelectClient }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const triggerSearch = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      const res = await (window as any).electronAPI.globalSearch(query);
      if (res.success) {
        setResults(res.results);
      }
    };

    // Simple debounce to keep database queries lightning fast
    const delayDebounce = setTimeout(triggerSearch, 150);
    return () => clearTimeout(delayDebounce);
  }, [query]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-right" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border">
        <div>
          <h2 className="text-xl font-bold text-slate-800">חיפוש גלובלי מתקדם</h2>
          <p className="text-xs text-slate-500 mt-1">איתור מהיר לפי מספר פוליסה, לוחית רישוי, חברה או שם לקוח</p>
        </div>
        <button 
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition"
        >
          חזרה לתיקי לקוחות ←
        </button>
      </div>

      {/* Input Box */}
      <div className="bg-white p-4 rounded-xl shadow-sm border max-w-2xl mx-auto mb-6">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="הקלד מספר פוליסה, לוחית רישוי, חברה או שם..."
          className="w-full p-3 border rounded-xl text-xs bg-slate-50 focus:bg-white transition-all text-right outline-none focus:ring-2 focus:ring-blue-500 font-medium"
        />
      </div>

      {/* Results Dynamic Container */}
      <div className="max-w-2xl mx-auto space-y-2">
        {results.length > 0 ? (
          results.map((item, idx) => (
            <div 
              key={idx}
              onClick={() => onSelectClient(item.clientId)}
              className="bg-white p-3 border rounded-xl shadow-sm flex justify-between items-center hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all"
            >
              <div className="text-right">
  <span className="text-xs font-bold text-slate-700 block">{item.clientName}</span>
  <span className="text-[11px] text-slate-400">
    {item.allPolicies ? `פוליסות: ${item.allPolicies} (${item.allCompanies})` : 'אין פוליסות רשומות'}
    {item.allVehicles ? ` | רכבים: ${item.allVehicles}` : ''}
  </span>
</div>
              <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-medium">
                פתח תיק לקוח 👤
              </span>
            </div>
          ))
        ) : (
          query.trim().length >= 2 && (
            <div className="text-center py-8 text-slate-400 text-xs bg-white rounded-xl border border-dashed">
              לא נמצאו תוצאות תואמות לחיפוש שלך
            </div>
          )
        )}
      </div>
    </div>
  );
};