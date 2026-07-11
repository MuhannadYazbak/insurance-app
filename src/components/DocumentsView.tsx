import React, { useState, useEffect } from 'react';

interface DocumentRecord {
  id: number;
  clientId: number;
  fileName: string;
  filePath: string;
  createdAt: string;
}

interface DocumentsViewProps {
  clientId: number;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ clientId }) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = async () => {
    const res = await (window as any).electronAPI.getClientDocuments(clientId);
    if (res.success) {
      setDocuments(res.documents);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [clientId]);

  // Handle manual browse selection file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    processFiles(e.target.files);
  };

  // Shared processing layer for handling file buffers
  const processFiles = async (fileList: FileList) => {
    setLoading(true);
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      
      // Extract underlying metadata path exposed natively by Electron on standard File items
      const nativePath = (file as any).path;
      
      if (!nativePath) {
        alert('שגיאה: לא ניתן לקרוא את נתיב הקובץ המקומי במערכת זו.');
        continue;
      }

      await (window as any).electronAPI.uploadClientDocument({
        clientId,
        sourcePath: nativePath,
        originalName: file.name
      });
    }
    setLoading(false);
    fetchDocuments();
  };

  // Drag and Drop listeners
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleOpenDocument = async (path: string) => {
    const res = await (window as any).electronAPI.openNativeDocument(path);
    if (!res.success) {
      alert(`שגיאה בפתיחת הקובץ: ${res.error}`);
    }
  };

  const handleDeleteDocument = async (e: React.MouseEvent, docId: number, filePath: string, fileName: string) => {
  e.stopPropagation(); // Prevents the row click from opening the document
  
  if (!window.confirm(`האם אתה בטוח שברצונך למחוק לצמיתות את המסמך "${fileName}"?`)) return;

  const res = await (window as any).electronAPI.deleteClientDocument({ documentId: docId, filePath });
  if (res.success) {
    fetchDocuments();
  } else {
    alert(`שגיאה במחיקת המסמך: ${res.error}`);
  }
};

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Dynamic Drop Zone Container Input */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
          isDragging 
            ? 'border-blue-500 bg-blue-50 text-blue-700' 
            : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70 text-slate-500'
        }`}
      >
        <span className="text-3xl mb-2">📁</span>
        <p className="text-xs font-bold text-slate-700 mb-1">
          גרור ושחרר מסמכים כאן להעלאה מהירה
        </p>
        <p className="text-[11px] text-gray-400 mb-3">
          תומך בקבצי PDF, תמונות, אישורים ורישיונות (העתקה מקומית מאובטחת)
        </p>
        
        <label className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer">
          {loading ? 'מעתיק קבצים...' : 'בחר קובץ מהמחשב 🔍'}
          <input
            type="file"
            className="hidden"
            multiple
            onChange={handleFileChange}
            disabled={loading}
          />
        </label>
      </div>

      {/* Embedded Client Document Repository Feed */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-4 py-2.5 border-b flex justify-between items-center flex-row-reverse">
          <span className="text-[11px] font-bold text-slate-500">ארכיון מסמכים סרוקים ({documents.length})</span>
          <span className="text-[10px] text-gray-400">לחץ על מסמך לצפייה ישירה</span>
        </div>

        <div className="divide-y max-h-80 overflow-y-auto">
          {documents.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs italic">
              טרם הועלו מסמכים לתיק לקוח זה.
            </div>
          ) : (
            documents.map((doc) => (
  <div
    key={doc.id}
    onClick={() => handleOpenDocument(doc.filePath)}
    className="p-3 hover:bg-slate-50 flex justify-between items-center transition-colors cursor-pointer group"
  >
    {/* Left Side: Timestamp meta log & Action Delete Button */}
    <div className="flex items-center gap-3">
      <button
        onClick={(e) => handleDeleteDocument(e, doc.id, doc.filePath, doc.fileName)}
        className="opacity-0 group-hover:opacity-100 p-1 px-2 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded-md border border-transparent hover:border-red-200 transition-all"
        title="מחק מסמך"
      >
        מחיקה 🗑️
      </button>
      <div className="text-[10px] text-gray-400 font-mono">
        {doc.createdAt}
      </div>
    </div>

    {/* Right Side: File Signature and Title */}
    <div className="flex items-center gap-2 text-right">
      <div className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
        {doc.fileName}
      </div>
      <span className="text-slate-400 text-sm group-hover:scale-110 transition-transform">
        📄
      </span>
    </div>
  </div>
))
          )}
        </div>
      </div>
    </div>
  );
};