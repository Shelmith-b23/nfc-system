import {
  ParishEvent,
  Participant,
  NfcCard,
  NfcDevice,
  EventRegistration,
  EventAttendance,
  AuditLog,
  AttendanceStats,
  CheckInResponse,
  User,
} from '../types/index.js';

const BASE_URL = '/api/v1';

export const api = {
  // Auth
  async login(email: string, password?: string): Promise<{ success: boolean; user: User; token: string }> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async getMe(): Promise<{ success: boolean; user: User }> {
    const res = await fetch(`${BASE_URL}/auth/me`);
    return res.json();
  },

  // Events
  async getEvents(): Promise<{ success: boolean; events: ParishEvent[] }> {
    const res = await fetch(`${BASE_URL}/events`);
    return res.json();
  },

  async getEvent(id: string): Promise<{ success: boolean; event: ParishEvent }> {
    const res = await fetch(`${BASE_URL}/events/${id}`);
    return res.json();
  },

  async createEvent(data: Partial<ParishEvent>, actorName?: string): Promise<{ success: boolean; event: ParishEvent }> {
    const res = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actorName }),
    });
    return res.json();
  },

  async updateEvent(id: string, data: Partial<ParishEvent>, actorName?: string): Promise<{ success: boolean; event: ParishEvent }> {
    const res = await fetch(`${BASE_URL}/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actorName }),
    });
    return res.json();
  },

  async publishEvent(id: string, actorName?: string): Promise<{ success: boolean; event: ParishEvent }> {
    const res = await fetch(`${BASE_URL}/events/${id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorName }),
    });
    return res.json();
  },

  async cancelEvent(id: string, actorName?: string): Promise<{ success: boolean; event: ParishEvent }> {
    const res = await fetch(`${BASE_URL}/events/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorName }),
    });
    return res.json();
  },

  // Participants
  async getParticipants(): Promise<{ success: boolean; participants: Participant[] }> {
    const res = await fetch(`${BASE_URL}/participants`);
    return res.json();
  },

  async getParticipant(id: string): Promise<{ success: boolean; participant: Participant; activeCard?: NfcCard }> {
    const res = await fetch(`${BASE_URL}/participants/${id}`);
    return res.json();
  },

  async createParticipant(data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    parishGroup?: string;
    isParishMember: boolean;
  }): Promise<{ success: boolean; participant: Participant }> {
    const res = await fetch(`${BASE_URL}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Registrations
  async getEventRegistrations(
    eventId: string
  ): Promise<{ success: boolean; registrations: (EventRegistration & { participant?: Participant; attendance?: EventAttendance })[] }> {
    const res = await fetch(`${BASE_URL}/events/${eventId}/registrations`);
    return res.json();
  },

  async registerForEvent(
    eventId: string,
    data: {
      participantId?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      parishGroup?: string;
      isParishMember?: boolean;
      actorName?: string;
    }
  ): Promise<{
    success: boolean;
    registration: EventRegistration;
    participant: Participant;
    hasNfcCard: boolean;
    cardSummary?: { cardNumber: string; status: string } | null;
  }> {
    const res = await fetch(`${BASE_URL}/events/${eventId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // NFC Cards
  async getNfcCards(): Promise<{ success: boolean; cards: (NfcCard & { participant?: Participant })[] }> {
    const res = await fetch(`${BASE_URL}/nfc/cards`);
    return res.json();
  },

  async issueNfcCard(data: {
    participantId?: string;
    rawToken?: string;
    customCardNumber?: string;
    actorName?: string;
  }): Promise<{ success: boolean; card: NfcCard }> {
    const res = await fetch(`${BASE_URL}/nfc/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async assignNfcCard(
    cardId: string,
    participantId: string,
    actorName?: string
  ): Promise<{ success: boolean; card: NfcCard }> {
    const res = await fetch(`${BASE_URL}/nfc/cards/${cardId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, actorName }),
    });
    return res.json();
  },

  async revokeNfcCard(
    cardId: string,
    reason: string,
    actorName?: string
  ): Promise<{ success: boolean; card: NfcCard }> {
    const res = await fetch(`${BASE_URL}/nfc/cards/${cardId}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, actorName }),
    });
    return res.json();
  },

  async replaceNfcCard(
    cardId: string,
    newRawToken?: string,
    actorName?: string
  ): Promise<{ success: boolean; oldCard: NfcCard; newCard: NfcCard }> {
    const res = await fetch(`${BASE_URL}/nfc/cards/${cardId}/replace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newRawToken, actorName }),
    });
    return res.json();
  },

  // Check-In API
  async checkInNfc(
    eventId: string,
    params: {
      token: string;
      device_id?: string;
      operator_user_id?: string;
      notes?: string;
      actorName?: string;
    }
  ): Promise<CheckInResponse> {
    const res = await fetch(`${BASE_URL}/events/${eventId}/check-in/nfc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async checkInQr(
    eventId: string,
    params: {
      qr_token?: string;
      registration_code?: string;
      device_id?: string;
      operator_user_id?: string;
      notes?: string;
      actorName?: string;
    }
  ): Promise<CheckInResponse> {
    const res = await fetch(`${BASE_URL}/events/${eventId}/check-in/qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async checkInManual(
    eventId: string,
    params: {
      participant_id: string;
      device_id?: string;
      operator_user_id?: string;
      notes?: string;
      actorName?: string;
    }
  ): Promise<CheckInResponse> {
    const res = await fetch(`${BASE_URL}/events/${eventId}/check-in/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async syncOfflineQueue(
    eventId: string,
    items: any[],
    device_id?: string
  ): Promise<{ success: boolean; processed: number; synced: number; duplicates: number; errors: any[] }> {
    const res = await fetch(`${BASE_URL}/events/${eventId}/check-in/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, device_id }),
    });
    return res.json();
  },

  // Attendance & Stats
  async getEventAttendance(
    eventId: string
  ): Promise<{ success: boolean; attendances: (EventAttendance & { participant?: Participant; device?: NfcDevice })[] }> {
    const res = await fetch(`${BASE_URL}/events/${eventId}/attendance`);
    return res.json();
  },

  async getAttendanceStats(eventId: string): Promise<{ success: boolean; stats: AttendanceStats }> {
    const res = await fetch(`${BASE_URL}/events/${eventId}/attendance/stats`);
    return res.json();
  },

  getCsvReportUrl(eventId: string): string {
    return `${BASE_URL}/events/${eventId}/reports/attendance.csv`;
  },

  // Devices & Audit
  async getDevices(): Promise<{ success: boolean; devices: NfcDevice[] }> {
    const res = await fetch(`${BASE_URL}/devices`);
    return res.json();
  },

  async getAuditLogs(): Promise<{ success: boolean; auditLogs: AuditLog[] }> {
    const res = await fetch(`${BASE_URL}/audit`);
    return res.json();
  },

  async resetDemoDatabase(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/reset-demo`, { method: 'POST' });
    return res.json();
  },
};
