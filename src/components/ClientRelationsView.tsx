import React, { useState, useEffect } from 'react';

interface Relation {
  id: number;
  relatedClientId: number;
  relationType: string;
  relatedClientName: string;
  relatedClientPhone: string;
}

interface MinimalClient {
  id: number;
  name: string;
  phone: string;
}

interface ClientRelationsProps {
  clientId: number;
  onNavigateToClient: (id: number) => void; // Parent handler to switch active client tab
}

const RELATION_LABELS: { [key: string]: string } = {
  spouse: 'בן/בת זוג',
  child: 'ילד/ה',
  parent: 'הורה',
  employer: 'מעסיק',
  partner: 'שותף עסקי',
  other: 'אחר',
};

export const ClientRelations: React.FC<ClientRelationsProps> = ({ clientId, onNavigateToClient }) => {
  const [relations, setRelations] = useState<Relation[]>([]);
  const [allClients, setAllClients] = useState<MinimalClient[]>([]);
  const [selectedRelatedId, setSelectedRelatedId] = useState('');
  const [relationType, setRelationType] = useState('spouse');
  const [isLinking, setIsLinking] = useState(false);

  const fetchData = async () => {
    const resRelations = await (window as any).electronAPI.getClientRelations(clientId);
    if (resRelations.success) {
      setRelations(resRelations.relations);
    }

    const resAll = await (window as any).electronAPI.getAllClientsMinimal();
    if (resAll.success) {
      // Exclude current client from matching list
      setAllClients(resAll.clients.filter((c: MinimalClient) => c.id !== clientId));
    }
  };

  useEffect(() => {
    fetchData();
    setIsLinking(false);
    setSelectedRelatedId('');
  }, [clientId]);

  const handleLinkRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRelatedId) return;

    const res = await (window as any).electronAPI.addClientRelation({
      clientId,
      relatedClientId: parseInt(selectedRelatedId),
      relationType,
    });

    if (res.success) {
      setSelectedRelatedId('');
      setIsLinking(false);
      fetchData();
    } else {
      alert(`שגיאה בקישור לקוח: ${res.error}`);
    }
  };

  const handleUnlink = async (relatedId: number) => {
    if (confirm('האם להסיר את הקישור בין הלקוחות?')) {
      const res = await (window as any).electronAPI.deleteClientRelation({
        clientId,
        relatedClientId: relatedId,
      });
      if (res.success) {
        fetchData();
      }
    }
  };

  const availableClients = allClients.filter(
    (client) => !relations.some((r) => r.relatedClientId === client.id)
  );

  return (
    <div className="mt-4 border-t pt-4 text-right" dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500">לקוחות קשורים (משפחה / עסק)</span>
        {!isLinking && (
          <button
            onClick={() => setIsLinking(true)}
            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold"
          >
            + קשר לקוח קיים
          </button>
        )}
      </div>

      {/* Linking Form inline */}
      {isLinking && (
        <form onSubmit={handleLinkRelation} className="bg-slate-50 p-2 rounded-lg border border-slate-200 mb-3 grid grid-cols-3 gap-2 items-end">
          <div>
            <label className="block text-[9px] text-gray-400 mb-1">סוג קשר</label>
            <select
              className="w-full text-[11px] p-1 border rounded bg-white text-right"
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
            >
              {Object.entries(RELATION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] text-gray-400 mb-1">בחר לקוח</label>
            <select
              className="w-full text-[11px] p-1 border rounded bg-white text-right"
              value={selectedRelatedId}
              onChange={(e) => setSelectedRelatedId(e.target.value)}
              required
            >
              <option value="">-- בחר --</option>
              {availableClients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <div className="flex gap-1 justify-end">
            <button
              type="button"
              onClick={() => setIsLinking(false)}
              className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700"
            >
              קשר
            </button>
          </div>
        </form>
      )}

      {/* Relations List */}
      {relations.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">לא נמצאו לקוחות קשורים בתיק זה</p>
      ) : (
        <div className="space-y-1.5">
          {relations.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100/70 border border-slate-100 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                  {RELATION_LABELS[rel.relationType] || rel.relationType}
                </span>
                <button
                  onClick={() => onNavigateToClient(rel.relatedClientId)}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  {rel.relatedClientName} {/* <-- This matches the SELECT alias in the fixed query */}
                </button>
                <span className="text-[10px] text-gray-400 font-mono">({rel.relatedClientPhone})</span>
              </div>
              <button
                onClick={() => handleUnlink(rel.relatedClientId)}
                className="text-[10px] text-rose-500 hover:text-rose-700 hover:font-bold px-1"
                title="נתק קשר"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};