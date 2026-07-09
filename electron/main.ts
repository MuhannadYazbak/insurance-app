// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Environment & Path Configurations ---
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// If packaged, dist-electron/main.js is running inside resources/app.asar/dist-electron/
// index.html is sitting right next door in resources/app.asar/dist/
const DIST_PATH = app.isPackaged 
  ? path.join(app.getAppPath(), 'dist') 
  : path.join(__dirname, '../dist');

// --- SQLite Database Safe Initialization ---
const dbPath = app.isPackaged 
  ? path.join(app.getPath('userData'), 'agency.db') 
  : path.join(process.cwd(), 'agency.db');

const db = new Database(dbPath);

// Ensure database tables exist with relational constraints
// Update this specific block inside electron/main.ts
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nationalId TEXT UNIQUE NOT NULL,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId INTEGER NOT NULL,
    licensePlate TEXT UNIQUE NOT NULL,
    make TEXT,
    model TEXT,
    year TEXT,
    FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT DEFAULT 'active',
    clientId INTEGER NOT NULL,
    vehicleId INTEGER,
    policyNumber TEXT UNIQUE NOT NULL,
    company TEXT,
    policyType TEXT,
    startDate TEXT,
    endDate TEXT,
    premium REAL,
    coverageDetails TEXT, -- ◄--- ADD THIS LINE HERE
    FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY(vehicleId) REFERENCES vehicles(id) ON DELETE SET NULL
  );
`);

try {
  const tableInfo = db.prepare("PRAGMA table_info(vehicles)").all();
  const hasStatus = tableInfo.some((col: any) => col.name === 'status');
  if (!hasStatus) {
    db.exec("ALTER TABLE vehicles ADD COLUMN status TEXT DEFAULT 'owned';");
    console.log("Migrated: Added status column to vehicles.");
  }
} catch (err) {
  console.error("Vehicle migration failed:", err);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep DevTools open in production so we can spot any unhandled errors
  //win.webContents.openDevTools();

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // Load the file using the clean, unified static build directory path
    win.loadFile(path.join(DIST_PATH, 'index.html'));
  }
}

// --- IPC Handlers connected to SQLite queries ---

ipcMain.handle('get-clients', async () => {
  try {
    const stmt = db.prepare('SELECT * FROM clients ORDER BY id DESC');
    return stmt.all();
  } catch (err) {
    console.error('Failed to fetch clients:', err);
    return [];
  }
});

ipcMain.handle('add-client', async (event, { name, nationalId, phone }) => {
  try {
    const stmt = db.prepare('INSERT INTO clients (name, nationalId, phone) VALUES (?, ?, ?)');
    stmt.run(name, nationalId, phone);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to add client:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-client-vehicles', async (event, clientId) => {
  try {
    const stmt = db.prepare('SELECT * FROM vehicles WHERE clientId = ?');
    return stmt.all(clientId);
  } catch (err) {
    console.error('Failed to fetch vehicles:', err);
    return [];
  }
});

ipcMain.handle('add-vehicle', async (event, { clientId, licensePlate, make, model, year }) => {
  try {
    const stmt = db.prepare('INSERT INTO vehicles (clientId, licensePlate, make, model, year) VALUES (?, ?, ?, ?, ?)');
    stmt.run(clientId, licensePlate, make, model, year);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-client-policies', async (event, clientId) => {
  try {
    const stmt = db.prepare('SELECT * FROM policies WHERE clientId = ?');
    return stmt.all(clientId);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('add-policy', async (event, { clientId, vehicleId, policyNumber, company, policyType, startDate, endDate, premium, coverageDetails }) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO policies (clientId, vehicleId, policyNumber, company, policyType, startDate, endDate, premium, coverageDetails) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Pass coverageDetails as the last argument matching the SQL placeholder
    stmt.run(clientId, vehicleId, policyNumber, company, policyType, startDate, endDate, premium, coverageDetails);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to add policy:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-policy-status', async (event, policyId, newStatus) => {
  try {
    const stmt = db.prepare('UPDATE policies SET status = ? WHERE id = ?');
    stmt.run(newStatus, policyId);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to update policy status:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-vehicle-status', async (event, vehicleId, newStatus) => {
  try {
    db.prepare('UPDATE vehicles SET status = ? WHERE id = ?').run(newStatus, vehicleId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-policy-details', async (event, policyId, updates) => {
  const { vehicleId, premium, coverageDetails } = updates;
  try {
    db.prepare(`
      UPDATE policies 
      SET vehicleId = ?, premium = ?, coverageDetails = ? 
      WHERE id = ?
    `).run(vehicleId, premium, coverageDetails, policyId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('global-search', async (event, searchTerm) => {
  try {
    console.log("🔍 Global search triggered for string:", searchTerm);
    const formattedSearch = `%${searchTerm}%`;
    
    // Grouping strictly by c.id collapses duplicates so every client appears EXACTLY once!
    const results = db.prepare(`
      SELECT 
        c.id as clientId,
        c.name as clientName,
        GROUP_CONCAT(DISTINCT p.policyNumber) as allPolicies,
        GROUP_CONCAT(DISTINCT p.company) as allCompanies,
        GROUP_CONCAT(DISTINCT v.make || ' ' || v.model) as allVehicles
      FROM clients c
      LEFT JOIN policies p ON c.id = p.clientId
      LEFT JOIN vehicles v ON c.id = v.clientId
      WHERE 
        c.name LIKE ? OR 
        c.nationalId LIKE ? OR 
        c.phone LIKE ? OR
        p.policyNumber LIKE ? OR 
        p.company LIKE ? OR 
        v.licensePlate LIKE ? OR 
        v.make LIKE ? OR 
        v.model LIKE ?
      GROUP BY c.id -- ◄--- This squashes everything down to one row per person
      LIMIT 30
    `).all(
      formattedSearch, formattedSearch, formattedSearch,
      formattedSearch, formattedSearch, formattedSearch, 
      formattedSearch, formattedSearch
    );

    console.log(`✅ Cleaned duplicates down to ${results.length} unique client rows.`);
    return { success: true, results };
  } catch (err: any) {
    console.error("❌ Search query crashed:", err.message);
    return { success: false, error: err.message, results: [] };
  }
});

ipcMain.handle('get-dashboard-data', async () => {
  try {
    // 1. Get policies expiring in the next 30 days, joining with clients for context
    const expiringPolicies = db.prepare(`
      SELECT 
        p.id as policyId,
        p.policyNumber,
        p.policyType,
        p.company,
        p.endDate,
        p.premium,
        c.name as clientName,
        c.id as clientId
      FROM policies p
      JOIN clients c ON p.clientId = c.id
      WHERE p.status = 'active'
        AND p.endDate >= DATE('now')
        AND p.endDate <= DATE('now', '+30 days')
      ORDER BY p.endDate ASC
    `).all();

    // 2. Calculate simple business stats for his dashboard
const stats = db.prepare(`
  SELECT 
    COUNT(id) as activeCount,
    SUM(premium) as totalPremium
  FROM policies 
  WHERE status = 'active'
`).get() as any; // ◄--- ADD "as any" RIGHT HERE

    return { 
      success: true, 
      expiringPolicies, 
      stats: {
        activeCount: stats.activeCount || 0,
        totalPremium: stats.totalPremium || 0
      }
    };
  } catch (err: any) {
    console.error("❌ Dashboard query failed:", err.message);
    return { success: false, error: err.message };
  }
});

// --- Lifecycle Handlers ---

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});