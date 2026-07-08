import React, { useState, useEffect } from 'react';

interface Client {
  id: number;
  name: string;
  nationalId: string;
  phone: string;
}

interface Vehicle {
  id: number;
  clientId: number;
  licensePlate: string;
  make: string;
  model: string;
  year: string;
}

interface Policy {
  id: number;
  clientId: number;
  vehicleId: number | null; // Nullable for non-car policies
  policyNumber: string;
  company: string;
  policyType: 'חובה' | 'מקיף' | 'צד ג' | 'בריאות' | 'פנסיה' | 'חיים' | 'דירה'; // Expanded types
  startDate: string;
  endDate: string;
  premium: number;
  coverageDetails?: string; // ◄--- Added for flexible notes (e.g., "כולל השתתפות עצמית נמוכה", "קופת גמל")
}

export default function App() {
  // --- ניהול סטייט מרכזי ---
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'vehicles' | 'policies'>('info');

  // רשימות מקושרות לקוח
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);

  // סטייט לטפסים
  const [clientForm, setClientForm] = useState({ name: '', nationalId: '', phone: '' });
  const [vehicleForm, setVehicleForm] = useState({ licensePlate: '', make: '', model: '', year: '' });
  const [policyForm, setPolicyForm] = useState({
  policyNumber: '',
  company: 'הפניקס',
  policyType: 'חובה',
  startDate: '',
  endDate: '',
  premium: '',
  vehicleId: '',
  coverageDetails: '' // ◄--- Added to hold input for non-car features
});

  // --- טעינת לקוחות ראשונית ---
  const loadClients = async () => {
    const data = await (window as any).electronAPI.getClients();
    setClients(data);
  };

  useEffect(() => {
    loadClients();
  }, []);

  // --- שליפת נתונים מקושרים בעת בחירת לקוח ---
  const fetchRelationalData = async (clientId: number) => {
    const clientCars = await (window as any).electronAPI.getClientVehicles(clientId);
    const clientPolicies = await (window as any).electronAPI.getClientPolicies(clientId);
    setVehicles(clientCars);
    setPolicies(clientPolicies);
  };

  useEffect(() => {
    if (selectedClient) {
      fetchRelationalData(selectedClient.id);
    }
  }, [selectedClient]);

  // --- פעולות שליחה (Submissions) ---
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name || !clientForm.nationalId) return;

    const res = await (window as any).electronAPI.addClient(clientForm);
    if (res.success) {
      setClientForm({ name: '', nationalId: '', phone: '' });
      loadClients();
    } else {
      alert(`שגיאה בהוספת לקוח: ${res.error || 'תעודת זהות כבר קיימת'}`);
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !vehicleForm.licensePlate) return;

    const payload = { clientId: selectedClient.id, ...vehicleForm };
    const res = await (window as any).electronAPI.addVehicle(payload);
    if (res.success) {
      setVehicleForm({ licensePlate: '', make: '', model: '', year: '' });
      fetchRelationalData(selectedClient.id);
    } else {
      alert(`שגיאה בהוספת רכב: ${res.error}`);
    }
  };

  const handleAddPolicy = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedClient || !policyForm.policyNumber || !policyForm.startDate || !policyForm.endDate) {
    alert('נא למלא את כל שדות החובה לפוליסה (מספר, תאריך התחלה וסיום)');
    return;
  }

  const payload = {
    clientId: selectedClient.id,
    policyNumber: policyForm.policyNumber,
    company: policyForm.company,
    policyType: policyForm.policyType,
    startDate: policyForm.startDate,
    endDate: policyForm.endDate,
    premium: parseFloat(policyForm.premium) || 0,
    // Safely link vehicle only if it's a car policy type
    vehicleId: ['חובה', 'מקיף', 'צד ג'].includes(policyForm.policyType) && policyForm.vehicleId 
      ? parseInt(policyForm.vehicleId) 
      : null,
    coverageDetails: policyForm.coverageDetails // ◄--- Added
  };

  const res = await (window as any).electronAPI.addPolicy 
                ? await (window as any).electronAPI.addPolicy(payload) 
                : { success: true, mock: true };

  if (res.success) {
    setPolicyForm({
      policyNumber: '',
      company: 'הפניקס',
      policyType: 'חובה',
      startDate: '',
      endDate: '',
      premium: '',
      vehicleId: '',
      coverageDetails: '' // ◄--- Reset form field
    });
    fetchRelationalData(selectedClient.id);
  } else {
    alert(`שגיאה בהוספת פוליסה: ${res.error}`);
  }
};

  // --- לוגיקת סינון לקוחות ---
  const filteredClients = clients.filter(c =>
    c.name.includes(searchTerm) || c.nationalId.includes(searchTerm)
  );

  // Helper function to map vehicleId to licensePlate
