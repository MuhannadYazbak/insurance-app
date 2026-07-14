import React, { useState, useEffect } from 'react';
import { NotesView } from './NotesView';
import { ClaimsView } from './ClaimsView';
import { DocumentsView } from './DocumentsView';

interface Client {
  id: number;
  name: string;
  nationalId: string;
  phone: string;
  email: string;
  address: string;
}

interface Vehicle {
  id: number;
  clientId: number;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  status: 'owned' | 'sold' | 'out of order';
}

interface Policy {
  id: number;
  clientId: number;
  vehicleId: number | null;
  policyNumber: string;
  company: string;
  policyType: string;
  startDate: string;
  endDate: string;
  premium: number;
  coverageDetails?: string;
  status: 'active' | 'frozen' | 'cancelled';
}

interface ClientMainViewProps {
  clients: Client[];
  loadClients: () => Promise<void>;
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
}

export const ClientMainView: React.FC<ClientMainViewProps> = ({
  clients,
  loadClients,
  selectedClient,
  setSelectedClient,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'vehicles' | 'policies' | 'notes' | 'claims' | 'documents'>('info');

  // Relational client lists
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);

  // Form states
  const [clientForm, setClientForm] = useState({ name: '', nationalId: '', phone: '', email: '', address: '' });
  const [vehicleForm, setVehicleForm] = useState({ licensePlate: '', make: '', model: '', year: '' });
  const [policyForm, setPolicyForm] = useState({
    policyNumber: '',
    company: 'הפניקס',
    policyType: 'חובה',
    startDate: '',
    endDate: '',
    premium: '',
    vehicleId: '',
    coverageDetails: '',
  });
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(selectedClient?.phone || '');
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [plateInput, setPlateInput] = useState('');
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editClientForm, setEditClientForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Sync form state when selectedClient changes or edit mode opens
  useEffect(() => {
    if (selectedClient) {
      setEditClientForm({
        name: selectedClient.name || '',
        phone: selectedClient.phone || '',
        email: selectedClient.email || '',
        address: selectedClient.address || ''
      });
    }
    setIsEditingClient(false);
  }, [selectedClient]);

  // Reset edit state when user switches clients
  useEffect(() => {
    setPhoneInput(selectedClient?.phone || '');
    setIsEditingPhone(false);
  }, [selectedClient]);



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

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { [key: string]: string } = {};

    // 1. Name validation
    if (!clientForm.name || clientForm.name.trim().length < 2) {
      errors.name = 'אנא הזן שם מלא';
    }

    // 2. National ID validation
    if (!clientForm.nationalId || !validateIsraeliID(clientForm.nationalId)) {
      errors.nationalId = 'תעודת זהות לא תקינה';
    }

    // 3. Phone validation (only validate if they started typing)
    if (clientForm.phone && clientForm.phone.trim() !== '' && !validatePhone(clientForm.phone)) {
      errors.phone = 'מספר טלפון לא תקין';
    }

    // 4. Email validation (only validate if they started typing)
    if (clientForm.email && clientForm.email.trim() !== '' && !validateEmail(clientForm.email)) {
      errors.email = 'כתובת אימייל לא תקינה';
    }

    // If there are validation errors, update the state and stop execution
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFormErrors({});

    // Proceed with DB insertion
    const res = await (window as any).electronAPI.addClient(clientForm);
    if (res.success) {
      setClientForm({ name: '', nationalId: '', phone: '', email: '', address: '' });
      await loadClients();
    } else {
      alert(`שגיאה בהוספת לקוח: ${res.error || 'תעודת זהות כבר קיימת'}`);
    }
  };

  const handleSaveClientInfo = async () => {
    if (!selectedClient || !editClientForm.name.trim()) return;

    try {
      const res = await (window as any).electronAPI.updateClientInfo(selectedClient.id, editClientForm);

      if (res.success) {
        // Direct mutation of the local object to match your state pattern instantly
        selectedClient.name = editClientForm.name;
        selectedClient.phone = editClientForm.phone;
        selectedClient.email = editClientForm.email;
        selectedClient.address = editClientForm.address;

        setIsEditingClient(false);
      } else {
        alert(`שגיאה בעדכון פרטי הלקוח: ${res.error}`);
      }
    } catch (error) {
      console.error('IPC Error updating client info:', error);
      alert('שגיאה בתקשורת עם בסיס הנתונים');
    }
  };

  const handleSavePhone = async () => {
    if (!selectedClient) return;

    try {
      const response = await (window as any).electronAPI.updateClientPhone(selectedClient.id, phoneInput);

      if (response.success) {
        // Update local state copy so UI refreshes immediately
        selectedClient.phone = phoneInput;
        setIsEditingPhone(false);
      } else {
        alert('שגיאה בעדכון מספר הטלפון: ' + response.error);
      }
    } catch (error) {
      console.error('IPC Error updating phone:', error);
      alert('שגיאה בתקשורת עם בסיס הנתונים');
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient) return;

    // Validate license plate
    if (!vehicleForm.licensePlate || !validateLicensePlate(vehicleForm.licensePlate)) {
      setFormErrors(prev => ({ ...prev, licensePlate: 'מספר רכב לא תקין (חייב להכיל 7 או 8 ספרות)' }));
      return;
    }

    // Clear plate error if valid
    setFormErrors(prev => {
      const copy = { ...prev };
      delete copy.licensePlate;
      return copy;
    });

    const payload = { clientId: selectedClient.id, ...vehicleForm };
    const res = await (window as any).electronAPI.addVehicle(payload);
    if (res.success) {
      setVehicleForm({ licensePlate: '', make: '', model: '', year: '' });
      fetchRelationalData(selectedClient.id);
    } else {
      alert(`שגיאה בהוספת רכב: ${res.error}`);
    }
  };

  // Validates official Israeli ID card checksum (Luhn-like algorithm)
  const validateIsraeliID = (id: string): boolean => {
    const cleanId = id.trim().padStart(9, '0');
    if (cleanId.length !== 9 || isNaN(Number(cleanId))) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let digit = Number(cleanId[i]);
      let step = digit * ((i % 2) + 1);
      if (step > 9) step -= 9;
      sum += step;
    }
    return sum % 10 === 0;
  };

  // Validates Israeli phone numbers (Mobile: 10 digits, Landline: 9 digits)
  const validatePhone = (phone: string): boolean => {
    const cleanPhone = phone.replace(/[- ]/g, '').trim();
    // Checks if it starts with 0 and has either 9 or 10 digits in total
    return /^0\d{8,9}$/.test(cleanPhone);
  };

  // Validates standard email format
  const validateEmail = (email: string): boolean => {
    if (!email || email.trim() === '') return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Validates Israeli license plates (7 or 8 digits)
  const validateLicensePlate = (plate: string): boolean => {
    const cleanPlate = plate.replace(/[- ]/g, '').trim();
    return /^\d{7,8}$/.test(cleanPlate);
  };

  const handleSavePlate = async (vehicleId: number) => {
    if (!plateInput.trim()) return;

    try {
      const res = await (window as any).electronAPI.updateVehiclePlate(vehicleId, plateInput.trim());
      if (res.success) {
        // Update local state directly so UI reflects change instantly without re-fetching
        const updatedVehicles = vehicles.map(v =>
          v.id === vehicleId ? { ...v, licensePlate: plateInput.trim() } : v
        );
        // Assuming you have a setVehicles hook updating the main state array
        setVehicles(updatedVehicles);
        setEditingVehicleId(null);
      } else {
        alert(`שגיאה בעדכון מספר הרכב: ${res.error || 'מספר רכב כבר קיים במערכת'}`);
      }
    } catch (error) {
      console.error('IPC Error updating vehicle plate:', error);
      alert('שגיאה בתקשורת עם בסיס הנתונים');
    }
  };

  const handleAddPolicy = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient) return;

    const errors: { [key: string]: string } = {};

    // 1. Validate Policy Number
    if (!policyForm.policyNumber || policyForm.policyNumber.trim() === '') {
      errors.policyNumber = 'אנא הזן מספר פוליסה';
    }
    // 1. Validate Policy Number
    if (!policyForm.policyNumber || policyForm.policyNumber.trim() === '') {
      errors.policyNumber = 'אנא הזן מספר פוליסה';
    }

    // 1.5 Validate Premium (Must be a positive number if provided)
    if (policyForm.premium !== '') {
      const premiumVal = parseFloat(policyForm.premium);
      if (isNaN(premiumVal) || premiumVal < 0) {
        errors.policyPremium = 'הפרמיה חייבת להיות מספר חיובי בלבד';
      }
    }

    // 2. Setup Current Date (Today at 00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 3. Parse and Validate Start Date
    let start: Date | null = null;
    if (policyForm.startDate) {
      start = new Date(policyForm.startDate);
      if (isNaN(start.getTime())) {
        errors.policyStartDate = 'תאריך התחלה לא תקין';
      } else {
        start.setHours(0, 0, 0, 0);
        // Rule 1: Start date cannot be in the future
        if (start > today) {
          errors.policyStartDate = 'תאריך ההתחלה אינו יכול להיות בעתיד';
        }
      }
    } else {
      errors.policyStartDate = 'תאריך התחלה הוא שדה חובה';
    }

    // 4. Parse and Validate End Date
    let end: Date | null = null;
    if (policyForm.endDate) {
      end = new Date(policyForm.endDate);
      if (isNaN(end.getTime())) {
        errors.policyEndDate = 'תאריך סיום לא תקין';
      } else {
        end.setHours(0, 0, 0, 0);
        // Rule 2: End date must be after start date
        if (start && !isNaN(start.getTime()) && end <= start) {
          errors.policyEndDate = 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה';
        }
      }
    } else {
      errors.policyEndDate = 'תאריך סיום הוא שדה חובה';
    }

    // DEBUG LOGGING: Open your DevTools (Ctrl+Shift+I) to inspect these values if it fails
    console.log("Validation Check:", {
      today: today.toDateString(),
      startDateParsed: start ? start.toDateString() : "null",
      endDateParsed: end ? end.toDateString() : "null",
      errorsDetected: errors
    });

    // 5. Block Submission if Errors Exist
    if (Object.keys(errors).length > 0) {
      setFormErrors(prev => ({ ...prev, ...errors }));
      return; // <--- This strictly halts execution and prevents DB insert
    }

    // 6. Clear only Policy Errors if Valid
    setFormErrors(prev => {
      const copy = { ...prev };
      delete copy.policyNumber;
      delete copy.policyPremium;
      delete copy.policyStartDate;
      delete copy.policyEndDate;
      return copy;
    });

    // 7. Proceed with DB insertion
    const payload = {
      clientId: selectedClient.id,
      policyNumber: policyForm.policyNumber,
      company: policyForm.company,
      policyType: policyForm.policyType,
      startDate: policyForm.startDate,
      endDate: policyForm.endDate,
      premium: parseFloat(policyForm.premium) || 0,
      vehicleId: ['חובה', 'מקיף', 'צד ג'].includes(policyForm.policyType) && policyForm.vehicleId
        ? parseInt(policyForm.vehicleId)
        : null,
      coverageDetails: policyForm.coverageDetails,
    };

    const res = await (window as any).electronAPI.addPolicy(payload);

    if (res.success) {
      setPolicyForm({
        policyNumber: '',
        company: 'הפניקס',
        policyType: 'חובה',
        startDate: '',
        endDate: '',
        premium: '',
        vehicleId: '',
        coverageDetails: '',
      });
      fetchRelationalData(selectedClient.id);
    } else {
      alert(`שגיאה בהוספת פוליסה: ${res.error}`);
    }
  };

  const handleUpdatePolicyStatus = async (policyId: number, currentNumber: string, newStatus: 'active' | 'frozen' | 'cancelled') => {
    const statusLabels = { active: 'להפעיל מחדש', frozen: 'להקפיא', cancelled: 'לבטל' };
    if (!window.confirm(`האם אתה בטוח שברצונך ${statusLabels[newStatus]} את פוליסה מספר ${currentNumber}?`)) return;

    const res = await (window as any).electronAPI.updatePolicyStatus(policyId, newStatus);
    if (res.success) {
      if (selectedClient) fetchRelationalData(selectedClient.id);
    } else {
      alert(`שגיאה בעדכון סטטוס הפוליסה: ${res.error}`);
    }
  };

  const handleSavePolicyEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;

    const updates = {
      vehicleId: editingPolicy.vehicleId ? Number(editingPolicy.vehicleId) : null,
      premium: Number(editingPolicy.premium),
      coverageDetails: editingPolicy.coverageDetails || "",
    };

    const res = await (window as any).electronAPI.updatePolicyDetails(editingPolicy.id, updates);
    if (res.success) {
      if (selectedClient) fetchRelationalData(selectedClient.id);
      setEditingPolicy(null);
    } else {
      alert(`שגיאה בעדכון הפוליסה: ${res.error}`);
    }
  };

  const handleUpdateVehicleStatus = async (vehicleId: number, newStatus: string) => {
    const res = await (window as any).electronAPI.updateVehicleStatus(vehicleId, newStatus);
    if (res.success) {
      if (selectedClient) fetchRelationalData(selectedClient.id);
    } else {
      alert(`שגיאה בעדכון סטטוס הרכב: ${res.error}`);
    }
  };

  const getLicensePlateById = (vehicleId: number | null) => {
    if (!vehicleId) return 'ללא שיוך רכב';
    const matchedVehicle = vehicles.find(v => v.id === vehicleId);
    return matchedVehicle ? matchedVehicle.licensePlate : 'רכב לא נמצא';
  };

  const filteredClients = clients.filter(c =>
    c.name.includes(searchTerm) || c.nationalId.includes(searchTerm) || c.phone.includes(searchTerm) || c.email.includes(searchTerm) || c.address.includes(searchTerm)
  );

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
              placeholder="חפש לפי פרטי לקוח "
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
                  className={`p-3 rounded-lg border cursor-pointer transition text-right ${selectedClient?.id === client.id
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

            {/* Name Input */}
            <div>
              <input
                type="text"
                placeholder="שם מלא"
                className={`w-full text-right text-xs p-2 border rounded ${formErrors.name ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
              />
              {formErrors.name && <p className="text-[10px] text-red-500 text-right mt-0.5">{formErrors.name}</p>}
            </div>

            {/* National ID Input */}
            <div>
              <input
                type="text"
                placeholder="תעודת זהות"
                className={`w-full text-right text-xs p-2 border rounded ${formErrors.nationalId ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                value={clientForm.nationalId}
                onChange={(e) => setClientForm({ ...clientForm, nationalId: e.target.value })}
              />
              {formErrors.nationalId && <p className="text-[10px] text-red-500 text-right mt-0.5">{formErrors.nationalId}</p>}
            </div>

            {/* Phone Input */}
            <div>
              <input
                type="text"
                placeholder="טלפון"
                className={`w-full text-right text-xs p-2 border rounded ${formErrors.phone ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
              />
              {formErrors.phone && <p className="text-[10px] text-red-500 text-right mt-0.5">{formErrors.phone}</p>}
            </div>

            {/* Email Input */}
            <div>
              <input
                type="text"
                placeholder="אימייל"
                className={`w-full text-right text-xs p-2 border rounded ${formErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              />
              {formErrors.email && <p className="text-[10px] text-red-500 text-right mt-0.5">{formErrors.email}</p>}
            </div>

            {/* Address Input */}
            <div>
              <input
                type="text"
                placeholder="כתובת"
                className="w-full text-right text-xs p-2 border rounded border-gray-200"
                value={clientForm.address}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
              />
            </div>

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
              <div className="flex justify-between items-center border-b pb-4 mb-4">
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">מזהה לקוח: #{selectedClient.id}</span>
                <h2 className="text-2xl font-bold text-slate-800 text-right">{selectedClient.name}</h2>
              </div>

              <div className="flex border-b mb-6 justify-end gap-1 flex-nowrap">

                <button
                  onClick={() => setActiveTab('notes')}
                  className={`px-3 py-2 text-xs md:text-sm font-bold border-b-2 transition shrink-0 ${activeTab === 'notes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  תזכורות 📝
                </button>

                <button
                  onClick={() => setActiveTab('claims')}
                  className={`px-3 py-2 text-xs md:text-sm font-bold border-b-2 transition shrink-0 ${activeTab === 'claims' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  תביעות 🚨
                </button>

                <button
                  onClick={() => setActiveTab('policies')}
                  className={`px-3 py-2 text-xs md:text-sm font-bold border-b-2 transition shrink-0 ${activeTab === 'policies' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  פוליסות 📜
                </button>

                <button
                  onClick={() => setActiveTab('vehicles')}
                  className={`px-3 py-2 text-xs md:text-sm font-bold border-b-2 transition shrink-0 ${activeTab === 'vehicles' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  רכבים 🚗
                </button>

                <button
                  onClick={() => setActiveTab('documents')}
                  className={`px-3 py-2 text-xs md:text-sm font-bold border-b-2 transition shrink-0 ${activeTab === 'documents' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  מסמכים 📁
                </button>

                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-3 py-2 text-xs md:text-sm font-bold border-b-2 transition shrink-0 ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  כרטיס לקוח 👤
                </button>

              </div>
              <div className="flex-1 text-right">
                {activeTab === 'info' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 relative">

                      {/* Edit / Actions Header */}
                      <div className="absolute top-4 left-4 flex gap-2">
                        {isEditingClient ? (
                          <>
                            <button
                              onClick={handleSaveClientInfo}
                              className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                            >
                              שמור
                            </button>
                            <button
                              onClick={() => {
                                setEditClientForm({
                                  name: selectedClient.name || '',
                                  phone: selectedClient.phone || '',
                                  email: selectedClient.email || '',
                                  address: selectedClient.address || ''
                                });
                                setIsEditingClient(false);
                              }}
                              className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                            >
                              ביטול
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setIsEditingClient(true)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="ערוך פרטי לקוח"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Form Content / View Grid */}
                      <div className="grid grid-cols-2 gap-4 pt-4 text-right" dir="rtl">
                        <div>
                          <span className="block text-xs text-gray-400 mb-1">מספר תעודת זהות</span>
                          <span className="text-base font-medium">{selectedClient.nationalId}</span>
                        </div>

                        <div>
                          <span className="block text-xs text-gray-400 mb-1">שם מלא</span>
                          {isEditingClient ? (
                            <input
                              type="text"
                              value={editClientForm.name}
                              onChange={(e) => setEditClientForm({ ...editClientForm, name: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-base font-medium">{selectedClient.name}</span>
                          )}
                        </div>

                        <div className="col-span-2 border-t pt-3">
                          <span className="block text-xs text-gray-400 mb-1">מספר טלפון</span>
                          {isEditingClient ? (
                            <input
                              type="text"
                              value={editClientForm.phone}
                              onChange={(e) => setEditClientForm({ ...editClientForm, phone: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
                              dir="ltr"
                            />
                          ) : (
                            <span className="text-base font-medium" dir="ltr">{selectedClient.phone || 'לא הוזן מספר'}</span>
                          )}
                        </div>

                        <div className="col-span-2 border-t pt-3">
                          <span className="block text-xs text-gray-400 mb-1">אימייל</span>
                          {isEditingClient ? (
                            <input
                              type="email"
                              value={editClientForm.email}
                              onChange={(e) => setEditClientForm({ ...editClientForm, email: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-md"
                              dir="ltr"
                            />
                          ) : (
                            <span className="text-base font-medium" dir="ltr">{selectedClient.email || 'לא הוזן אימייל'}</span>
                          )}
                        </div>

                        <div className="col-span-2 border-t pt-3">
                          <span className="block text-xs text-gray-400 mb-1">כתובת מגורים</span>
                          {isEditingClient ? (
                            <input
                              type="text"
                              value={editClientForm.address}
                              onChange={(e) => setEditClientForm({ ...editClientForm, address: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-base font-medium">{selectedClient.address || 'לא הוזנה כתובת'}</span>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
                {activeTab === 'documents' && (
                  <DocumentsView clientId={selectedClient.id} />
                )}

                {/* ◄--- RENDER THE COMPONENT WHEN TAB IS ACTIVE --- */}
                {activeTab === 'claims' && (
                  <ClaimsView clientId={selectedClient.id} vehicles={vehicles} policies={policies} />
                )}
                {activeTab === 'notes' && (
                  <NotesView clientId={selectedClient.id} />
                )}
                {activeTab === 'vehicles' && (
                  <div className="flex flex-col gap-6">

                    <form onSubmit={handleAddVehicle} className="bg-gray-50 p-4 rounded-xl border grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                      <div className="col-span-2 sm:col-span-4 font-semibold text-xs text-gray-500 mb-1 text-right">הוספת רכב חדש:</div>

                      {/* שנה */}
                      <div>
                        <input
                          type="text"
                          placeholder="שנה"
                          className="w-full text-right text-xs p-2 border rounded bg-white border-gray-200"
                          value={vehicleForm.year}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                        />
                      </div>

                      {/* דגם */}
                      <div>
                        <input
                          type="text"
                          placeholder="דגם"
                          className="w-full text-right text-xs p-2 border rounded bg-white border-gray-200"
                          value={vehicleForm.model}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                        />
                      </div>

                      {/* יצרן */}
                      <div>
                        <input
                          type="text"
                          placeholder="יצרן"
                          className="w-full text-right text-xs p-2 border rounded bg-white border-gray-200"
                          value={vehicleForm.make}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                        />
                      </div>

                      {/* מספר רכב (חובה) */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="מספר רכב (חובה)"
                          className={`w-full text-right text-xs p-2 border rounded bg-white transition-colors ${formErrors.licensePlate
                            ? 'border-red-500 bg-red-50/50 focus:outline-none'
                            : 'border-blue-300'
                            }`}
                          value={vehicleForm.licensePlate}
                          onChange={(e) => {
                            setVehicleForm({ ...vehicleForm, licensePlate: e.target.value });
                            // Clear the plate error as soon as they start typing again
                            if (formErrors.licensePlate) {
                              setFormErrors(prev => {
                                const copy = { ...prev };
                                delete copy.licensePlate;
                                return copy;
                              });
                            }
                          }}
                          required
                        />
                        {formErrors.licensePlate && (
                          <span className="absolute -bottom-4 right-0 text-[9px] text-red-500 text-right whitespace-nowrap">
                            {formErrors.licensePlate}
                          </span>
                        )}
                      </div>

                      <button type="submit" className="col-span-2 sm:col-span-4 bg-emerald-600 text-white p-2 rounded-lg text-xs font-bold mt-2 hover:bg-emerald-700">
                        שמור רכב במאגר
                      </button>
                    </form>

                    <div className="space-y-2">
                      {vehicles.length === 0 ? (
                        <div className="text-center p-6 text-gray-400 border rounded-xl bg-white">לא רשומים רכבים עבור לקוח זה</div>
                      ) : (
                        vehicles.map((v) => {
                          let statusColor = "text-emerald-600 bg-emerald-50 border-emerald-200";
                          if (v.status === 'sold') statusColor = "text-gray-500 bg-gray-100 border-gray-200 opacity-60";
                          if (v.status === 'out of order') statusColor = "text-amber-600 bg-amber-50 border-amber-200";

                          const isEditingThisVehicle = editingVehicleId === v.id;

                          return (
                            <div
                              key={v.id}
                              className={`p-3 border rounded-xl flex items-center justify-between gap-4 transition-all ${v.status === 'sold' ? 'bg-slate-50/50 border-dashed' : 'bg-white shadow-sm'
                                }`}
                              dir="rtl"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="bg-slate-100 p-2 rounded-lg text-slate-600 self-start mt-0.5">🚗</div>
                                <div className="flex-1 min-w-0">
                                  <h4 className={`text-xs font-bold ${v.status === 'sold' ? 'text-gray-400 line-through' : 'text-slate-700'}`}>
                                    {v.make} {v.model} ({v.year})
                                  </h4>

                                  {isEditingThisVehicle ? (
                                    <div className="flex items-center gap-2 mt-1">
                                      <input
                                        type="text"
                                        value={plateInput}
                                        onChange={(e) => setPlateInput(e.target.value)}
                                        className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] font-mono font-semibold text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32 tracking-wider"
                                        dir="ltr"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSavePlate(v.id)}
                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                        title="שמור"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => setEditingVehicleId(null)}
                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                        title="ביטול"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 mt-0.5 group max-w-[160px]">
                                      <span className="font-mono text-[11px] font-semibold text-blue-600 tracking-wider" dir="ltr">
                                        {v.licensePlate}
                                      </span>
                                      {v.status !== 'sold' && (
                                        <button
                                          onClick={() => {
                                            setPlateInput(v.licensePlate);
                                            setEditingVehicleId(v.id);
                                          }}
                                          className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                          title="ערוך מספר רכב"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <label className="text-[10px] font-bold text-slate-400">סטטוס:</label>
                                <select
                                  value={v.status || "owned"}
                                  onChange={(e) => handleUpdateVehicleStatus(v.id, e.target.value)}
                                  className={`text-[11px] font-semibold p-1 px-2 rounded-md border cursor-pointer focus:outline-none transition-colors ${statusColor}`}
                                >
                                  <option value="owned" className="text-emerald-700 font-medium bg-white">בבעלות (פעיל)</option>
                                  <option value="sold" className="text-gray-600 font-medium bg-white">נמכר</option>
                                  <option value="out of order" className="text-amber-700 font-medium bg-white">השבתה / לא בשימוש</option>
                                </select>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'policies' && (
                  <div className="flex flex-col gap-6">
                    <form onSubmit={handleAddPolicy} className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-3 gap-3 items-end text-right">
                      <div className="col-span-2 md:col-span-3 font-bold text-xs text-slate-500">הפקת פוליסה חדשה בתיק:</div>

                      {/* פרמיה */}
                      <div className="relative">
                        <label className="block text-[10px] text-gray-400 mb-1">פרמיה (עלות בש"ח)</label>
                        <input
                          type="number"
                          placeholder="₪"
                          className={`w-full text-xs p-2 border rounded ${formErrors.policyPremium ? 'border-red-500 bg-red-50/50' : 'border-gray-200'
                            }`}
                          value={policyForm.premium}
                          onChange={(e) => {
                            setPolicyForm({ ...policyForm, premium: e.target.value });
                            if (formErrors.policyPremium) {
                              setFormErrors(prev => { const c = { ...prev }; delete c.policyPremium; return c; });
                            }
                          }}
                        />
                        {formErrors.policyPremium && (
                          <span className="absolute -bottom-4 right-0 text-[9px] text-red-500 whitespace-nowrap">{formErrors.policyPremium}</span>
                        )}
                      </div>

                      {/* מספר פוליסה */}
                      <div className="relative">
                        <label className="block text-[10px] text-gray-400 mb-1">מספר פוליסה (חובה)</label>
                        <input
                          type="text"
                          placeholder="לדוגמה: 9845122"
                          className={`w-full text-xs p-2 border rounded ${formErrors.policyNumber ? 'border-red-500 bg-red-50/50' : 'border-gray-200'}`}
                          value={policyForm.policyNumber}
                          onChange={(e) => {
                            setPolicyForm({ ...policyForm, policyNumber: e.target.value });
                            if (formErrors.policyNumber) {
                              setFormErrors(prev => { const c = { ...prev }; delete c.policyNumber; return c; });
                            }
                          }}
                          required
                        />
                        {formErrors.policyNumber && (
                          <span className="absolute -bottom-4 right-0 text-[9px] text-red-500 whitespace-nowrap">{formErrors.policyNumber}</span>
                        )}
                      </div>

                      {/* תאריך סיום */}
                      <div className="relative">
                        <label className="block text-[10px] text-gray-400 mb-1">תאריך סיום (חובה)</label>
                        <input
                          type="date"
                          className={`w-full text-xs p-2 border rounded font-mono ${formErrors.policyEndDate ? 'border-red-500 bg-red-50/50' : 'border-red-200'
                            }`}
                          value={policyForm.endDate}
                          onChange={(e) => {
                            setPolicyForm({ ...policyForm, endDate: e.target.value });
                            if (formErrors.policyEndDate) {
                              setFormErrors(prev => { const c = { ...prev }; delete c.policyEndDate; return c; });
                            }
                          }}
                          required
                        />
                        {formErrors.policyEndDate && (
                          <span className="absolute -bottom-4 right-0 text-[9px] text-red-500 whitespace-nowrap">{formErrors.policyEndDate}</span>
                        )}
                      </div>

                      {/* תאריך התחלה */}
                      <div className="relative">
                        <label className="block text-[10px] text-gray-400 mb-1">תאריך התחלה (חובה)</label>
                        <input
                          type="date"
                          className={`w-full text-xs p-2 border rounded font-mono ${formErrors.policyStartDate ? 'border-red-500 bg-red-50/50' : 'border-emerald-200'
                            }`}
                          value={policyForm.startDate}
                          onChange={(e) => {
                            setPolicyForm({ ...policyForm, startDate: e.target.value });
                            if (formErrors.policyStartDate) {
                              setFormErrors(prev => { const c = { ...prev }; delete c.policyStartDate; return c; });
                            }
                          }}
                          required
                        />
                        {formErrors.policyStartDate && (
                          <span className="absolute -bottom-4 right-0 text-[9px] text-red-500 whitespace-nowrap">{formErrors.policyStartDate}</span>
                        )}
                      </div>

                      {/* חברת ביטוח */}
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">חברת ביטוח</label>
                        <select
                          className="w-full text-xs p-2 border rounded bg-white text-right border-gray-200"
                          value={policyForm.company}
                          onChange={(e) => setPolicyForm({ ...policyForm, company: e.target.value })}
                        >
                          <option value="הפניקס">הפניקס</option>
                          <option value="מגדל">מגדל</option>
                          <option value="הראל">הראל</option>
                          <option value="כלל">כלל</option>
                          <option value="מנורה">מנורה</option>
                          <option value="איילון">איילון</option>
                        </select>
                      </div>

                      {/* סוג כיסוי */}
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] text-gray-400 mb-1">סוג כיסוי</label>
                        <select
                          className="w-full text-xs p-2 border rounded bg-white text-right border-gray-200"
                          value={policyForm.policyType}
                          onChange={(e) => setPolicyForm({ ...policyForm, policyType: e.target.value, vehicleId: '' })}
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

                      {/* שיוך לרכב / פירוט כיסוי */}
                      {['חובה', 'מקיף', 'צד ג'].includes(policyForm.policyType) ? (
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">שיוך לרכב (אופציונלי)</label>
                          <select
                            className="w-full text-xs p-2 border rounded bg-white text-right border-gray-200"
                            value={policyForm.vehicleId}
                            onChange={(e) => setPolicyForm({ ...policyForm, vehicleId: e.target.value })}
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
                            className="w-full text-xs p-2 border rounded text-right border-gray-200"
                            value={policyForm.coverageDetails}
                            onChange={(e) => setPolicyForm({ ...policyForm, coverageDetails: e.target.value })}
                          />
                        </div>
                      )}

                      <button type="submit" className="col-span-2 bg-blue-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-blue-700 h-9">
                        הפק פוליסה במערכת
                      </button>
                    </form>

                    <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b text-[11px] font-bold text-slate-600">
                            <th className="p-3 text-center">פעולות</th>
                            <th className="p-3">סטטוס תוקף</th>
                            <th className="p-3 text-red-600">תאריך סיום</th>
                            <th className="p-3 text-emerald-700">תאריך התחלה</th>
                            <th className="p-3">פרמיה</th>
                            <th className="p-3">פירוט / שיוך רכב</th>
                            <th className="p-3">סוג כיסוי</th>
                            <th className="p-3">חברה</th>
                            <th className="p-3">מספר פוליסה</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                          {policies.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="text-center p-6 text-gray-400">אין פוליסות רשומות בתיק לקוח זה</td>
                            </tr>
                          ) : (
                            policies.map(p => {
                              const isExpired = new Date(p.endDate) < new Date();
                              let statusBadgeBg = 'bg-emerald-100 text-emerald-700';
                              let statusLabel = 'בתוקף';

                              if (p.status === 'cancelled') {
                                statusBadgeBg = 'bg-rose-100 text-rose-700 line-through';
                                statusLabel = 'מבוטלת';
                              } else if (p.status === 'frozen') {
                                statusBadgeBg = 'bg-amber-100 text-amber-700';
                                statusLabel = 'מוקפאת';
                              } else if (isExpired) {
                                statusBadgeBg = 'bg-red-100 text-red-700';
                                statusLabel = 'פג תוקף';
                              }

                              return (
                                <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${p.status === 'cancelled' ? 'opacity-60' : ''}`}>
                                  <td className="p-3 text-center flex items-center justify-center gap-1.5">
                                    {p.status !== 'cancelled' && (
                                      <button
                                        onClick={() => handleUpdatePolicyStatus(p.id, p.policyNumber, 'cancelled')}
                                        className="px-2 py-1 text-[10px] font-medium rounded text-red-600 hover:bg-red-50 border border-red-200 transition"
                                      >
                                        ביטול
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setEditingPolicy(p)}
                                      className="px-2 py-1 text-[10px] font-medium rounded text-blue-600 hover:bg-blue-50 border border-blue-200 transition"
                                    >
                                      עריכה
                                    </button>
                                    {p.status === 'frozen' ? (
                                      <button
                                        onClick={() => handleUpdatePolicyStatus(p.id, p.policyNumber, 'active')}
                                        className="px-2 py-1 text-[10px] font-medium rounded text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition"
                                      >
                                        הפשרה
                                      </button>
                                    ) : (
                                      p.status !== 'cancelled' && (
                                        <button
                                          onClick={() => handleUpdatePolicyStatus(p.id, p.policyNumber, 'frozen')}
                                          className="px-2 py-1 text-[10px] font-medium rounded text-amber-600 hover:bg-amber-50 border border-amber-200 transition"
                                        >
                                          הקפאה
                                        </button>
                                      )
                                    )}
                                  </td>

                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusBadgeBg}`}>
                                      {statusLabel}
                                    </span>
                                  </td>

                                  <td className="p-3 font-mono text-gray-600 font-semibold">{p.endDate}</td>
                                  <td className="p-3 font-mono text-gray-500">{p.startDate}</td>
                                  <td className="p-3 font-medium">₪{p.premium.toLocaleString()}</td>

                                  <td className="p-3 text-gray-600 font-medium">
                                    {['חובה', 'מקיף', 'צד ג', 'ביטוח חובה', 'ביטוח מקיף', 'צד שלישי (ג\')'].includes(p.policyType) ? (
                                      <span className="font-mono text-blue-600 font-semibold">{getLicensePlateById(p.vehicleId)}</span>
                                    ) : (
                                      <span className="text-gray-500 italic text-xs">{p.coverageDetails || '-'}</span>
                                    )}
                                  </td>
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

          {/* --- POLICY EDIT MODAL OVERLAY --- */}
          {editingPolicy && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden text-right" dir="rtl">
                <div className="bg-slate-100 p-4 border-b flex justify-between items-center flex-row-reverse">
                  <h3 className="font-bold text-slate-700 text-sm">עדכון פרטי פוליסה: {editingPolicy.policyNumber}</h3>
                  <button onClick={() => setEditingPolicy(null)} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
                </div>

                <form onSubmit={handleSavePolicyEdit} className="p-4 space-y-4">
                  {['חובה', 'מקיף', 'צד ג', 'ביטוח חובה', 'ביטוח מקיף', 'צד שלישי (ג\')'].includes(editingPolicy.policyType) ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">שיוך לרכב</label>
                      <select
                        className="w-full text-xs p-2 border rounded bg-white"
                        value={editingPolicy.vehicleId || ""}
                        onChange={(e) => setEditingPolicy({ ...editingPolicy, vehicleId: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">ללא שיוך רכב</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.make} {v.model} ({v.licensePlate}) {v.status === 'sold' ? '[נמכר]' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">פירוט כיסוי / הערות</label>
                      <input
                        type="text"
                        className="w-full text-xs p-2 border rounded"
                        value={editingPolicy.coverageDetails || ""}
                        onChange={(e) => setEditingPolicy({ ...editingPolicy, coverageDetails: e.target.value })}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">פרמיה (₪)</label>
                    <input
                      type="number"
                      className="w-full text-xs p-2 border rounded font-mono"
                      value={editingPolicy.premium}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, premium: Number(e.target.value) })}
                      required
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={() => setEditingPolicy(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition">ביטול</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition">שמור שינויים</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};