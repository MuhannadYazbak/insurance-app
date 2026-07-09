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
});