const getLicensePlateById = (vehicleId: number | null) => {
  if (!vehicleId) return 'ללא שיוך רכב'; // or '-'
  const matchedVehicle = vehicles.find(v => v.id === vehicleId);
  return matchedVehicle ? matchedVehicle.licensePlate : 'רכב לא נמצא';
};

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-6 flex flex-col items-center">
      <header className="w-full max-w-6xl mb-6 text-right">
        <h1 className="text-3xl font-bold text-slate-800">מערכת ניהול סוכנות ביטוח</h1>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* ================= עמודה שמאלית: מדריך לקוחות ================= */}
        <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm flex flex-col gap-4">
          <h2 className="text-xl font-bold border-b pb-2">מדריך לקוחות</h2>
          
          <div className="relative">
            <input
              type="text"
              placeholder="חפש לפי שם או תעודת זהות..."
              className="w-full p-2 border border-gray-300 rounded-lg text-right text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {filteredClients.length === 0 ? (
              <p className="text-gray-400 text-center py-4 text-sm">לא נמצאו לקוחות מתאימים</p>
            ) : (
              filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => { setSelectedClient(client); setActiveTab('info'); }}
                  className={`p-3 rounded-lg border cursor-pointer transition text-right ${
                    selectedClient?.id === client.id
                      ? 'border-blue-500 bg-blue-50/50 font-medium'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-slate-700 text-sm">{client.name}</div>
                  <div className="text-xs text-gray-500">ת"ז: {client.nationalId}</div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddClient} className="border-t pt-4 flex flex-col gap-2">
            <h3 className="text-xs font-bold text-gray-400 mb-1">רישום לקוח מהיר</h3>
            <input
              type="text"
              placeholder="שם מלא"
              className="w-full text-right text-xs p-2 border rounded"
              value={clientForm.name}
              onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="תעודת זהות"
              className="w-full text-right text-xs p-2 border rounded"
              value={clientForm.nationalId}
              onChange={(e) => setClientForm({ ...clientForm, nationalId: e.target.value })}
            />
            <input
              type="text"
              placeholder="טלפון"
              className="w-full text-right text-xs p-2 border rounded"
              value={clientForm.phone}
              onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
            />
            <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-lg text-xs font-semibold mt-1 hover:bg-blue-700">
              הוסף לקוח +
            </button>
          </form>
        </div>

        {/* ================= עמודה ימנית: לוח פעיל אינטראקטיבי ================= */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm min-h-[550px] flex flex-col">
          {!selectedClient ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <svg className="w-16 h-16 mb-2 stroke-current" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-lg">בחר לקוח מהרשימה כדי לצפות בתיק הביטוח</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              {/* כותרת פרופיל */}
              <div className="flex justify-between items-center border-b pb-4 mb-4">
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">מזהה לקוח: #{selectedClient.id}</span>
                <h2 className="text-2xl font-bold text-slate-800 text-right">{selectedClient.name}</h2>
              </div>

              {/* טאבים לניווט */}
              <div className="flex border-b mb-6 justify-end gap-1">
                <button
                  onClick={() => setActiveTab('policies')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                    activeTab === 'policies' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  פוליסות ביטוח
                </button>
                <button
                  onClick={() => setActiveTab('vehicles')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                    activeTab === 'vehicles' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  רכבים מבוטחים
                </button>
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                    activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  כרטיס לקוח
                </button>
              </div>

              {/* תוכן הטאבים */}
              <div className="flex-1 text-right">
                
                {/* טאב 1: פרטי כרטיס לקוח */}
                {activeTab === 'info' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-xs text-gray-400 mb-1">מספר תעודת זהות</span>
                        <span className="text-base font-medium">{selectedClient.nationalId}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-400 mb-1">שם מלא</span>
                        <span className="text-base font-medium">{selectedClient.name}</span>
                      </div>
                      <div className="col-span-2 border-t pt-2 mt-2">
                        <span className="block text-xs text-gray-400 mb-1">מספר טלפון</span>
                        <span className="text-base font-medium">{selectedClient.phone || 'לא הוזן מספר'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* טאב 2: ניהול רכבים */}
                {activeTab === 'vehicles' && (
                  <div className="flex flex-col gap-6">
                    <form onSubmit={handleAddVehicle} className="bg-gray-50 p-4 rounded-xl border grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                      <div className="col-span-2 sm:col-span-4 font-semibold text-xs text-gray-500 mb-1">הוספת רכב חדש:</div>
                      <div>
                        <input
                          type="text"
                          placeholder="שנה"
                          className="w-full text-xs p-2 border rounded"
                          value={vehicleForm.year}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="דגם"
                          className="w-full text-xs p-2 border rounded"
                          value={vehicleForm.model}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="יצרן"
                          className="w-full text-xs p-2 border rounded"
                          value={vehicleForm.make}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="מספר רכב (חובה)"
                          className="w-full text-xs p-2 border border-blue-300 rounded"
                          value={vehicleForm.licensePlate}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, licensePlate: e.target.value })}
                          required
                        />
                      </div>
                      <button type="submit" className="col-span-2 sm:col-span-4 bg-emerald-600 text-white p-2 rounded-lg text-xs font-bold mt-2 hover:bg-emerald-700">
                        שמור רכב במאגר
                      </button>
                    </form>

                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b text-xs font-bold text-slate-600">
                            <th className="p-3">שנה</th>
                            <th className="p-3">דגם</th>
                            <th className="p-3">יצרן</th>
                            <th className="p-3">מספר רכב</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                          {vehicles.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-center p-6 text-gray-400">לא רשומים רכבים עבור לקוח זה</td>
                            </tr>
                          ) : (
                            vehicles.map(car => (
                              <tr key={car.id} className="hover:bg-slate-50/50">
                                <td className="p-3 font-mono">{car.year || '-'}</td>
                                <td className="p-3">{car.model || '-'}</td>
                                <td className="p-3">{car.make || '-'}</td>
                                <td className="p-3 font-semibold text-blue-600 font-mono">{car.licensePlate}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ================= טאב 3: ניהול פוליסות ביטוח עם תאריכים ================= */}
                {activeTab === 'policies' && (
                  <div className="flex flex-col gap-6">
                    {/* טופס הוספת פוליסה */}
                    <form onSubmit={handleAddPolicy} className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-3 gap-3 items-end text-right">
                      <div className="col-span-2 md:col-span-3 font-bold text-xs text-slate-500">הפקת פוליסה חדשה בתיק:</div>
                      
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">שיוך לרכב (אופציונלי)</label>
                        <select 
                          className="w-full text-xs p-2 border rounded bg-white text-right"
                          value={policyForm.vehicleId}
                          onChange={(e) => setPolicyForm({...policyForm, vehicleId: e.target.value})}
                        >
                          <option value="">ללא שיוך רכב</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.make} {v.model} ({v.licensePlate})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">פרמיה (עלות בש"ח)</label>
                        <input
                          type="number"
                          placeholder="₪"
                          className="w-full text-xs p-2 border rounded"
                          value={policyForm.premium}
                          onChange={(e) => setPolicyForm({ ...policyForm, premium: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">מספר פוליסה (חובה)</label>
                        <input
                          type="text"
                          placeholder="לדוגמה: 9845122"
                          className="w-full text-xs p-2 border rounded"
                          value={policyForm.policyNumber}
                          onChange={(e) => setPolicyForm({ ...policyForm, policyNumber: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">תאריך סיום (חובה)</label>
                        <input
                          type="date"
                          className="w-full text-xs p-2 border border-red-200 rounded font-mono"
                          value={policyForm.endDate}
                          onChange={(e) => setPolicyForm({ ...policyForm, endDate: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">תאריך התחלה (חובה)</label>
                        <input
                          type="date"
                          className="w-full text-xs p-2 border border-emerald-200 rounded font-mono"
                          value={policyForm.startDate}
                          onChange={(e) => setPolicyForm({ ...policyForm, startDate: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">חברת ביטוח</label>
                        <select 
                          className="w-full text-xs p-2 border rounded bg-white text-right"
                          value={policyForm.company}
                          onChange={(e) => setPolicyForm({...policyForm, company: e.target.value})}
                        >
                          <option value="הפניקס">הפניקס</option>
                          <option value="מגדל">מגדל</option>
                          <option value="הראל">הראל</option>
                          <option value="כלל">כלל</option>
                          <option value="מנורה">מנורה</option>
                          <option value="איילון">איילון</option>
                        </select>
                      </div>

                      {/* --- Policy Type Selector --- */}
<div className="col-span-2 md:col-span-1">
  <label className="block text-[10px] text-gray-400 mb-1">סוג כיסוי</label>
  <select 
    className="w-full text-xs p-2 border rounded bg-white text-right"
    value={policyForm.policyType}
    onChange={(e) => setPolicyForm({...policyForm, policyType: e.target.value, vehicleId: ''})}
  >
    <optgroup label="רכב">
      <option value="חובה">ביטוח חובה</option>
      <option value="מקיף">ביטוח מקיף</option>
      <option value="צד ג">צד שלישי (ג')</option>
    </optgroup>
    <optgroup label="אחר">
      <option value="בריאות">ביטוח בריאות</option>
      <option value="פנסיה">קרן פנסיה</option>
      <option value="חיים">ביטוח חיים</option>
      <option value="דירה">ביטוח מבנה/תכולה</option>
    </optgroup>
  </select>
</div>

{/* --- Dynamic Vehicle Selector OR Coverage Notes Input --- */}
{['חובה', 'מקיף', 'צד ג'].includes(policyForm.policyType) ? (
  <div>
    <label className="block text-[10px] text-gray-400 mb-1">שיוך לרכב (אופציונלי)</label>
    <select 
      className="w-full text-xs p-2 border rounded bg-white text-right"
      value={policyForm.vehicleId}
      onChange={(e) => setPolicyForm({...policyForm, vehicleId: e.target.value})}
    >
      <option value="">ללא שיוך רכב</option>
      {vehicles.map(v => (
        <option key={v.id} value={v.id}>{v.make} {v.model} ({v.licensePlate})</option>
      ))}
    </select>
  </div>
) : (
  <div>
    <label className="block text-[10px] text-gray-400 mb-1">פירוט כיסוי / הערות</label>
    <input
      type="text"
      placeholder="לדוגמה: כולל תרופות מחוץ לסל"
      className="w-full text-xs p-2 border rounded text-right"
      value={policyForm.coverageDetails}
      onChange={(e) => setPolicyForm({ ...policyForm, coverageDetails: e.target.value })}
    />
  </div>
)}

                      <button type="submit" className="col-span-2 bg-blue-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-blue-700 h-9">
                        הפק פוליסה במערכת
                      </button>
                    </form>

                    {/* טבלת פוליסות אקטיביות לסוכן */}
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b text-[11px] font-bold text-slate-600">
  <th className="p-3">סטטוס תוקף</th>
  <th className="p-3 text-red-600">תאריך סיום</th>
  <th className="p-3 text-emerald-700">תאריך התחלה</th>
  <th className="p-3">פרמיה</th>
  <th className="p-3">פירוט / שיוך רכב</th> {/* ◄--- Merged descriptive header */}
  <th className="p-3">סוג כיסוי</th>
  <th className="p-3">חברה</th>
  <th className="p-3">מספר פוליסה</th>
</tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                          {policies.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="text-center p-6 text-gray-400">אין פוליסות רשומות בתיק לקוח זה</td>
                            </tr>
                          ) : (
                            policies.map(p => {
                              // חישוב פשוט אם הפוליסה פגה או בתוקף
                              const isExpired = new Date(p.endDate) < new Date();
                              return (
     <tr key={p.id} className="hover:bg-slate-50/50">
  <td className="p-3">
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isExpired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
      {isExpired ? 'פג תוקף' : 'בתוקף'}
    </span>
  </td>
  <td className="p-3 font-mono text-gray-600 font-semibold">{p.endDate}</td>
  <td className="p-3 font-mono text-gray-500">{p.startDate}</td>
  <td className="p-3 font-medium">₪{p.premium.toLocaleString()}</td>
  
  {/* 1. This handles either the license plate or your custom coverage details */}
  <td className="p-3 text-gray-600 font-medium">
    {['חובה', 'מקיף', 'צד ג', 'ביטוח חובה', 'ביטוח מקיף', 'צד שלישי (ג\')'].includes(p.policyType) ? (
      <span className="font-mono text-blue-600 font-semibold">{getLicensePlateById(p.vehicleId)}</span>
    ) : (
      <span className="text-gray-500 italic text-xs">{p.coverageDetails || '-'}</span>
    )}
  </td>

  {/* 2. This keeps the policy type column displaying correctly */}
  <td className="p-3">{p.policyType}</td>
  
  <td className="p-3 font-semibold text-slate-700">{p.company}</td>
  <td className="p-3 font-mono text-blue-600 font-medium">{p.policyNumber}</td>
</tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}