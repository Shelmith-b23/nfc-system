import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  User,
  UserRole,
  Participant,
  NfcCard,
  NfcDevice,
  ParishEvent,
  EventRegistration,
  EventAttendance,
  AuditLog,
  AttendanceStats,
  CheckInMethod,
} from '../src/types/index.js';

export type { UserRole };

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Standard scrypt password hashing using Node crypto.
 * Formatted as: scrypt:<saltHex>:<derivedKeyHex>
 * Incorporates 16 bytes of cryptographically secure salt and 64-byte derived key.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

/**
 * Constant-time verification of password against stored hash.
 * Supports scrypt hashes and legacy SHA-256 fallback during migration.
 */
export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;

  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const key = parts[2];
    try {
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const keyBuffer = Buffer.from(key, 'hex');
      if (derivedKey.length !== keyBuffer.length) return false;
      return crypto.timingSafeEqual(derivedKey, keyBuffer);
    } catch {
      return false;
    }
  }

  // Backward compatibility with legacy SHA-256 salted hashes during migration
  try {
    const legacyHash = crypto.createHash('sha256').update(password + 'blessed_sacrament_salt').digest('hex');
    if (legacyHash.length === storedHash.length) {
      return crypto.timingSafeEqual(Buffer.from(legacyHash), Buffer.from(storedHash));
    }
  } catch {}

  return false;
}

export interface ActiveSession {
  token: string;
  userId: string;
  role: UserRole;
  deviceId?: string;
  createdAt: string;
  expiresAt: string;
}

export interface DatabaseSchema {
  users: User[];
  participants: Participant[];
  nfcCards: NfcCard[];
  devices: NfcDevice[];
  events: ParishEvent[];
  registrations: EventRegistration[];
  attendances: EventAttendance[];
  auditLogs: AuditLog[];
}

class InMemoryDatabase {
  private data: DatabaseSchema;
  private storagePath = path.join(process.cwd(), 'data', 'parish_store.json');
  private backupPath = path.join(process.cwd(), 'data', 'parish_store.json.bak');
  private sessions: Map<string, ActiveSession> = new Map();

  constructor() {
    this.data = this.loadOrSeed();
    this.ensurePasswordsHashed();
  }

  /**
   * Migrate existing user records to ensure scrypt password hashes are present
   */
  private ensurePasswordsHashed(): void {
    let changed = false;
    if (this.data && Array.isArray(this.data.users)) {
      for (const u of this.data.users) {
        if (!u.passwordHash || !u.passwordHash.startsWith('scrypt:')) {
          u.passwordHash = hashPassword('password123');
          changed = true;
        }
      }
    }
    if (changed) {
      this.save();
    }
  }

