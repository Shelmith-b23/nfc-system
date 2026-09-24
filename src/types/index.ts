// Data models and API contract for Blessed Sacrament Parish NFC Event Management System

export type UserRole = 'SUPER_ADMIN' | 'EVENT_ADMIN' | 'CHECK_IN_OPERATOR' | 'PARTICIPANT';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export type ParishGroup =
  | 'YSC'
  | 'CMA'
  | 'MYM'
  | 'PMC'
  | 'Choir'
  | 'Altar Servers'
  | 'Liturgical Committee'
  | 'Charismatic Renewal'
  | 'Other'
  | 'None';

export interface Participant {
  id: string;
  userId?: string;
  participantNumber: string; // e.g., BSC-000124
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  parishGroup?: ParishGroup | string;
  isParishMember: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export type NfcCardStatus = 'UNASSIGNED' | 'ACTIVE' | 'REVOKED' | 'LOST' | 'EXPIRED';

export interface NfcCard {
  id: string;
  participantId?: string;
  cardNumber: string; // e.g., BSC-CARD-000124
  tokenHash: string; // SHA-256 hash of opaque token
  rawTokenPreview?: string; // only for dev/testing simulator
  status: NfcCardStatus;
  issuedAt?: string;
  revokedAt?: string;
  replacedByCardId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NfcDevice {
  id: string;
  deviceCode: string; // e.g., BSC-EVENT-01
  deviceName: string; // e.g., Main Entrance
  location: string;
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'REGISTRATION_CLOSED'
  | 'LIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export interface ParishEvent {
  id: string;
  eventCode: string; // e.g., YSC-SPORT-2026
  title: string;
  description: string;
  category: string;
  venue: string;
  startAt: string;
  endAt: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  capacity?: number;
  status: EventStatus;
  allowRegistration: boolean;
  allowNfcCheckin: boolean;
  allowQrCheckin: boolean;
  allowManualCheckin: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RegistrationStatus = 'REGISTERED' | 'WAITLISTED' | 'CANCELLED' | 'CHECKED_IN';

export interface EventRegistration {
  id: string;
  eventId: string;
  participantId: string;
  registrationCode: string; // e.g., BSC-EVT-000124
  qrTokenHash: string;
  rawQrToken?: string; // Used to generate the QR code
  status: RegistrationStatus;
  registeredAt: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CheckInMethod = 'NFC' | 'QR' | 'MANUAL';

export interface EventAttendance {
  id: string;
  eventId: string;
  participantId: string;
  registrationId?: string;
  method: CheckInMethod;
  deviceId?: string;
  checkInAt: string;
  operatorUserId?: string;
  notes?: string;
  clientEventId?: string; // Idempotency key for offline sync
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Check-in API contracts
export interface CheckInSuccessResponse {
  success: true;
  status: 'CHECKED_IN';
  method: CheckInMethod;
  participant: {
    id: string;
    participantNumber: string;
    firstName: string;
    lastName: string;
    parishGroup?: string;
    isParishMember: boolean;
  };
  event: {
    id: string;
    title: string;
    venue: string;
  };
  checkInAt: string;
  attendanceId: string;
}

export interface CheckInDuplicateResponse {
  success: false;
  status: 'ALREADY_CHECKED_IN';
  participant: {
    id: string;
    participantNumber: string;
    firstName: string;
    lastName: string;
  };
  checkedInAt: string;
  method: CheckInMethod;
  error: {
    code: 'ALREADY_CHECKED_IN';
    message: string;
  };
}

export interface CheckInErrorResponse {
  success: false;
  error: {
    code:
      | 'CARD_NOT_REGISTERED'
      | 'CARD_REVOKED'
      | 'CARD_LOST'
      | 'CARD_NOT_ASSIGNED'
      | 'PARTICIPANT_NOT_REGISTERED'
      | 'EVENT_NOT_FOUND'
      | 'EVENT_NOT_ACTIVE'
      | 'CHECKIN_CLOSED'
      | 'DEVICE_NOT_AUTHORIZED'
      | 'INVALID_QR_TOKEN'
      | 'VALIDATION_ERROR'
      | 'SERVER_ERROR';
    message: string;
  };
}

export type CheckInResponse =
  | CheckInSuccessResponse
  | CheckInDuplicateResponse
  | CheckInErrorResponse;

export interface AttendanceStats {
  totalRegistered: number;
  totalCheckedIn: number;
  remaining: number;
  attendanceRate: number;
  byMethod: {
    nfc: number;
    qr: number;
    manual: number;
  };
  byHour: {
    hour: string;
    count: number;
  }[];
  byGroup: {
    group: string;
    registered: number;
    checkedIn: number;
  }[];
}
