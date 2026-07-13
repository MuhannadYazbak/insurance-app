import React, { useState, useEffect } from 'react';

interface Vehicle {
  id: number;
  make: string;
  model: string;
  licensePlate: string;
}

interface Claim {
  id: number;
  clientId: number;
  vehicleId: number | null;
  policyNumber: string | null;
  incidentDate: string;
  description: string;
  estimatedPayout: number;
  status: 'open' | 'under-review' | 'settled' | 'rejected';
  createdAt: string;
  licensePlate?: string;
  make?: string;
  model?: string;
}

interface ClaimsViewProps {
  clientId: number;
  vehicles: Vehicle[];
}

export const ClaimsView: React.FC<ClaimsViewProps> = ({ clientId, vehicles }) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form parameters
  const [incidentDate, setIncidentDate] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedPayout, setEstimatedPayout] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');

  const fetchClaims = async () => {
    const res = await (window as any).electronAPI.getClientClaims(clientId);
    if (res.success) {
      setClaims(res.claims);
    }
  };

  useEffect(() => {
    fetchClaims();
    setIsFormOpen(false);
  }, [clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDate || !description.trim()) {
      alert('נא למלא תאריך אירוע ותיאור התביעה');
      return;
    }

    const payload = {
      clientId,
      vehicleId: vehicleId ? Number(vehicleId) : null,
      policyNumber: policyNumber || null,
      incidentDate,
      description,
      estimatedPayout: parseFloat(estimatedPayout) || 0,
    };

    const res = await (window as any).electronAPI.addClientClaim(payload);
    if (res.success) {
      setIncidentDate('');
      setDescription('');
      setEstimatedPayout('');
      setVehicleId('');
      setPolicyNumber('');
      setIsFormOpen(false);
      fetchClaims();
    } else {
      alert(`שגיאה ברישום תביעה: ${res.error}`);
    }
  };

  const handleStatusChange = async (claimId: number, newStatus: string) => {
    const res = await (window as any).electronAPI.updateClaimStatus(claimId, newStatus);
    if (res.success) {
      fetchClaims();
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'settled': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'rejected': return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'under-review': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Action Header */}
      <div className="flex flex-row items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 w-full" dir="rtl">
        <span className="text-xs font-bold text-slate-700">ניהול ומעקב תביעות לקוח - אירועים פתוחים</span>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${isFormOpen ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          {isFormOpen ? 'סגור טופס ✕' : 'פתח תביעה חדשה +'}
        </button>
      </div>

      {/* Hidden Open Claim Form */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-right">
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">תאריך האירוע (חובה)</label>
            <input
              type="date"
              className="w-full text-xs p-2 border rounded bg-white font-mono"
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 mb-1">מספר פוליסה רלוונטי</label>
            <input
              type="text"
              placeholder="לדוגמה: 493021"
              className="w-full text-xs p-2 border rounded bg-white"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 mb-1">שיוך לרכב מבוטח</label>
            <select
              className="w-full text-xs p-2 border rounded bg-white text-right"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              <option value="">ללא שיוך רכב</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.make} {v.model} ({v.licensePlate})</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] text-gray-400 mb-1">תיאור הנזק / פרטי האירוע (חובה)</label>
            <input
              type="text"
              placeholder="פרט בקצרה את מהות האירוע (לדוגמה: תאונת חזית-אחור, נזק מים בדירה...)"
              className="w-full text-xs p-2 border rounded bg-white"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 mb-1">סכום תביעה מוערך (ש"ח)</label>
            <input
              type="number"
              placeholder="₪"
              className="w-full text-xs p-2 border rounded bg-white font-mono"
              value={estimatedPayout}
              onChange={(e) => setEstimatedPayout(e.target.value)}
            />
          </div>

          <button type="submit" className="md:col-span-3 bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg text-xs font-bold transition mt-2">
            רישום והגשת תביעה במערכת
          </button>
        </form>
      )}

      {/* Claims Records Data Sheet */}
      <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b text-[11px] font-bold text-slate-600">
              <th className="p-3 text-center">שינוי סטטוס</th>
              <th className="p-3">סכום תביעה</th>
              <th className="p-3">רכב משויך</th>
              <th className="p-3">מספר פוליסה</th>
              <th className="p-3">תיאור מקרה</th>
              <th className="p-3">תאריך אירוע</th>
              <th className="p-3">מזהה תביעה</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs">
            {claims.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-6 text-gray-400">אין תביעות רשומות בתיק לקוח זה</td>
              </tr>
            ) : (
              claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3 text-center">
                    <select
                      value={claim.status}
                      onChange={(e) => handleStatusChange(claim.id, e.target.value)}
                      className={`text-[11px] font-bold p-1 rounded border cursor-pointer focus:outline-none transition-colors ${getStatusBadgeClass(claim.status)}`}
                    >
                      <option value="open">פתוח (Open)</option>
                      <option value="under-review">בבירור (Under Review)</option>
                      <option value="settled">סולק / שולם (Settled)</option>
                      <option value="rejected">נדחה (Rejected)</option>
                    </select>
                  </td>
                  <td className="p-3 font-mono font-semibold text-slate-700">₪{claim.estimatedPayout.toLocaleString()}</td>
                  <td className="p-3 font-mono text-blue-600">{claim.licensePlate ? `${claim.make} (${claim.licensePlate})` : '-'}</td>
                  <td className="p-3 font-mono text-gray-500">{claim.policyNumber || '-'}</td>
                  <td className="p-3 font-medium text-slate-700 max-w-xs truncate" title={claim.description}>{claim.description}</td>
                  <td className="p-3 font-mono text-gray-600 font-medium">{claim.incidentDate}</td>
                  <td className="p-3 font-mono text-gray-400">#{claim.id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};