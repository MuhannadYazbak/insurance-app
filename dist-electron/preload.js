const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  getClients: () => ipcRenderer.invoke("get-clients"),
  addClient: (client) => ipcRenderer.invoke("add-client", client),
  getClientVehicles: (clientId) => ipcRenderer.invoke("get-client-vehicles", clientId),
  addVehicle: (vehicle) => ipcRenderer.invoke("add-vehicle", vehicle),
  getClientPolicies: (clientId) => ipcRenderer.invoke("get-client-policies", clientId),
  addPolicy: (policy) => ipcRenderer.invoke("add-policy", policy)
  // שורה חדשה
});
