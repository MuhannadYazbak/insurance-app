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

interface Policy {
  id: number;
  policyNumber: string;
  policyType: string;
  company: string;
  vehicleId?: number | null; // <-- Add this field
}

interface ClaimsViewProps {
  clientId: number;
  vehicles: Vehicle[];
  policies: Policy[];
}

export const ClaimsView: React.FC<ClaimsViewProps> = ({ clientId, vehicles, policies }) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Validation Error State
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

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
    setFormErrors({}); // Clear errors when client changes
  }, [clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { [key: string]: string } = {};

    // 1. Basic field presence check for description
    if (!description.trim()) {
      errors.description = 'אנא הזן תיאור מקרה חוקי';
    }

    // 2. MANDATORY: Policy Number Selection validation
    if (!policyNumber) {
      errors.policyNumber = 'חובה לשייך את התביעה לפוליסת ביטוח קיימת';
    }

    // 3. Incident Date validation (Cannot be a future date)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (incidentDate) {
      const incident = new Date(incidentDate);
      if (isNaN(incident.getTime())) {
        errors.incidentDate = 'תאריך אירוע לא תקין';
      } else {
        incident.setHours(0, 0, 0, 0);
        if (incident > today) {
          errors.incidentDate = 'תאריך האירוע אינו יכול להיות בעתיד';
        }
      }
    } else {
      errors.incidentDate = 'תאריך האירוע הוא שדה חובה';
    }

    // 4. Estimated Payout validation (Must be positive)
    if (estimatedPayout !== '') {
      const payoutVal = parseFloat(estimatedPayout);
      if (isNaN(payoutVal) || payoutVal < 0) {
        errors.estimatedPayout = 'סכום התביעה חייב להיות חיובי';
      }
    }

    // Block submission if any validations fail
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Clear errors if valid
    setFormErrors({});

    const payload = {
      clientId,
      vehicleId: vehicleId ? Number(vehicleId) : null,
      policyNumber, // Will now be safely bound to a real selected policy number string
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

  const handlePolicyChange = (selectedNum: string) => {
    setPolicyNumber(selectedNum);

    // Clear policy validation error if it was active
    if (formErrors.policyNumber) {
      setFormErrors(prev => {
        const c = { ...prev };
        delete c.policyNumber;
        return c;
      });
    }

    // Find the selected policy object
    const selectedPolicy = policies.find(p => p.policyNumber === selectedNum);

    if (selectedPolicy && selectedPolicy.vehicleId) {
      // Automatically match the vehicle linked to this policy
      setVehicleId(selectedPolicy.vehicleId.toString());
    } else {
      // Clear vehicle selection if the policy has no vehicle linked
      setVehicleId('');
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
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            setFormErrors({});
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${isFormOpen ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          {isFormOpen ? 'סגור טופס ✕' : 'פתח תביעה חדשה +'}
        </button>
      </div>

      {/* Hidden Open Claim Form */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-right">

          {/* Row 1: Date, Policy, Vehicle */}
          {/* תאריך אירוע */}
          <div className="relative">
            <label className="block text-[10px] text-gray-400 mb-1">תאריך האירוע (חובה)</label>
            <input
              type="date"
              className={`w-full text-xs p-2 border rounded font-mono ${formErrors.incidentDate ? 'border-red-500 bg-red-50/50' : 'border-gray-200'
                }`}
              value={incidentDate}
              onChange={(e) => {
                setIncidentDate(e.target.value);
                if (formErrors.incidentDate) {
                  setFormErrors(prev => { const c = { ...prev }; delete c.incidentDate; return c; });
                }
              }}
              required
            />
            {formErrors.incidentDate && (
              <span className="absolute -bottom-4 right-0 text-[9px] text-red-500 whitespace-nowrap">{formErrors.incidentDate}</span>
            )}
          </div>

          {/* מספר פוליסה רלוונטי (חובה) */}
          <div className="relative">
            <label className="block text-[10px] text-gray-400 mb-1">מספר פוליסה משויכת (חובה)</label>
            <select
              className={`w-full text-xs p-2 border rounded bg-white text-right ${formErrors.policyNumber ? 'border-red-500 bg-red-50/50' : 'border-gray-200'
                }`}
              value={policyNumber}
              onChange={(e) => handlePolicyChange(e.target.value)}
              required
            >
              <option value="">-- בחר פוליסה מתיק הלקוח --</option>
              {policies.map(p => (
                <option key={p.id} value={p.policyNumber}>
                  {p.company} - {p.policyType} ({p.policyNumber})
                </option>
              ))}
            </select>
            {formErrors.policyNumber && (
              <span className="absolute -bottom-4 right-0 text-[9px] text-red-500 whitespace-nowrap">{formErrors.policyNumber}</span>
            )}
          </div>

          {/* שיוך לרכב */}
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">שיוך לרכב מבוטח</label>
            <select
              className={`w-full text-xs p-2 border rounded text-right border-gray-200 ${policyNumber && policies.find(p => p.policyNumber === policyNumber)?.vehicleId
                  ? 'bg-slate-100 text-gray-500 cursor-not-allowed font-semibold'
                  : 'bg-white text-black'
                }`}
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={!!(policyNumber && policies.find(p => p.policyNumber === policyNumber)?.vehicleId)}
            >
              <option value="">ללא שיוך רכב</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.make} {v.model} ({v.licensePlate})</option>
              ))}
            </select>
          </div>

          {/* Row 2: Description (takes up 2 columns) and Payout (takes up 1 column) */}
          {/* תיאור הנזק */}
          <div className="md:col-span-2 relative">
            <label className="block text-[10px] text-gray-400 mb-1">תיאור הנזק / פרטי האירוע (חובה)</label>
            <input
              type="text"
              placeholder="פרט בקצרה את מהות האירוע (לדוגמה: תאונת חזית-אחור...)"
              className={`w-full text-xs p-2 border rounded bg-white ${formErrors.description ? 'border-red-500 bg-red-50/50' : 'border-gray-200'
                }`}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (formErrors.description) {
                  setFormErrors(prev => { const c = { ...prev }; delete c.description; return c; });
                }
              }}
              required
            />
            {formErrors.description && (
              <span className="absolute -bottom-4 right-0 text-[9px] text-red-500 whitespace-nowrap">{formErrors.description}</span>
            )}
          </div>

          {/* סכום מוערך */}
          <div className="relative">
            <label className="block text-[10px] text-gray-400 mb-1">סכום תביעה מוערך (ש"ח)</label>
            <input
              type="number"
              placeholder="₪"
              className={`w-full text-xs p-2 border rounded font-mono ${formErrors.estimatedPayout ? 'border-red-500 bg-red-50/50' : 'border-gray-200'
                }`}
              value={estimatedPayout}
              onChange={(e) => {
                setEstimatedPayout(e.target.value);
                if (formErrors.estimatedPayout) {
                  setFormErrors(prev => { const c = { ...prev }; delete c.estimatedPayout; return c; });
                }
              }}
            />
            {formErrors.estimatedPayout && (
              <span className="absolute -bottom-4 right-0 text-[9px] text-red-500 whitespace-nowrap">{formErrors.estimatedPayout}</span>
            )}
          </div>

          <button type="submit" className="md:col-span-3 bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg text-xs font-bold transition mt-2">
            רישום והגשת תביעה במערכת
          </button>
        </form>
      )}

      {/* Claims Records Data Sheet */}
      <div className="border rounded-xl overflow-hidden shadow-sm bg-white max-h-[340px] overflow-y-auto relative scrollbar-thin">
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