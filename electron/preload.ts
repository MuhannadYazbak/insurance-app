const { contextBridge, ipcRenderer } = require('electron');

// electron/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  getClients: () => ipcRenderer.invoke('get-clients'),
  addClient: (client: any) => ipcRenderer.invoke('add-client', client),
  getClientVehicles: (clientId: number) => ipcRenderer.invoke('get-client-vehicles', clientId),
  addVehicle: (vehicle: any) => ipcRenderer.invoke('add-vehicle', vehicle),
  getClientPolicies: (clientId: number) => ipcRenderer.invoke('get-client-policies', clientId),
  addPolicy: (policy: any) => ipcRenderer.invoke('add-policy', policy), // שורה חדשה
});