const { contextBridge, ipcRenderer } = require('electron');

// electron/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  getClients: () => ipcRenderer.invoke('get-clients'),
  addClient: (client: any) => ipcRenderer.invoke('add-client', client),
  getClientVehicles: (clientId: number) => ipcRenderer.invoke('get-client-vehicles', clientId),
  addVehicle: (vehicle: any) => ipcRenderer.invoke('add-vehicle', vehicle),
  getClientPolicies: (clientId: number) => ipcRenderer.invoke('get-client-policies', clientId),
  addPolicy: (policy: any) => ipcRenderer.invoke('add-policy', policy),
  // Explicitly type the parameters as number and string/union type
  updatePolicyStatus: (policyId: number, newStatus: 'active' | 'frozen' | 'cancelled') => 
  ipcRenderer.invoke('update-policy-status', policyId, newStatus),
  updateVehicleStatus: (vehicleId: number, newStatus: string) => ipcRenderer.invoke('update-vehicle-status', vehicleId, newStatus),
  updatePolicyDetails: (policyId: number, updates: any) => ipcRenderer.invoke('update-policy-details', policyId, updates),
  globalSearch: (searchTerm: string) => ipcRenderer.invoke('global-search', searchTerm),
  getDashboardData: () => ipcRenderer.invoke('get-dashboard-data'),
  getClientNotes: (clientId: number) => ipcRenderer.invoke('get-client-notes', clientId),
addClientNote: (payload: { clientId: number, text: string, status: string }) => ipcRenderer.invoke('add-client-note', payload),
updateNoteStatus: (noteId: number, status: string) => ipcRenderer.invoke('update-note-status', { noteId, status }),
getAllNotes: () => ipcRenderer.invoke('get-all-notes'),
getClientClaims: (clientId: number) => ipcRenderer.invoke('get-client-claims', clientId),
addClientClaim: (payload: any) => ipcRenderer.invoke('add-client-claim', payload),
updateClaimStatus: (claimId: number, status: string) => ipcRenderer.invoke('update-claim-status', { claimId, status }),
getClientDocuments: (clientId: number) => ipcRenderer.invoke('get-client-documents', clientId),
uploadClientDocument: (payload: { clientId: number; sourcePath: string; originalName: string }) => ipcRenderer.invoke('upload-client-document', payload),
openNativeDocument: (filePath: string) => ipcRenderer.invoke('open-native-document', filePath),
deleteClientDocument: (payload: { documentId: number; filePath: string }) => ipcRenderer.invoke('delete-client-document', payload),
});