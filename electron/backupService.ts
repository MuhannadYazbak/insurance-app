import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { shell } from 'electron';

// 1. Import the entire namespace under a temporary underscore name
import * as _archiver from 'archiver';

// 2. Safely extract the callable default function or module object and cast it
const archiver = ((_archiver as any).default || _archiver) as unknown as typeof _archiver;

// NOTE: You will generate these client credentials in the Google Cloud Console
// For local apps, using a redirect URI on localhost or loopback is standard.

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:8585'; 

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export class BackupService {
  private oauth2Client;
  private userDataPath: string;

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath;
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
  }

  /**
   * Generates the secure authentication URL to display to the user
   */
  public getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Critical for getting a refresh token
      scope: SCOPES,
      prompt: 'consent'
    });
  }

  /**
   * Exchanges the temporary authorization code for persistent tokens
   */
  public async authenticateWithCode(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    
    // Save tokens locally so the user only logs in once
    const tokenPath = path.join(this.userDataPath, 'gdrive_tokens.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  }

  /**
   * Automatically re-authenticates using saved tokens on app startup
   */
  public loadSavedCredentials(): boolean {
    const tokenPath = path.join(this.userDataPath, 'gdrive_tokens.json');
    if (fs.existsSync(tokenPath)) {
      const tokensRaw = fs.readFileSync(tokenPath, 'utf-8');
      const tokens = JSON.parse(tokensRaw);
      this.oauth2Client.setCredentials(tokens);
      return true;
    }
    return false;
  }

  /**
   * Helper utility to zip the entire client documents folder asynchronously
   */
  private zipDocumentsFolder(sourceDir: string, outZipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZipPath);
    
    // 1. Force the cast inline directly during the functional invocation loop
    const archive = (archiver as any)('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    
    // 2. Explicitly type the error object as any to satisfy strict compiler flags
    archive.on('error', (err: any) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

  /**
   * Orchestrates the complete automated backup lifecycle
   */
  public async runBackupPipeline(): Promise<{ success: boolean; message: string }> {
    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const timestamp = new Date().toISOString().split('T')[0];

      const dbPath = path.join(this.userDataPath, 'agency.db');
      const docsDir = path.join(this.userDataPath, 'client_documents');
      const tempZipPath = path.join(this.userDataPath, `documents_backup_${timestamp}.zip`);

      // 1. Zip the local documents archive if it contains files
      if (fs.existsSync(docsDir)) {
        await this.zipDocumentsFolder(docsDir, tempZipPath);
      }

      // 2. Upload SQLite Database Asset
      if (fs.existsSync(dbPath)) {
        await drive.files.create({
          requestBody: {
            name: `agency_backup_${timestamp}.db`,
            parents: ['root'], 
          },
          media: {
            mimeType: 'application/x-sqlite3',
            body: fs.createReadStream(dbPath),
          },
        });
      }

      // 3. Upload Packed Documents Archive Asset
      if (fs.existsSync(tempZipPath)) {
        await drive.files.create({
          requestBody: {
            name: `documents_backup_${timestamp}.zip`,
            parents: ['root'],
          },
          media: {
            mimeType: 'application/zip',
            body: fs.createReadStream(tempZipPath),
          },
        });

        // Housekeeping: Clean up the temporary local zip copy after streaming finishes
        fs.unlinkSync(tempZipPath);
      }

      return { success: true, message: 'Disaster recovery sync completed successfully.' };
    } catch (error: any) {
      console.error('Backup pipeline failed:', error);
      return { success: false, message: error.message || 'Unknown syncing failure.' };
    }
  }
}