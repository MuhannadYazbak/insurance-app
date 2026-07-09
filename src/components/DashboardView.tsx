import React, { useState, useEffect } from 'react';

interface DashboardViewProps {
  onBack: () => void;
  onSelectClient: (clientId: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onBack, onSelectClient }) => {
  const [expiring, setExpiring] = useState<any[]>([]);
    const [stats, setStats] = useState<{ activeCount: number; totalPremium: number }>({ 
        activeCount: 0, 
        totalPremium: 0 
    });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      const res = await (window as any).electronAPI.getDashboardData();
      if (res.success) {
        setExpiring(res.expiringPolicies);
        setStats(res.stats);
      }
      setLoading(false);
    };
    fetchDashboard();
  }, []);

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-right" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border">
        <div>
          <h2 className="text-xl font-bold text-slate-800">לוח בקרה כללי</h2>
          <p className="text-xs text-slate-500 mt-1">מבט על, פוליסות לחידוש ונתונים פיננסיים</p>
        </div>
        <button 
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition"
        >
          חזרה לתיקי לקוחות ←
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs font-medium">טוען נתוני מערכת...</div>
      ) : (
        <div className="space-y-6">
          {/* Top Quick Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 flex justify-between items-center">
              <div className="text-2xl font-black text-blue-600 font-mono">₪{stats.totalPremium.toLocaleString()}</div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-700 block">סך פרמיות פעילות</span>
                <span className="text-[10px] text-slate-400">נפח תיק מנוהל רץ</span>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center">
              <div className="text-2xl font-black text-slate-700 font-mono">{stats.activeCount}</div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-700 block">פוליסות פעילות</span>
                <span className="text-[10px] text-slate-400">סה"כ חוזים קיימים במערכת</span>
              </div>
            </div>
          </div>

          {/* Main Expirations Panel */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="bg-amber-50/50 p-4 border-b border-amber-100">
              <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                ⏳ פוליסות שפוקעות ב-30 הימים הקרובים
              </h3>
            </div>

            <div className="p-4">
              {expiring.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 text-slate-500 font-bold">
                        <th className="p-2.5">שם לקוח</th>
                        <th className="p-2.5">מספר פוליסה</th>
                        <th className="p-2.5">סוג ביטוח</th>
                        <th className="p-2.5">חברה</th>
                        <th className="p-2.5">תאריך סיום</th>
                        <th className="p-2.5">פרמיה</th>
                        <th className="p-2.5 text-center">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {expiring.map((p) => (
                        <tr key={p.policyId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 font-bold text-slate-700">{p.clientName}</td>
                          <td className="p-2.5 font-mono text-slate-600">{p.policyNumber}</td>
                          <td className="p-2.5 font-medium">{p.policyType}</td>
                          <td className="p-2.5 text-slate-500">{p.company}</td>
                          <td className="p-2.5 font-mono text-amber-600 font-bold bg-amber-50/30">{p.endDate}</td>
                          <td className="p-2.5 font-mono text-slate-600">₪{p.premium}</td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => onSelectClient(p.clientId)}
                              className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition"
                            >
                              פתח תיק לקוח 👤
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs border border-dashed rounded-xl">
                  איזה יופי! אין פוליסות שפוקעות ב-30 הימים הקרובים.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};