  /**
   * Safe persistence loading with corruption detection, backup fallback, and .tmp recovery
   */
  private loadOrSeed(): DatabaseSchema {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 1. Check for orphaned .tmp files if primary file is missing or 0 bytes
    const primaryExists = fs.existsSync(this.storagePath);
    const primaryIsEmpty = primaryExists && fs.statSync(this.storagePath).size === 0;

    if (!primaryExists || primaryIsEmpty) {
      try {
        const tmpFiles = fs.readdirSync(dir).filter(f => f.startsWith('parish_store.json.tmp-'));
        for (const tmpFile of tmpFiles) {
          const fullTmp = path.join(dir, tmpFile);
          try {
            const content = fs.readFileSync(fullTmp, 'utf8');
            const parsed = JSON.parse(content);
            if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.events)) {
              console.warn(`Recovered valid database from orphaned temp file: ${tmpFile}`);
              fs.renameSync(fullTmp, this.storagePath);
              return parsed;
            }
          } catch {}
        }
      } catch {}
    }

    // 2. Clean up stale tmp files older than 60s
    try {
      const tmpFiles = fs.readdirSync(dir).filter(f => f.startsWith('parish_store.json.tmp-'));
      for (const f of tmpFiles) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {}
      }
    } catch {}

    // 3. Read primary database file if present
    if (fs.existsSync(this.storagePath)) {
      const raw = fs.readFileSync(this.storagePath, 'utf8').trim();
      if (!raw || raw.length === 0) {
        console.error('CRITICAL: Primary database file is empty (0 bytes). Checking backup...');
        if (fs.existsSync(this.backupPath)) {
          try {
            const backupRaw = fs.readFileSync(this.backupPath, 'utf8');
            const backupData = JSON.parse(backupRaw);
            console.warn('Restored database from valid backup file parish_store.json.bak');
            return backupData;
          } catch (e) {
            console.error('Backup file also unreadable:', e);
          }
        }
        const corruptPath = `${this.storagePath}.corrupt-${Date.now()}`;
        try { fs.renameSync(this.storagePath, corruptPath); } catch {}
        console.error(`Preserved empty/corrupt database at ${corruptPath}. Re-seeding canonical data.`);
        return this.createSeedData();
      }

      try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.events)) {
          throw new Error('Database schema invalid: missing top-level collections');
        }
        return parsed;
      } catch (err) {
        console.error('CRITICAL: Primary database file contains corrupt JSON! Preserving file for recovery.');
        const corruptPath = `${this.storagePath}.corrupt-${Date.now()}`;
        try {
          fs.copyFileSync(this.storagePath, corruptPath);
          console.error(`Corrupt database preserved safely at ${corruptPath}`);
        } catch (copyErr) {
          console.error('Could not copy corrupt database:', copyErr);
        }

        // Try restoring from backup before falling back
        if (fs.existsSync(this.backupPath)) {
          try {
            const backupRaw = fs.readFileSync(this.backupPath, 'utf8');
            const backupData = JSON.parse(backupRaw);
            console.warn('Restored database from backup file parish_store.json.bak after primary corruption');
            return backupData;
          } catch (e) {
            console.error('Backup file also unreadable:', e);
          }
        }

        console.error('No backup available. Re-seeding canonical dataset while keeping corrupt file preserved.');
        return this.createSeedData();
      }
    }

    // Clean initial startup
    const seed = this.createSeedData();
    this.data = seed;
    this.save();
    return seed;
  }

  /**
   * Atomic file persistence:
   * 1. Serialize complete state
   * 2. Write to a temporary file
   * 3. Verify write succeeded (size > 0)
   * 4. Keep previous valid backup
   * 5. Atomically replace primary file with renameSync
   * 6. Clean up temporary files
   */
  public save(): void {
    let tempPath: string | null = null;
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      tempPath = `${this.storagePath}.tmp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const serialized = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(tempPath, serialized, 'utf8');

      // Verify that write completed successfully and is not zero-byte
      const stats = fs.statSync(tempPath);
      if (stats.size === 0) {
        try { fs.unlinkSync(tempPath); } catch {}
        throw new Error('Zero-byte file created during temporary database write');
      }

      // Maintain valid backup snapshot of previous state
      if (fs.existsSync(this.storagePath)) {
        try {
          fs.copyFileSync(this.storagePath, this.backupPath);
        } catch (bErr) {
          console.warn('Could not update backup snapshot:', bErr);
        }
      }

      // Atomically replace primary file
      fs.renameSync(tempPath, this.storagePath);
      tempPath = null;
    } catch (err) {
      if (tempPath && fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      console.error('Failed to persist database file atomically:', err);
      throw err;
    }
  }

  // Cryptographically Secure Sessions (24-hour lifetime)
  public createSession(userId: string, deviceId?: string): ActiveSession {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');
    const token = `bsc_sec_${crypto.randomBytes(32).toString('hex')}`;
    const now = Date.now();
    const session: ActiveSession = {
      token,
      userId,
      role: user.role,
      deviceId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(), // 24h validity
    };
    this.sessions.set(token, session);
    return session;
  }

  public validateSession(token: string): ActiveSession | null {
    if (!token || typeof token !== 'string') return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  public revokeSession(token: string): boolean {
    if (!token) return false;
    return this.sessions.delete(token);
  }

  public resetToSeed(): void {
    this.data = this.createSeedData();
    this.save();
  }

  private createSeedData(): DatabaseSchema {
    const now = new Date();
    const isoNow = now.toISOString();

    const users: User[] = [
      {
        id: 'usr-admin-1',
        email: 'admin@example.test',
        role: 'SUPER_ADMIN',
        firstName: 'Shelmith',
        lastName: 'Wambui',
        phone: '+254 712 345 678',
        isActive: true,
        passwordHash: hashPassword('password123'),
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: isoNow,
        lastLoginAt: isoNow,
      },
      {
        id: 'usr-event-admin-1',
        email: 'eventadmin@example.test',
        role: 'EVENT_ADMIN',
        firstName: 'Fr. Dominic',
        lastName: 'Mwangi',
        phone: '+254 722 987 654',
        isActive: true,
        passwordHash: hashPassword('password123'),
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: isoNow,
        lastLoginAt: isoNow,
      },
      {
        id: 'usr-operator-1',
        email: 'operator@example.test',
        role: 'CHECK_IN_OPERATOR',
        firstName: 'Brian',
        lastName: 'Otieno',
        phone: '+254 733 112 233',
        isActive: true,
        passwordHash: hashPassword('password123'),
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: isoNow,
        lastLoginAt: isoNow,
      },
      {
        id: 'usr-participant-1',
        email: 'shelwangui23@gmail.com',
        role: 'PARTICIPANT',
        firstName: 'Shelmith',
        lastName: 'Wambui',
        phone: '+254 712 345 678',
        isActive: true,
        passwordHash: hashPassword('password123'),
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: isoNow,
      },
    ];

    const participants: Participant[] = [
      {
        id: 'part-001',
        userId: 'usr-participant-1',
        participantNumber: 'BSC-000124',
        firstName: 'Shelmith',
        lastName: 'Wambui',
        phone: '+254 712 345 678',
        email: 'shelwangui23@gmail.com',
        parishGroup: 'YSC',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-002',
        participantNumber: 'BSC-000125',
        firstName: 'Brian',
        lastName: 'Mwangi',
        phone: '+254 721 112 201',
        email: 'brian.m@example.test',
        parishGroup: 'Choir',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:05:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-003',
        participantNumber: 'BSC-000126',
        firstName: 'Mercy',
        lastName: 'Njeri',
        phone: '+254 722 223 302',
        email: 'mercy.njeri@example.test',
        parishGroup: 'MYM',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:10:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-004',
        participantNumber: 'BSC-000127',
        firstName: 'John',
        lastName: 'Kamau',
        phone: '+254 723 334 403',
        email: 'john.k@example.test',
        parishGroup: 'Altar Servers',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:15:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-005',
        participantNumber: 'BSC-000128',
        firstName: 'Francis',
        lastName: 'Ochieng',
        phone: '+254 724 445 504',
        email: 'francis.o@example.test',
        parishGroup: 'CMA',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:20:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-006',
        participantNumber: 'BSC-000129',
        firstName: 'Agnes',
        lastName: 'Muthoni',
        phone: '+254 725 556 605',
        email: 'agnes.m@example.test',
        parishGroup: 'PMC',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:25:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-007',
        participantNumber: 'BSC-000130',
        firstName: 'Patrick',
        lastName: 'Mutua',
        phone: '+254 726 667 706',
        email: 'patrick.m@example.test',
        parishGroup: 'Charismatic Renewal',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-008',
        participantNumber: 'BSC-000131',
        firstName: 'Faith',
        lastName: 'Wanjiku',
        phone: '+254 727 778 807',
        email: 'faith.w@example.test',
        parishGroup: 'Liturgical Committee',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:35:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-009',
        participantNumber: 'BSC-000132',
        firstName: 'Joseph',
        lastName: 'Kiprop',
        phone: '+254 728 889 908',
        email: 'joseph.k@example.test',
        parishGroup: 'YSC',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:40:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-010',
        participantNumber: 'BSC-000133',
        firstName: 'Grace',
        lastName: 'Achieng',
        phone: '+254 729 990 009',
        email: 'grace.a@example.test',
        parishGroup: 'Choir',
        isParishMember: false,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:45:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-011',
        participantNumber: 'BSC-000134',
        firstName: 'David',
        lastName: 'Kariuki',
        phone: '+254 730 001 110',
        email: 'david.k@example.test',
        parishGroup: 'CMA',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:50:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-012',
        participantNumber: 'BSC-000135',
        firstName: 'Esther',
        lastName: 'Nduta',
        phone: '+254 731 112 211',
        email: 'esther.n@example.test',
        parishGroup: 'MYM',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T10:55:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-013',
        participantNumber: 'BSC-000136',
        firstName: 'James',
        lastName: 'Mwiti',
        phone: '+254 732 223 312',
        email: 'james.m@example.test',
        parishGroup: 'Altar Servers',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T11:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-014',
        participantNumber: 'BSC-000137',
        firstName: 'Mary',
        lastName: 'Wambui',
        phone: '+254 733 334 413',
        email: 'mary.w@example.test',
        parishGroup: 'PMC',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T11:05:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-015',
        participantNumber: 'BSC-000138',
        firstName: 'Peter',
        lastName: 'Otieno',
        phone: '+254 734 445 514',
        email: 'peter.o@example.test',
        parishGroup: 'Charismatic Renewal',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T11:10:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-016',
        participantNumber: 'BSC-000139',
        firstName: 'Rose',
        lastName: 'Nyambura',
        phone: '+254 735 556 615',
        email: 'rose.n@example.test',
        parishGroup: 'Choir',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T11:15:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-017',
        participantNumber: 'BSC-000140',
        firstName: 'Daniel',
        lastName: 'Kiprotich',
        phone: '+254 736 667 716',
        email: 'daniel.k@example.test',
        parishGroup: 'YSC',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T11:20:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-018',
        participantNumber: 'BSC-000141',
        firstName: 'Lucy',
        lastName: 'Muthoni',
        phone: '+254 737 778 817',
        email: 'lucy.m@example.test',
        parishGroup: 'Liturgical Committee',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T11:25:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-019',
        participantNumber: 'BSC-000142',
        firstName: 'Samuel',
        lastName: 'Kimani',
        phone: '+254 738 889 918',
        email: 'samuel.k@example.test',
        parishGroup: 'CMA',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T11:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'part-020',
        participantNumber: 'BSC-000143',
        firstName: 'Beatrice',
        lastName: 'Chebet',
        phone: '+254 739 990 019',
        email: 'beatrice.c@example.test',
        parishGroup: 'YSC',
        isParishMember: true,
        status: 'ACTIVE',
        createdAt: '2026-09-02T11:35:00Z',
        updatedAt: isoNow,
      },
    ];

    // Seed NFC Cards
    // Opaque tokens follow specification format: BSCNFC:v1:<token>
    const nfcCards: NfcCard[] = [
      {
        id: 'card-001',
        participantId: 'part-001', // Shelmith Wambui
        cardNumber: 'BSC-CARD-000124',
        tokenHash: hashToken('BSCNFC:v1:982f1b4a7d6e5c3a'),
        rawTokenPreview: 'BSCNFC:v1:982f1b4a7d6e5c3a',
        status: 'ACTIVE',
        issuedAt: '2026-09-05T09:00:00Z',
        createdAt: '2026-09-05T08:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'card-002',
        participantId: 'part-002', // Brian Mwangi
        cardNumber: 'BSC-CARD-000125',
        tokenHash: hashToken('BSCNFC:v1:4c8a2e1f9b3d7a6e'),
        rawTokenPreview: 'BSCNFC:v1:4c8a2e1f9b3d7a6e',
        status: 'ACTIVE',
        issuedAt: '2026-09-05T09:10:00Z',
        createdAt: '2026-09-05T08:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'card-003',
        participantId: 'part-003', // Mercy Njeri
        cardNumber: 'BSC-CARD-000126',
        tokenHash: hashToken('BSCNFC:v1:7d3f9a2e6c1b8a4f'),
        rawTokenPreview: 'BSCNFC:v1:7d3f9a2e6c1b8a4f',
        status: 'ACTIVE',
        issuedAt: '2026-09-05T09:15:00Z',
        createdAt: '2026-09-05T08:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'card-004',
        participantId: 'part-004', // John Kamau
        cardNumber: 'BSC-CARD-000127',
        tokenHash: hashToken('BSCNFC:v1:3a6e9d2f1b7c4a8e'),
        rawTokenPreview: 'BSCNFC:v1:3a6e9d2f1b7c4a8e',
        status: 'ACTIVE',
        issuedAt: '2026-09-05T09:20:00Z',
        createdAt: '2026-09-05T08:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'card-005',
        participantId: 'part-005', // Francis Ochieng
        cardNumber: 'BSC-CARD-000128',
        tokenHash: hashToken('BSCNFC:v1:8f4c2e6b1a9d7e3a'),
        rawTokenPreview: 'BSCNFC:v1:8f4c2e6b1a9d7e3a',
        status: 'ACTIVE',
        issuedAt: '2026-09-05T09:25:00Z',
        createdAt: '2026-09-05T08:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'card-006',
        participantId: 'part-006', // Agnes Muthoni
        cardNumber: 'BSC-CARD-000129',
        tokenHash: hashToken('BSCNFC:v1:1e7d3a9b6c2f4a8e'),
        rawTokenPreview: 'BSCNFC:v1:1e7d3a9b6c2f4a8e',
        status: 'REVOKED',
        issuedAt: '2026-09-05T09:30:00Z',
        revokedAt: '2026-09-10T14:00:00Z',
        createdAt: '2026-09-05T08:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'card-007',
        participantId: 'part-007', // Patrick Mutua
        cardNumber: 'BSC-CARD-000130',
        tokenHash: hashToken('BSCNFC:v1:6b2f8a4e1d7c3a9f'),
        rawTokenPreview: 'BSCNFC:v1:6b2f8a4e1d7c3a9f',
        status: 'LOST',
        issuedAt: '2026-09-05T09:35:00Z',
        revokedAt: '2026-09-12T11:00:00Z',
        createdAt: '2026-09-05T08:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'card-008',
        participantId: 'part-009', // Joseph Kiprop
        cardNumber: 'BSC-CARD-000131',
        tokenHash: hashToken('BSCNFC:v1:5a8e2d4c9f1b7a3e'),
        rawTokenPreview: 'BSCNFC:v1:5a8e2d4c9f1b7a3e',
        status: 'ACTIVE',
        issuedAt: '2026-09-06T10:00:00Z',
        createdAt: '2026-09-05T08:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'card-009',
        cardNumber: 'BSC-CARD-000132',
        tokenHash: hashToken('BSCNFC:v1:blank_unassigned_tag_01'),
        rawTokenPreview: 'BSCNFC:v1:blank_unassigned_tag_01',
        status: 'UNASSIGNED',
        createdAt: '2026-09-05T08:30:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'card-010',
        cardNumber: 'BSC-CARD-000133',
        tokenHash: hashToken('BSCNFC:v1:blank_unassigned_tag_02'),
        rawTokenPreview: 'BSCNFC:v1:blank_unassigned_tag_02',
        status: 'UNASSIGNED',
        createdAt: '2026-09-05T08:30:00Z',
        updatedAt: isoNow,
      },
    ];

    // Seed NFC Devices
    const devices: NfcDevice[] = [
      {
        id: 'dev-001',
        deviceCode: 'BSC-EVENT-01',
        deviceName: 'Main Entrance - Mumias Road',
        location: 'Parish Gate A',
        isActive: true,
        lastSeenAt: isoNow,
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'dev-002',
        deviceCode: 'BSC-EVENT-02',
        deviceName: 'Youth & Hall Entrance',
        location: 'Fr. Grol Hall Porch',
        isActive: true,
        lastSeenAt: isoNow,
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'dev-003',
        deviceCode: 'BSC-EVENT-03',
        deviceName: 'Registration Desk & Help Kiosk',
        location: 'Pastoral Office Tent',
        isActive: true,
        lastSeenAt: isoNow,
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'dev-004',
        deviceCode: 'GATE-A-READER-1',
        deviceName: 'Parish Gate A Mobile Reader',
        location: 'Parish Gate A',
        isActive: true,
        lastSeenAt: isoNow,
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'dev-005',
        deviceCode: 'GATE-B-READER-1',
        deviceName: 'Parish Gate B Mobile Reader',
        location: 'Parish Gate B',
        isActive: true,
        lastSeenAt: isoNow,
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'dev-006',
        deviceCode: 'BSC-ANDROID-01',
        deviceName: 'Android NFC Handheld Gate A',
        location: 'Parish Gate A (Mumias Rd)',
        isActive: true,
        lastSeenAt: isoNow,
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'dev-007',
        deviceCode: 'BSC-ANDROID-02',
        deviceName: 'Android NFC Handheld Gate B',
        location: 'Parish Gate B (Fr. Grol Hall)',
        isActive: true,
        lastSeenAt: isoNow,
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: isoNow,
      },
    ];

    // Seed Parish Events
    const events: ParishEvent[] = [
      {
        id: 'evt-001',
        eventCode: 'YSC-SPORT-2026',
        title: 'YSC Annual Parish Sports Day 2026',
        description:
          'Annual sports and fellowship tournament bringing together all Blessed Sacrament Parish youth and families at Mukuru Grounds. Competitions in football, volleyball, athletics, and cultural dances.',
        category: 'Youth & Sports',
        venue: 'Mukuru Sports Grounds, Buru-Phase III',
        startAt: '2026-09-20T07:00:00Z',
        endAt: '2026-09-20T17:00:00Z',
        registrationOpenAt: '2026-09-01T00:00:00Z',
        registrationCloseAt: '2026-09-20T12:00:00Z',
        capacity: 500,
        status: 'LIVE',
        allowRegistration: true,
        allowNfcCheckin: true,
        allowQrCheckin: true,
        allowManualCheckin: true,
        createdBy: 'usr-admin-1',
        createdAt: '2026-09-01T09:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'evt-002',
        eventCode: 'PPC-ASSEMBLY-2026',
        title: 'Parish Pastoral Council General Assembly',
        description:
          'Quarterly consultative assembly of Blessed Sacrament parish executive leaders, SCC representatives, and apostolic groups to evaluate pastoral initiatives and parish calendar.',
        category: 'Pastoral & Governance',
        venue: 'Fr. Grol Memorial Parish Hall',
        startAt: '2026-09-27T09:00:00Z',
        endAt: '2026-09-27T13:30:00Z',
        registrationOpenAt: '2026-09-05T00:00:00Z',
        registrationCloseAt: '2026-09-26T18:00:00Z',
        capacity: 150,
        status: 'PUBLISHED',
        allowRegistration: true,
        allowNfcCheckin: true,
        allowQrCheckin: true,
        allowManualCheckin: true,
        createdBy: 'usr-admin-1',
        createdAt: '2026-09-05T11:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'evt-003',
        eventCode: 'CORPUS-CHRISTI-2026',
        title: 'Solemnity of Corpus Christi Parish Vigil',
        description:
          'Overnight Eucharistic Adoration, vigil prayers, and solemn choral benediction culminating in the dawn Eucharistic procession through Buru-Phase III streets.',
        category: 'Liturgical & Spiritual',
        venue: 'Blessed Sacrament Main Sanctuary',
        startAt: '2026-10-04T18:00:00Z',
        endAt: '2026-10-05T06:00:00Z',
        registrationOpenAt: '2026-09-10T00:00:00Z',
        registrationCloseAt: '2026-10-04T20:00:00Z',
        capacity: 800,
        status: 'PUBLISHED',
        allowRegistration: true,
        allowNfcCheckin: true,
        allowQrCheckin: true,
        allowManualCheckin: true,
        createdBy: 'usr-event-admin-1',
        createdAt: '2026-09-10T12:00:00Z',
        updatedAt: isoNow,
      },
      {
        id: 'evt-004',
        eventCode: 'CMA-MEN-2026',
        title: 'CMA Men Fellowship & Mentorship Breakfast',
        description:
          'Catholic Men Association spiritual reflection, breakfast, and youth mentorship outreach session.',
        category: 'Men Ministry',
        venue: 'St. Joseph Center, Blessed Sacrament',
        startAt: '2026-09-06T07:30:00Z',
        endAt: '2026-09-06T11:30:00Z',
        registrationOpenAt: '2026-08-20T00:00:00Z',
        registrationCloseAt: '2026-09-05T18:00:00Z',
        capacity: 100,
        status: 'COMPLETED',
        allowRegistration: false,
        allowNfcCheckin: true,
        allowQrCheckin: true,
        allowManualCheckin: true,
        createdBy: 'usr-admin-1',
        createdAt: '2026-08-20T10:00:00Z',
        updatedAt: '2026-09-06T12:00:00Z',
      },
    ];

    // Seed Registrations for YSC Sports Day (all 20 participants)
    const registrations: EventRegistration[] = participants.map((p, idx) => {
      const regCode = `BSC-EVT-${(idx + 1).toString().padStart(6, '0')}`;
      const rawQr = `https://events.blessedsacramentcatholichurch.com/checkin/qr/${regCode}_${p.id}`;
      return {
        id: `reg-001-${p.id}`,
        eventId: 'evt-001',
        participantId: p.id,
        registrationCode: regCode,
        qrTokenHash: hashToken(rawQr),
        rawQrToken: rawQr,
        status: 'REGISTERED',
        registeredAt: '2026-09-05T12:00:00Z',
        createdAt: '2026-09-05T12:00:00Z',
        updatedAt: isoNow,
      };
    });

    // Seed some check-in records for YSC Sports Day
    // Brian Mwangi (NFC), Mercy Njeri (QR), John Kamau (NFC), Francis Ochieng (MANUAL)
    const attendances: EventAttendance[] = [
      {
        id: 'att-001',
        eventId: 'evt-001',
        participantId: 'part-002', // Brian Mwangi
        registrationId: 'reg-001-part-002',
        method: 'NFC',
        deviceId: 'dev-001',
        checkInAt: '2026-09-20T08:14:00Z',
        operatorUserId: 'usr-operator-1',
        notes: 'Card tap via Main Entrance reader',
        clientEventId: 'client-sync-001',
        createdAt: '2026-09-20T08:14:00Z',
        updatedAt: '2026-09-20T08:14:00Z',
      },
      {
        id: 'att-002',
        eventId: 'evt-001',
        participantId: 'part-003', // Mercy Njeri
        registrationId: 'reg-001-part-003',
        method: 'QR',
        deviceId: 'dev-002',
        checkInAt: '2026-09-20T08:26:00Z',
        operatorUserId: 'usr-operator-1',
        notes: 'Mobile QR scanned at Youth Entrance',
        clientEventId: 'client-sync-002',
        createdAt: '2026-09-20T08:26:00Z',
        updatedAt: '2026-09-20T08:26:00Z',
      },
      {
        id: 'att-003',
        eventId: 'evt-001',
        participantId: 'part-004', // John Kamau
        registrationId: 'reg-001-part-004',
        method: 'NFC',
        deviceId: 'dev-001',
        checkInAt: '2026-09-20T08:42:00Z',
        operatorUserId: 'usr-operator-1',
        notes: 'Card tap via Main Entrance reader',
        clientEventId: 'client-sync-003',
        createdAt: '2026-09-20T08:42:00Z',
        updatedAt: '2026-09-20T08:42:00Z',
      },
      {
        id: 'att-004',
        eventId: 'evt-001',
        participantId: 'part-005', // Francis Ochieng
        registrationId: 'reg-001-part-005',
        method: 'MANUAL',
        deviceId: 'dev-003',
        checkInAt: '2026-09-20T09:05:00Z',
        operatorUserId: 'usr-admin-1',
        notes: 'Manual participant lookup at Registration Desk',
        clientEventId: 'client-sync-004',
        createdAt: '2026-09-20T09:05:00Z',
        updatedAt: '2026-09-20T09:05:00Z',
      },
      {
        id: 'att-005',
        eventId: 'evt-001',
        participantId: 'part-009', // Joseph Kiprop
        registrationId: 'reg-001-part-009',
        method: 'NFC',
        deviceId: 'dev-001',
        checkInAt: '2026-09-20T09:18:00Z',
        operatorUserId: 'usr-operator-1',
        notes: 'Card tap via Main Entrance reader',
        clientEventId: 'client-sync-005',
        createdAt: '2026-09-20T09:18:00Z',
        updatedAt: '2026-09-20T09:18:00Z',
      },
    ];

    // Mark those who checked in
    attendances.forEach(att => {
      const reg = registrations.find(r => r.id === att.registrationId);
      if (reg) reg.status = 'CHECKED_IN';
    });

    // Seed audit logs
    const auditLogs: AuditLog[] = [
      {
        id: 'log-001',
        actorUserId: 'usr-admin-1',
        actorName: 'Shelmith Wambui',
        action: 'EVENT_CREATED',
        entityType: 'EVENT',
        entityId: 'evt-001',
        metadata: { title: 'YSC Annual Parish Sports Day 2026', code: 'YSC-SPORT-2026' },
        ipAddress: '197.232.61.12',
        createdAt: '2026-09-01T09:00:00Z',
      },
      {
        id: 'log-002',
        actorUserId: 'usr-admin-1',
        actorName: 'Shelmith Wambui',
        action: 'CARD_ASSIGNED',
        entityType: 'NFC_CARD',
        entityId: 'card-001',
        metadata: { cardNumber: 'BSC-CARD-000124', participant: 'Shelmith Wambui' },
        ipAddress: '197.232.61.12',
        createdAt: '2026-09-05T09:00:00Z',
      },
      {
        id: 'log-003',
        actorUserId: 'usr-operator-1',
        actorName: 'Brian Otieno',
        action: 'NFC_CHECK_IN',
        entityType: 'EVENT_ATTENDANCE',
        entityId: 'att-001',
        metadata: { participant: 'Brian Mwangi', event: 'YSC Sports Day', method: 'NFC' },
        ipAddress: '10.0.4.12',
        createdAt: '2026-09-20T08:14:00Z',
      },
      {
        id: 'log-004',
        actorUserId: 'usr-admin-1',
        actorName: 'Shelmith Wambui',
        action: 'MANUAL_CHECK_IN',
        entityType: 'EVENT_ATTENDANCE',
        entityId: 'att-004',
        metadata: { participant: 'Francis Ochieng', notes: 'Registration desk lookup' },
        ipAddress: '10.0.4.15',
        createdAt: '2026-09-20T09:05:00Z',
      },
    ];

    return {
      users,
      participants,
      nfcCards,
      devices,
      events,
      registrations,
      attendances,
      auditLogs,
    };
  }

  // --- QUERY & MUTATION METHODS ---

  // Auth & Users
  public getUsers(): User[] {
    return this.data.users;
  }

  public getUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  // Participants
  public getParticipants(): Participant[] {
    return this.data.participants;
  }

  public getParticipantById(id: string): Participant | undefined {
    return this.data.participants.find(p => p.id === id);
  }

  public getParticipantByNumber(num: string): Participant | undefined {
    return this.data.participants.find(p => p.participantNumber.toUpperCase() === num.toUpperCase());
  }

  public createParticipant(data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    parishGroup?: string;
    isParishMember: boolean;
  }): Participant {
    const count = this.data.participants.length + 1;
    const participantNumber = `BSC-${count.toString().padStart(6, '0')}`;
    const isoNow = new Date().toISOString();

    const participant: Participant = {
      id: `part-${crypto.randomUUID()}`,
      participantNumber,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim() || undefined,
      parishGroup: data.parishGroup || 'None',
      isParishMember: data.isParishMember,
      status: 'ACTIVE',
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    this.data.participants.unshift(participant);
    this.save();
    return participant;
  }

  // NFC Cards
  public getNfcCards(): NfcCard[] {
    return this.data.nfcCards;
  }

  public getNfcCardById(id: string): NfcCard | undefined {
    return this.data.nfcCards.find(c => c.id === id);
  }

  public getNfcCardByToken(rawToken: string): NfcCard | undefined {
    const tokenHash = hashToken(rawToken);
    return this.data.nfcCards.find(c => c.tokenHash === tokenHash);
  }

  public getNfcCardByParticipant(participantId: string): NfcCard | undefined {
    return this.data.nfcCards.find(
      c => c.participantId === participantId && c.status === 'ACTIVE'
    );
  }

  public issueNfcCard(params: {
    participantId?: string;
    rawToken?: string;
    customCardNumber?: string;
    actorUserId?: string;
    actorName?: string;
  }): NfcCard {
    const isoNow = new Date().toISOString();
    const count = this.data.nfcCards.length + 1;
    const cardNumber = params.customCardNumber || `BSC-CARD-${count.toString().padStart(6, '0')}`;
    const rawToken = params.rawToken || `BSCNFC:v1:${crypto.randomBytes(8).toString('hex')}`;
    const tokenHash = hashToken(rawToken);

    const card: NfcCard = {
      id: `card-${crypto.randomUUID()}`,
      participantId: params.participantId,
      cardNumber,
      tokenHash,
      rawTokenPreview: rawToken,
      status: params.participantId ? 'ACTIVE' : 'UNASSIGNED',
      issuedAt: params.participantId ? isoNow : undefined,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    this.data.nfcCards.unshift(card);

    this.logAudit({
      actorUserId: params.actorUserId,
      actorName: params.actorName,
      action: params.participantId ? 'CARD_ISSUED_AND_ASSIGNED' : 'CARD_CREATED_UNASSIGNED',
      entityType: 'NFC_CARD',
      entityId: card.id,
      metadata: { cardNumber, participantId: params.participantId, status: card.status },
    });

    this.save();
    return card;
  }

  public assignNfcCard(cardId: string, participantId: string, actorUserId?: string, actorName?: string): NfcCard {
    const card = this.getNfcCardById(cardId);
    if (!card) throw new Error('Card not found');

    const participant = this.getParticipantById(participantId);
    if (!participant) throw new Error('Participant not found');

    // Revoke any currently active cards for this participant
    const existingActive = this.getNfcCardByParticipant(participantId);
    if (existingActive && existingActive.id !== cardId) {
      existingActive.status = 'REVOKED';
      existingActive.revokedAt = new Date().toISOString();
      existingActive.replacedByCardId = cardId;
    }

    const isoNow = new Date().toISOString();
    card.participantId = participantId;
    card.status = 'ACTIVE';
    card.issuedAt = isoNow;
    card.updatedAt = isoNow;

    this.logAudit({
      actorUserId,
      actorName,
      action: 'CARD_ASSIGNED',
      entityType: 'NFC_CARD',
      entityId: card.id,
      metadata: { cardNumber: card.cardNumber, participantId, participantName: `${participant.firstName} ${participant.lastName}` },
    });

    this.save();
    return card;
  }

  public revokeNfcCard(cardId: string, reason: string, actorUserId?: string, actorName?: string): NfcCard {
    const card = this.getNfcCardById(cardId);
    if (!card) throw new Error('Card not found');

    const isoNow = new Date().toISOString();
    card.status = 'REVOKED';
    card.revokedAt = isoNow;
    card.updatedAt = isoNow;

    this.logAudit({
      actorUserId,
      actorName,
      action: 'CARD_REVOKED',
      entityType: 'NFC_CARD',
      entityId: card.id,
      metadata: { cardNumber: card.cardNumber, reason },
    });

    this.save();
    return card;
  }

  public replaceNfcCard(oldCardId: string, newRawToken?: string, actorUserId?: string, actorName?: string): { oldCard: NfcCard; newCard: NfcCard } {
    const oldCard = this.getNfcCardById(oldCardId);
    if (!oldCard) throw new Error('Old card not found');
    if (!oldCard.participantId) throw new Error('Old card was not assigned to a participant');

    const participantId = oldCard.participantId;
    const isoNow = new Date().toISOString();

    const newCard = this.issueNfcCard({
      participantId,
      rawToken: newRawToken,
      actorUserId,
      actorName,
    });

    oldCard.status = 'REVOKED';
    oldCard.revokedAt = isoNow;
    oldCard.replacedByCardId = newCard.id;
    oldCard.updatedAt = isoNow;

    this.logAudit({
      actorUserId,
      actorName,
      action: 'CARD_REPLACED',
      entityType: 'NFC_CARD',
      entityId: newCard.id,
      metadata: { oldCardNumber: oldCard.cardNumber, newCardNumber: newCard.cardNumber, participantId },
    });

    this.save();
    return { oldCard, newCard };
  }

  // Devices
  public getDevices(): NfcDevice[] {
    return this.data.devices;
  }

  public getDeviceByCode(code: string): NfcDevice | undefined {
    return this.data.devices.find(
      d => d.deviceCode === code || d.id === code || d.deviceCode.toLowerCase() === code.toLowerCase()
    );
  }

  public registerOrEnrollDevice(params: {
    deviceCode: string;
    deviceName: string;
    location: string;
  }): NfcDevice {
    let dev = this.data.devices.find(d => d.deviceCode.toLowerCase() === params.deviceCode.toLowerCase());
    const isoNow = new Date().toISOString();
    if (dev) {
      dev.deviceName = params.deviceName;
      dev.location = params.location;
      dev.isActive = true;
      dev.lastSeenAt = isoNow;
      dev.updatedAt = isoNow;
    } else {
      dev = {
        id: `dev-${crypto.randomUUID().substring(0, 8)}`,
        deviceCode: params.deviceCode.toUpperCase(),
        deviceName: params.deviceName,
        location: params.location,
        isActive: true,
        lastSeenAt: isoNow,
        createdAt: isoNow,
        updatedAt: isoNow,
      };
      this.data.devices.push(dev);
    }
    this.save();
    return dev;
  }

  public touchDevice(deviceCode: string): void {
    const dev = this.getDeviceByCode(deviceCode);
    if (dev) {
      dev.lastSeenAt = new Date().toISOString();
      this.save();
    }
  }

  // Events
  public getEvents(): ParishEvent[] {
    return this.data.events;
  }

  public getEventById(id: string): ParishEvent | undefined {
    return this.data.events.find(e => e.id === id);
  }

  public getEventByCode(code: string): ParishEvent | undefined {
    return this.data.events.find(e => e.eventCode.toUpperCase() === code.toUpperCase());
  }

  public createEvent(params: Omit<ParishEvent, 'id' | 'createdAt' | 'updatedAt'>, actorUserId?: string, actorName?: string): ParishEvent {
    const isoNow = new Date().toISOString();
    const event: ParishEvent = {
      ...params,
      id: `evt-${crypto.randomUUID()}`,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    this.data.events.unshift(event);
    this.logAudit({
      actorUserId,
      actorName,
      action: 'EVENT_CREATED',
      entityType: 'EVENT',
      entityId: event.id,
      metadata: { eventCode: event.eventCode, title: event.title },
    });

    this.save();
    return event;
  }

  public updateEvent(id: string, updates: Partial<ParishEvent>, actorUserId?: string, actorName?: string): ParishEvent {
    const event = this.getEventById(id);
    if (!event) throw new Error('Event not found');

    Object.assign(event, updates, { updatedAt: new Date().toISOString() });

    this.logAudit({
      actorUserId,
      actorName,
      action: 'EVENT_UPDATED',
      entityType: 'EVENT',
      entityId: event.id,
      metadata: updates,
    });

    this.save();
    return event;
  }

  // Registrations
  public getRegistrations(eventId?: string): EventRegistration[] {
    if (!eventId) return this.data.registrations;
    return this.data.registrations.filter(r => r.eventId === eventId);
  }

  public getRegistration(eventId: string, participantId: string): EventRegistration | undefined {
    return this.data.registrations.find(
      r => r.eventId === eventId && r.participantId === participantId && r.status !== 'CANCELLED'
    );
  }

  public getRegistrationByCode(code: string): EventRegistration | undefined {
    return this.data.registrations.find(r => r.registrationCode.toUpperCase() === code.toUpperCase());
  }

  public getRegistrationByQrToken(rawToken: string): EventRegistration | undefined {
    const tokenHash = hashToken(rawToken);
    return this.data.registrations.find(r => r.qrTokenHash === tokenHash || r.rawQrToken === rawToken);
  }

  public registerParticipantForEvent(
    eventId: string,
    participantId: string,
    actorUserId?: string,
    actorName?: string
  ): EventRegistration {
    const event = this.getEventById(eventId);
    if (!event) throw new Error('Event not found');

    const participant = this.getParticipantById(participantId);
    if (!participant) throw new Error('Participant not found');

    // Check unique constraint: UNIQUE(event_id, participant_id)
    const existing = this.getRegistration(eventId, participantId);
    if (existing) {
      return existing;
    }

    const isoNow = new Date().toISOString();
    const count = this.data.registrations.length + 1;
    const regCode = `BSC-EVT-${count.toString().padStart(6, '0')}`;
    const rawQr = `https://events.blessedsacramentcatholichurch.com/checkin/qr/${regCode}_${participantId}`;
    const qrTokenHash = hashToken(rawQr);

    const reg: EventRegistration = {
      id: `reg-${crypto.randomUUID()}`,
      eventId,
      participantId,
      registrationCode: regCode,
      qrTokenHash,
      rawQrToken: rawQr,
      status: 'REGISTERED',
      registeredAt: isoNow,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    this.data.registrations.unshift(reg);

    this.logAudit({
      actorUserId,
      actorName,
      action: 'PARTICIPANT_REGISTERED',
      entityType: 'REGISTRATION',
      entityId: reg.id,
      metadata: { eventId, participantId, registrationCode: regCode },
    });

    this.save();
    return reg;
  }

  // Attendance & Check-In
  public getAttendances(eventId?: string): EventAttendance[] {
    if (!eventId) return this.data.attendances;
    return this.data.attendances.filter(a => a.eventId === eventId);
  }

  public getAttendance(eventId: string, participantId: string): EventAttendance | undefined {
    return this.data.attendances.find(
      a => a.eventId === eventId && a.participantId === participantId
    );
  }

  /**
   * Authoritative check-in recording with transactional lock & UNIQUE(event_id, participant_id) enforcement.
   */
  public recordAttendance(params: {
    eventId: string;
    participantId: string;
    method: CheckInMethod;
    deviceId?: string;
    operatorUserId?: string;
    notes?: string;
    clientEventId?: string;
    actorName?: string;
  }): {
    success: boolean;
    duplicate: boolean;
    isReplay?: boolean;
    attendance?: EventAttendance;
    existingAttendance?: EventAttendance;
    error?: { code: string; message: string };
  } {
    const { eventId, participantId, method, deviceId, operatorUserId, notes, clientEventId, actorName } = params;

    const event = this.getEventById(eventId);
    if (!event) {
      return { success: false, duplicate: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' } };
    }

    if (event.status !== 'LIVE' && event.status !== 'PUBLISHED') {
      return { success: false, duplicate: false, error: { code: 'EVENT_NOT_ACTIVE', message: 'This event is not active or accepting check-ins' } };
    }

    const participant = this.getParticipantById(participantId);
    if (!participant) {
      return { success: false, duplicate: false, error: { code: 'PARTICIPANT_NOT_FOUND', message: 'Participant not found' } };
    }

    // Check device authorization
    if (deviceId) {
      const dev = this.getDeviceByCode(deviceId);
      if (!dev || !dev.isActive) {
        return { success: false, duplicate: false, error: { code: 'DEVICE_NOT_AUTHORIZED', message: `Device ${deviceId} is not authorized` } };
      }
      this.touchDevice(deviceId);
    }

    // IDEMPOTENCY CHECK for offline sync & clientEventId
    if (clientEventId) {
      const existingSync = this.data.attendances.find(a => a.clientEventId === clientEventId);
      if (existingSync) {
        return { success: true, duplicate: false, isReplay: true, attendance: existingSync };
      }
    }

    // CONCURRENT CHECK-IN & UNIQUE CONSTRAINT PROTECTION: UNIQUE(event_id, participant_id)
    const existing = this.getAttendance(eventId, participantId);
    if (existing) {
      return {
        success: false,
        duplicate: true,
        existingAttendance: existing,
        error: { code: 'ALREADY_CHECKED_IN', message: `${participant.firstName} ${participant.lastName} was already checked in` },
      };
    }

    // Ensure registration exists (auto-register if event allows walk-ins, or retrieve existing)
    let registration = this.getRegistration(eventId, participantId);
    if (!registration) {
      // Auto-register walk-in
      registration = this.registerParticipantForEvent(eventId, participantId, operatorUserId, actorName);
    }
    registration.status = 'CHECKED_IN';

    const isoNow = new Date().toISOString();
    const attendance: EventAttendance = {
      id: `att-${crypto.randomUUID()}`,
      eventId,
      participantId,
      registrationId: registration.id,
      method,
      deviceId,
      checkInAt: isoNow,
      operatorUserId,
      notes,
      clientEventId,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    this.data.attendances.unshift(attendance);

    // Audit log
    this.logAudit({
      actorUserId: operatorUserId,
      actorName: actorName || 'Check-in Operator',
      action: `${method}_CHECK_IN`,
      entityType: 'EVENT_ATTENDANCE',
      entityId: attendance.id,
      metadata: {
        eventId,
        participantNumber: participant.participantNumber,
        participantName: `${participant.firstName} ${participant.lastName}`,
        method,
        deviceId,
      },
    });

    this.save();
    return { success: true, duplicate: false, attendance };
  }

  // Attendance Stats
  public getAttendanceStats(eventId: string): AttendanceStats {
    const regs = this.getRegistrations(eventId);
    const atts = this.getAttendances(eventId);

    const totalRegistered = regs.length;
    const totalCheckedIn = atts.length;
    const remaining = Math.max(0, totalRegistered - totalCheckedIn);
    const attendanceRate = totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0;

    let nfc = 0;
    let qr = 0;
    let manual = 0;

    const hourMap = new Map<string, number>();

    atts.forEach(a => {
      if (a.method === 'NFC') nfc++;
      else if (a.method === 'QR') qr++;
      else if (a.method === 'MANUAL') manual++;

      const date = new Date(a.checkInAt);
      const hourStr = `${date.getUTCHours().toString().padStart(2, '0')}:00 UTC`;
      hourMap.set(hourStr, (hourMap.get(hourStr) || 0) + 1);
    });

    const byHour = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    // Groups breakdown
    const groupStatsMap = new Map<string, { registered: number; checkedIn: number }>();
    regs.forEach(r => {
      const p = this.getParticipantById(r.participantId);
      const group = p?.parishGroup || 'Other';
      if (!groupStatsMap.has(group)) {
        groupStatsMap.set(group, { registered: 0, checkedIn: 0 });
      }
      const st = groupStatsMap.get(group)!;
      st.registered++;
      if (atts.some(a => a.participantId === r.participantId)) {
        st.checkedIn++;
      }
    });

    const byGroup = Array.from(groupStatsMap.entries()).map(([group, val]) => ({
      group,
      registered: val.registered,
      checkedIn: val.checkedIn,
    }));

    return {
      totalRegistered,
      totalCheckedIn,
      remaining,
      attendanceRate,
      byMethod: { nfc, qr, manual },
      byHour,
      byGroup,
    };
  }

  // Audit Logs
  public logAudit(log: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    const auditLog: AuditLog = {
      ...log,
      id: `log-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditLog);
    // Keep max 200 logs
    if (this.data.auditLogs.length > 200) {
      this.data.auditLogs.pop();
    }
    return auditLog;
  }

  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  // CSV Report Generator
  public generateAttendanceCsv(eventId: string): string {
    const event = this.getEventById(eventId);
    const eventName = event ? event.title : 'Event Attendance';
    const atts = this.getAttendances(eventId);

    const headers = [
      'Participant Number',
      'First Name',
      'Last Name',
      'Phone',
      'Email',
      'Parish Group',
      'Parish Member',
      'Check-in Time (UTC)',
      'Check-in Method',
      'Device',
      'Operator Notes',
    ];

    const rows = atts.map(a => {
      const p = this.getParticipantById(a.participantId);
      const dev = a.deviceId ? this.getDeviceByCode(a.deviceId) : undefined;
      return [
        `"${p?.participantNumber || ''}"`,
        `"${p?.firstName || ''}"`,
        `"${p?.lastName || ''}"`,
        `"${p?.phone || ''}"`,
        `"${p?.email || ''}"`,
        `"${p?.parishGroup || ''}"`,
        `"${p?.isParishMember ? 'YES' : 'NO'}"`,
        `"${a.checkInAt}"`,
        `"${a.method}"`,
        `"${dev ? dev.deviceName : a.deviceId || ''}"`,
        `"${a.notes || ''}"`,
      ].join(',');
    });

    return `# Blessed Sacrament Catholic Parish, Buru-Phase III, Nairobi\n# ${eventName} Attendance Report\n# Generated: ${new Date().toISOString()}\n\n` + [headers.join(','), ...rows].join('\n');
  }
}

export const db = new InMemoryDatabase();
