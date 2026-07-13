// electron/main.ts
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
//import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { BackupService } from './backupService';

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
    phone TEXT,
    email TEXT,    -- ◄--- ADD THIS
    address TEXT

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
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId INTEGER NOT NULL,
    text TEXT NOT NULL,
    status TEXT CHECK(status IN ('todo', 'done', 'try-again')) DEFAULT 'todo',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId INTEGER NOT NULL,
    vehicleId INTEGER,
    policyNumber TEXT,
    incidentDate TEXT NOT NULL,
    description TEXT NOT NULL,
    estimatedPayout REAL DEFAULT 0,
    status TEXT CHECK(status IN ('open', 'under-review', 'settled', 'rejected')) DEFAULT 'open',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId INTEGER NOT NULL,
    fileName TEXT NOT NULL,
    filePath TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE
  );
`);

const backupService = new BackupService(app.getPath('userData'));

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

// Update this handler to accept and insert email and address
ipcMain.handle('add-client', async (event, { name, nationalId, phone, email, address }) => {
  try {
    // Make sure to pass all 5 values into the statement
    db.prepare(`
      INSERT INTO clients (name, nationalId, phone, email, address) 
      VALUES (?, ?, ?, ?, ?)
    `).run(name, nationalId, phone || null, email || null, address || null);
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Update unified client information
ipcMain.handle('update-client-info', async (event, { clientId, name, phone, email, address }) => {
  try {
    db.prepare(`
      UPDATE clients 
      SET name = ?, phone = ?, email = ?, address = ? 
      WHERE id = ?
    `).run(name, phone, email, address, clientId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Update a client's phone number
ipcMain.handle('update-client-phone', async (event, { clientId, phone }) => {
  try {
    db.prepare(`UPDATE clients SET phone = ? WHERE id = ?`).run(phone, clientId);
    return { success: true };
  } catch (err: any) {
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

// Update a vehicle's license plate number
ipcMain.handle('update-vehicle-plate', async (event, { vehicleId, licensePlate }) => {
  try {
    db.prepare(`UPDATE vehicles SET licensePlate = ? WHERE id = ?`).run(licensePlate, vehicleId);
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
        c.email LIKE ? OR
        c.address LIKE ? OR
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
      formattedSearch, formattedSearch, formattedSearch, formattedSearch
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

// Fetch all notes for a specific client
ipcMain.handle('get-client-notes', async (event, clientId) => {
  try {
    const notes = db.prepare(`
      SELECT * FROM notes 
      WHERE clientId = ? 
      ORDER BY datetime(createdAt) DESC
    `).all(clientId);
    return { success: true, notes };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Add a new note
ipcMain.handle('add-client-note', async (event, payload) => {
  try {
    const { clientId, text, status } = payload;
    db.prepare(`
      INSERT INTO notes (clientId, text, status, createdAt) 
      VALUES (?, ?, ?, datetime('now', 'localtime'))
    `).run(clientId, text, status);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Update an existing note's status (Bonus: let the agent toggle it directly from the UI!)
ipcMain.handle('update-note-status', async (event, { noteId, status }) => {
  try {
    db.prepare(`UPDATE notes SET status = ? WHERE id = ?`).run(status, noteId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Add to electron/main.ts
ipcMain.handle('get-all-notes', async () => {
  try {
    const notes = db.prepare(`
      SELECT n.*, c.name as clientName 
      FROM notes n
      JOIN clients c ON n.clientId = c.id
      ORDER BY datetime(n.createdAt) DESC
    `).all();
    return { success: true, notes };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Fetch all claims for a single client
ipcMain.handle('get-client-claims', async (event, clientId) => {
  try {
    const claims = db.prepare(`
      SELECT c.*, v.licensePlate, v.make, v.model 
      FROM claims c
      LEFT JOIN vehicles v ON c.vehicleId = v.id
      WHERE c.clientId = ?
      ORDER BY datetime(c.createdAt) DESC
    `).all(clientId);
    return { success: true, claims };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Create a new claim entry
ipcMain.handle('add-client-claim', async (event, payload) => {
  try {
    const { clientId, vehicleId, policyNumber, incidentDate, description, estimatedPayout } = payload;
    db.prepare(`
      INSERT INTO claims (clientId, vehicleId, policyNumber, incidentDate, description, estimatedPayout, status)
      VALUES (?, ?, ?, ?, ?, ?, 'open')
    `).run(clientId, vehicleId || null, policyNumber || null, incidentDate, description, estimatedPayout || 0);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Update a claim's status as negotiations/reviews progress
ipcMain.handle('update-claim-status', async (event, { claimId, status }) => {
  try {
    db.prepare(`UPDATE claims SET status = ? WHERE id = ?`).run(status, claimId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 1. Fetch all document metadata records for a client
ipcMain.handle('get-client-documents', async (event, clientId) => {
  try {
    const docs = db.prepare(`
      SELECT * FROM documents 
      WHERE clientId = ? 
      ORDER BY datetime(createdAt) DESC
    `).all(clientId);
    return { success: true, documents: docs };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 2. Safely copy a local file to the app's internal sandboxed directory
ipcMain.handle('upload-client-document', async (event, { clientId, sourcePath, originalName }) => {
  try {
    // Establish standard isolated storage path: AppData/Roaming/insurance-app/client_documents/client_X/
    const baseDocsDir = path.join(app.getPath('userData'), 'client_documents', `client_${clientId}`);

    // Ensure target structural directory nested branches exist safely
    if (!fs.existsSync(baseDocsDir)) {
      fs.mkdirSync(baseDocsDir, { recursive: true });
    }

    // Sanitize duplicate file naming conflicts by pre-fixing timestamp tags
    const uniqueFileName = `${Date.now()}_${originalName}`;
    const destinationPath = path.join(baseDocsDir, uniqueFileName);

    // Execute local filesystem copy block
    fs.copyFileSync(sourcePath, destinationPath);

    // Save reference pointer path map into database
    db.prepare(`
      INSERT INTO documents (clientId, fileName, filePath)
      VALUES (?, ?, ?)
    `).run(clientId, originalName, destinationPath);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 3. Launch the file in the operating system's native default software viewer
ipcMain.handle('open-native-document', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('הקובץ המבוקש לא נמצא בנתיב המקומי או שהוסר.');
    }
    await shell.openPath(filePath);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
// 4. Safely delete the physical file from disk and remove its database record
ipcMain.handle('delete-client-document', async (event, { documentId, filePath }) => {
  try {
    // Remove the physical file from disk if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete the metadata pointer row from the SQLite database
    db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('authenticate-gdrive-code', async (event, code) => {
  try {
    await backupService.authenticateWithCode(code);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('run-gdrive-backup', async () => {
  return await backupService.runBackupPipeline();
});

// --- Lifecycle Handlers ---

app.whenReady().then(() => {
  const hasCredentials = backupService.loadSavedCredentials();
  console.log(`[Backup] Auto-login status: ${hasCredentials}`);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});