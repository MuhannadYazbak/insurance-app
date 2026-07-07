interface Window {
  electronAPI: {
    getClients: () => Promise<any[]>;
    addClient: (client: any) => Promise<{ success: boolean }>;
  };
}