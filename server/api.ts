import { Router, Request, Response, NextFunction } from 'express';
import { db, hashToken, hashPassword, verifyPassword } from './db.js';
import type { UserRole } from '../src/types/index.js';

export const apiRouter = Router();

// --- Authentication & Session Middleware ---
export interface AuthenticatedRequest extends Request {
  user?: any;
  sessionToken?: string;
}

export function resolveUserFromAuth(req: Request): { user: any; role: UserRole } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) {
    return null;
  }
  
  // 1. Check cryptographically secure session store
  if (rawToken.startsWith('bsc_sec_')) {
    const session = db.validateSession(rawToken);
    if (session) {
      const user = db.getUserById(session.userId);
      if (user && user.isActive) return { user, role: user.role };
    }
    return null;
  }

  // 2. Backward compatibility with dev preview sessions if valid and active
  if (rawToken.startsWith('parish_session_')) {
    const userId = rawToken.split('_')[2];
    const user = userId ? db.getUserById(userId) : null;
    if (user && user.isActive) return { user, role: user.role };
  }

  return null;
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = resolveUserFromAuth(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!allowedRoles.includes(auth.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Requires role: ${allowedRoles.join(' or ')}` },
      });
    }

    (req as any).user = auth.user;
    next();
  };
}

// --- Auth Endpoints ---
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password, deviceId } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
  }

  const user = db.getUserByEmail(email);
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_INVALID', message: 'Invalid email or password' } });
  }

  // Authoritative password verification using scrypt
  const isMatch = verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_INVALID', message: 'Invalid email or password' } });
  }

  // Create cryptographically secure 24-hour session
  const session = db.createSession(user.id, deviceId);

  // Record login in audit trail
  user.lastLoginAt = new Date().toISOString();
  db.logAudit({
    actorUserId: user.id,
    actorName: `${user.firstName} ${user.lastName}`,
    action: 'USER_LOGIN',
    entityType: 'USER',
    entityId: user.id,
    metadata: { role: user.role, email: user.email, deviceId: deviceId || 'WEB_OR_HANDHELD' },
  });

  const safeUser = { ...user };
  delete (safeUser as any).passwordHash;

  return res.json({
    success: true,
    user: safeUser,
    token: session.token,
    expiresAt: session.expiresAt,
  });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const auth = resolveUserFromAuth(req);
  if (!auth) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Session invalid or expired' } });
  }
  const safeUser = { ...auth.user };
  delete (safeUser as any).passwordHash;
  return res.json({ success: true, user: safeUser });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    db.revokeSession(rawToken);
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});

// --- Public Events Endpoints ---
apiRouter.get('/public/events', (_req: Request, res: Response) => {
  const events = db.getEvents().filter(e => e.status === 'PUBLISHED' || e.status === 'LIVE');
  return res.json({ success: true, events });
});

apiRouter.get('/public/events/:event_code', (req: Request, res: Response) => {
  const event = db.getEventByCode(req.params.event_code);
  if (!event) {
    return res.status(404).json({ success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' } });
  }
  return res.json({ success: true, event });
});

// --- Events CRUD ---
apiRouter.get('/events', (_req: Request, res: Response) => {
  return res.json({ success: true, events: db.getEvents() });
});

apiRouter.get('/events/:id', (req: Request, res: Response) => {
  const event = db.getEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' } });
  }
  return res.json({ success: true, event });
});

apiRouter.post('/events', (req: Request, res: Response) => {
  const { title, description, category, venue, startAt, endAt, registrationOpenAt, registrationCloseAt, capacity, status, allowRegistration, allowNfcCheckin, allowQrCheckin, allowManualCheckin, createdBy, actorName } = req.body;

  if (!title || !venue || !startAt || !endAt) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Title, venue, start date/time, and end date/time are required' },
    });
  }

  if (new Date(endAt) <= new Date(startAt)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Event end time must be after start time' },
    });
  }

  const count = db.getEvents().length + 1;
  const eventCode = req.body.eventCode || `BSC-EVT-${count.toString().padStart(4, '0')}`;

  const event = db.createEvent({
    eventCode,
    title,
    description: description || '',
    category: category || 'General Parish Event',
    venue,
    startAt,
    endAt,
    registrationOpenAt: registrationOpenAt || new Date().toISOString(),
    registrationCloseAt: registrationCloseAt || endAt,
    capacity: capacity ? Number(capacity) : undefined,
    status: status || 'DRAFT',
    allowRegistration: allowRegistration !== false,
    allowNfcCheckin: allowNfcCheckin !== false,
    allowQrCheckin: allowQrCheckin !== false,
    allowManualCheckin: allowManualCheckin !== false,
    createdBy: createdBy || 'usr-admin-1',
  }, createdBy, actorName);

  return res.status(201).json({ success: true, event });
});

apiRouter.patch('/events/:id', (req: Request, res: Response) => {
  try {
    const updated = db.updateEvent(req.params.id, req.body, req.body.actorUserId, req.body.actorName);
    return res.json({ success: true, event: updated });
  } catch (err: any) {
    return res.status(404).json({ success: false, error: { code: 'EVENT_NOT_FOUND', message: err.message } });
  }
});

apiRouter.post('/events/:id/publish', (req: Request, res: Response) => {
  try {
    const updated = db.updateEvent(req.params.id, { status: 'PUBLISHED' }, req.body.actorUserId, req.body.actorName);
    return res.json({ success: true, event: updated });
  } catch (err: any) {
    return res.status(404).json({ success: false, error: { code: 'EVENT_NOT_FOUND', message: err.message } });
  }
});

apiRouter.post('/events/:id/cancel', (req: Request, res: Response) => {
  try {
    const updated = db.updateEvent(req.params.id, { status: 'CANCELLED' }, req.body.actorUserId, req.body.actorName);
    return res.json({ success: true, event: updated });
  } catch (err: any) {
    return res.status(404).json({ success: false, error: { code: 'EVENT_NOT_FOUND', message: err.message } });
  }
});

// --- Participants CRUD ---
apiRouter.get('/participants', (_req: Request, res: Response) => {
  return res.json({ success: true, participants: db.getParticipants() });
});

apiRouter.get('/participants/:id', (req: Request, res: Response) => {
  const p = db.getParticipantById(req.params.id);
  if (!p) {
    return res.status(404).json({ success: false, error: { code: 'PARTICIPANT_NOT_FOUND', message: 'Participant not found' } });
  }
  const card = db.getNfcCardByParticipant(p.id);
  return res.json({ success: true, participant: p, activeCard: card });
});

apiRouter.post('/participants', (req: Request, res: Response) => {
  const { firstName, lastName, phone, email, parishGroup, isParishMember } = req.body;
  if (!firstName || !lastName || !phone) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'First name, last name, and phone number are required' },
    });
  }

  const p = db.createParticipant({
    firstName,
    lastName,
    phone,
    email,
    parishGroup,
    isParishMember: Boolean(isParishMember),
  });

  return res.status(201).json({ success: true, participant: p });
});

// --- Registrations ---
apiRouter.get('/events/:id/registrations', (req: Request, res: Response) => {
  const regs = db.getRegistrations(req.params.id);
  // enrich with participant details
  const enriched = regs.map(r => ({
    ...r,
    participant: db.getParticipantById(r.participantId),
    attendance: db.getAttendance(r.eventId, r.participantId),
  }));
  return res.json({ success: true, registrations: enriched });
});

apiRouter.post('/events/:id/register', (req: Request, res: Response) => {
  const eventId = req.params.id;
  const event = db.getEventById(eventId);
  if (!event) {
    return res.status(404).json({ success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' } });
  }

  let participantId = req.body.participantId;

  // If participant details were passed directly in registration form:
  if (!participantId) {
    const { firstName, lastName, phone, email, parishGroup, isParishMember } = req.body;
    if (!firstName || !lastName || !phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'First name, last name, and phone are required to register' },
      });
    }

    // Check if participant exists by phone
    let participant = db.getParticipants().find(p => p.phone.replace(/\s+/g, '') === phone.replace(/\s+/g, ''));
    if (!participant) {
      participant = db.createParticipant({ firstName, lastName, phone, email, parishGroup, isParishMember: Boolean(isParishMember) });
    }
    participantId = participant.id;
  }

  const reg = db.registerParticipantForEvent(eventId, participantId, req.body.actorUserId, req.body.actorName);
  const participant = db.getParticipantById(participantId);
  const card = db.getNfcCardByParticipant(participantId);

  return res.status(201).json({
    success: true,
    registration: reg,
    participant,
    hasNfcCard: Boolean(card),
    cardSummary: card ? { cardNumber: card.cardNumber, status: card.status } : null,
  });
});

// --- NFC Cards Management ---
apiRouter.get('/nfc/cards', (_req: Request, res: Response) => {
  const cards = db.getNfcCards().map(c => ({
    ...c,
    participant: c.participantId ? db.getParticipantById(c.participantId) : undefined,
  }));
  return res.json({ success: true, cards });
});

apiRouter.post('/nfc/cards', (req: Request, res: Response) => {
  const { participantId, rawToken, customCardNumber, actorUserId, actorName } = req.body;
  const card = db.issueNfcCard({
    participantId,
    rawToken,
    customCardNumber,
    actorUserId,
    actorName,
  });
  return res.status(201).json({ success: true, card });
});

apiRouter.post('/nfc/cards/:id/assign', (req: Request, res: Response) => {
  const { participantId, actorUserId, actorName } = req.body;
  if (!participantId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'participantId is required' } });
  }

  try {
    const card = db.assignNfcCard(req.params.id, participantId, actorUserId, actorName);
    return res.json({ success: true, card });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: 'ASSIGN_ERROR', message: err.message } });
  }
});

apiRouter.post('/nfc/cards/:id/revoke', (req: Request, res: Response) => {
  const { reason, actorUserId, actorName } = req.body;
  try {
    const card = db.revokeNfcCard(req.params.id, reason || 'Administrative revocation', actorUserId, actorName);
    return res.json({ success: true, card });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: 'REVOKE_ERROR', message: err.message } });
  }
});

apiRouter.post('/nfc/cards/:id/replace', (req: Request, res: Response) => {
  const { newRawToken, actorUserId, actorName } = req.body;
  try {
    const result = db.replaceNfcCard(req.params.id, newRawToken, actorUserId, actorName);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: 'REPLACE_ERROR', message: err.message } });
  }
});

// --- CHECK-IN API: PRIMARY WORKFLOWS (NFC, QR, MANUAL, OFFLINE SYNC) ---

// 1. NFC Check-In: POST /api/v1/events/:id/check-in/nfc
apiRouter.post('/events/:id/check-in/nfc', requireRole(['SUPER_ADMIN', 'EVENT_ADMIN', 'CHECK_IN_OPERATOR']), (req: Request, res: Response) => {
  const eventId = req.params.id;
  const token = req.body.token || req.body.nfc_token;
  const { device_id, deviceId, operator_user_id, notes, actorName, clientEventId, client_event_id } = req.body;
  const resolvedClientEventId = clientEventId || client_event_id;
  const resolvedDeviceId = deviceId || device_id || 'BSC-EVENT-01';
  const authenticatedUser = (req as any).user;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'NFC token is required' },
    });
  }

  // Device Authorization Check
  const device = db.getDeviceByCode(resolvedDeviceId);
  if (!device || !device.isActive) {
    return res.status(403).json({
      success: false,
      error: { code: 'DEVICE_NOT_AUTHORIZED', message: `Gate device '${resolvedDeviceId}' is not authorized or is inactive.` },
    });
  }

  const event = db.getEventById(eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
    });
  }

  if (event.status !== 'LIVE' && event.status !== 'PUBLISHED') {
    return res.status(400).json({
      success: false,
      error: { code: 'CHECKIN_CLOSED', message: 'This event is not accepting check-ins at this time.' },
    });
  }

  // Resolve card by token hash
  const card = db.getNfcCardByToken(token);
  if (!card) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CARD_NOT_REGISTERED',
        message: 'This NFC card is not registered. Please visit the registration desk.',
      },
    });
  }

  if (card.status === 'REVOKED') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CARD_REVOKED',
        message: 'This NFC card is revoked and no longer active. Please visit the registration desk.',
      },
    });
  }

  if (card.status === 'LOST') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CARD_LOST',
        message: 'This card was reported lost. Please contact the parish administration.',
      },
    });
  }

  if (card.status === 'UNASSIGNED' || !card.participantId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CARD_NOT_ASSIGNED',
        message: 'This NFC card has not been assigned to a participant yet.',
      },
    });
  }

  const participant = db.getParticipantById(card.participantId);
  if (!participant) {
    return res.status(404).json({
      success: false,
      error: { code: 'PARTICIPANT_NOT_FOUND', message: 'Participant profile not found' },
    });
  }

  // Check if participant registered for this event
  const registration = db.getRegistration(eventId, participant.id);
  if (!registration && !event.allowRegistration) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'PARTICIPANT_NOT_REGISTERED',
        message: 'This participant is not registered for this event and walk-in registration is closed.',
      },
    });
  }

  // Record attendance with authoritative uniqueness check and clientEventId idempotency
  const result = db.recordAttendance({
    eventId,
    participantId: participant.id,
    method: 'NFC',
    deviceId: resolvedDeviceId,
    operatorUserId: authenticatedUser?.id || operator_user_id || 'usr-operator-1',
    notes: notes || `Card ${card.cardNumber} tapped at ${device.location}`,
    clientEventId: resolvedClientEventId,
    actorName: authenticatedUser ? `${authenticatedUser.firstName} ${authenticatedUser.lastName}` : (actorName || 'NFC Entrance Reader'),
  });

  if (result.duplicate && result.existingAttendance) {
    return res.json({
      success: false,
      status: 'ALREADY_CHECKED_IN',
      participant: {
        id: participant.id,
        participantNumber: participant.participantNumber,
        firstName: participant.firstName,
        lastName: participant.lastName,
      },
      checkedInAt: result.existingAttendance.checkInAt,
      method: result.existingAttendance.method,
      clientEventId: result.existingAttendance.clientEventId,
      error: {
        code: 'ALREADY_CHECKED_IN',
        message: `${participant.firstName} ${participant.lastName} (${participant.participantNumber}) was already checked in at ${new Date(result.existingAttendance.checkInAt).toLocaleTimeString()}`,
      },
    });
  }

  if (!result.success || !result.attendance) {
    return res.status(400).json({
      success: false,
      error: result.error || { code: 'SERVER_ERROR', message: 'Could not record check-in' },
    });
  }

  return res.json({
    success: true,
    status: 'CHECKED_IN',
    method: 'NFC',
    clientEventId: result.attendance.clientEventId,
    participant: {
      id: participant.id,
      participantNumber: participant.participantNumber,
      firstName: participant.firstName,
      lastName: participant.lastName,
      parishGroup: participant.parishGroup,
      isParishMember: participant.isParishMember,
    },
    event: {
      id: event.id,
      title: event.title,
      venue: event.venue,
    },
    checkInAt: result.attendance.checkInAt,
    attendanceId: result.attendance.id,
  });
});

// 2. QR Check-In Fallback: POST /api/v1/events/:id/check-in/qr
apiRouter.post('/events/:id/check-in/qr', requireRole(['SUPER_ADMIN', 'EVENT_ADMIN', 'CHECK_IN_OPERATOR']), (req: Request, res: Response) => {
  const eventId = req.params.id;
  const { qr_token, token, registration_code, device_id, deviceId, notes } = req.body;
  const resolvedDeviceId = deviceId || device_id || 'BSC-EVENT-02';
  const authenticatedUser = (req as any).user;

  // Device Authorization Check
  const device = db.getDeviceByCode(resolvedDeviceId);
  if (!device || !device.isActive) {
    return res.status(403).json({
      success: false,
      error: { code: 'DEVICE_NOT_AUTHORIZED', message: `Gate device '${resolvedDeviceId}' is not authorized or is inactive.` },
    });
  }

  const rawQr = qr_token || token;
  let reg: any = null;

  if (rawQr) {
    reg = db.getRegistrationByQrToken(rawQr);
  } else if (registration_code) {
    reg = db.getRegistrationByCode(registration_code);
  }

  if (!reg) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'INVALID_QR_TOKEN',
        message: 'Invalid or unrecognized QR registration code.',
      },
    });
  }

  if (reg.eventId !== eventId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'This QR pass is for a different parish event.',
      },
    });
  }

  const participant = db.getParticipantById(reg.participantId);
  if (!participant) {
    return res.status(404).json({
      success: false,
      error: { code: 'PARTICIPANT_NOT_FOUND', message: 'Participant not found' },
    });
  }

  const result = db.recordAttendance({
    eventId,
    participantId: participant.id,
    method: 'QR',
    deviceId: resolvedDeviceId,
    operatorUserId: authenticatedUser.id,
    notes: notes || `QR pass ${reg.registrationCode} scanned at ${device.location}`,
    actorName: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`,
  });

  if (result.duplicate && result.existingAttendance) {
    return res.json({
      success: false,
      status: 'ALREADY_CHECKED_IN',
      participant: {
        id: participant.id,
        participantNumber: participant.participantNumber,
        firstName: participant.firstName,
        lastName: participant.lastName,
      },
      checkedInAt: result.existingAttendance.checkInAt,
      method: result.existingAttendance.method,
      error: {
        code: 'ALREADY_CHECKED_IN',
        message: `${participant.firstName} ${participant.lastName} was already checked in.`,
      },
    });
  }

  const event = db.getEventById(eventId)!;
  return res.json({
    success: true,
    status: 'CHECKED_IN',
    method: 'QR',
    participant: {
      id: participant.id,
      participantNumber: participant.participantNumber,
      firstName: participant.firstName,
      lastName: participant.lastName,
      parishGroup: participant.parishGroup,
      isParishMember: participant.isParishMember,
    },
    event: {
      id: event.id,
      title: event.title,
      venue: event.venue,
    },
    checkInAt: result.attendance!.checkInAt,
    attendanceId: result.attendance!.id,
  });
});

// 3. Manual Check-In Fallback: POST /api/v1/events/:id/check-in/manual
apiRouter.post('/events/:id/check-in/manual', requireRole(['SUPER_ADMIN', 'EVENT_ADMIN', 'CHECK_IN_OPERATOR']), (req: Request, res: Response) => {
  const eventId = req.params.id;
  const { participant_id, device_id, deviceId, notes } = req.body;
  const resolvedDeviceId = deviceId || device_id || 'BSC-EVENT-03';
  const authenticatedUser = (req as any).user;

  // Device Authorization Check
  const device = db.getDeviceByCode(resolvedDeviceId);
  if (!device || !device.isActive) {
    return res.status(403).json({
      success: false,
      error: { code: 'DEVICE_NOT_AUTHORIZED', message: `Gate device '${resolvedDeviceId}' is not authorized or is inactive.` },
    });
  }

  if (!participant_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'participant_id is required' },
    });
  }

  const participant = db.getParticipantById(participant_id);
  if (!participant) {
    return res.status(404).json({
      success: false,
      error: { code: 'PARTICIPANT_NOT_FOUND', message: 'Participant not found' },
    });
  }

  const result = db.recordAttendance({
    eventId,
    participantId: participant.id,
    method: 'MANUAL',
    deviceId: resolvedDeviceId,
    operatorUserId: authenticatedUser.id,
    notes: notes || `Manual verification at ${device.location}`,
    actorName: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`,
  });

  if (result.duplicate && result.existingAttendance) {
    return res.json({
      success: false,
      status: 'ALREADY_CHECKED_IN',
      participant: {
        id: participant.id,
        participantNumber: participant.participantNumber,
        firstName: participant.firstName,
        lastName: participant.lastName,
      },
      checkedInAt: result.existingAttendance.checkInAt,
      method: result.existingAttendance.method,
      error: {
        code: 'ALREADY_CHECKED_IN',
        message: `${participant.firstName} ${participant.lastName} was already checked in.`,
      },
    });
  }

  const event = db.getEventById(eventId)!;
  return res.json({
    success: true,
    status: 'CHECKED_IN',
    method: 'MANUAL',
    participant: {
      id: participant.id,
      participantNumber: participant.participantNumber,
      firstName: participant.firstName,
      lastName: participant.lastName,
      parishGroup: participant.parishGroup,
      isParishMember: participant.isParishMember,
    },
    event: {
      id: event.id,
      title: event.title,
      venue: event.venue,
    },
    checkInAt: result.attendance!.checkInAt,
    attendanceId: result.attendance!.id,
  });
});

// 4. Offline Queue Sync: POST /api/v1/events/:id/check-in/sync
apiRouter.post('/events/:id/check-in/sync', requireRole(['SUPER_ADMIN', 'EVENT_ADMIN', 'CHECK_IN_OPERATOR']), (req: Request, res: Response) => {
  const eventId = req.params.id;
  const { items, device_id, deviceId } = req.body;
  const resolvedDeviceId = deviceId || device_id || 'BSC-EVENT-01';
  const authenticatedUser = (req as any).user;

  // Device Authorization Check
  const device = db.getDeviceByCode(resolvedDeviceId);
  if (!device || !device.isActive) {
    return res.status(403).json({
      success: false,
      error: { code: 'DEVICE_NOT_AUTHORIZED', message: `Gate device '${resolvedDeviceId}' is not authorized or is inactive.` },
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.json({ success: true, processed: 0, synced: 0, duplicates: 0, errors: [] });
  }

  let synced = 0;
  let duplicates = 0;
  const errors: any[] = [];

  items.forEach((item: any) => {
    try {
      const card = db.getNfcCardByToken(item.token);
      if (!card || !card.participantId) {
        errors.push({ token: item.token ? `${item.token.slice(0, 10)}...` : 'unknown', error: 'Card not found or unassigned' });
        return;
      }

      const itemDeviceId = item.deviceId || resolvedDeviceId;
      const itemDev = db.getDeviceByCode(itemDeviceId);
      if (!itemDev || !itemDev.isActive) {
        errors.push({ token: `${item.token.slice(0, 10)}...`, error: `Device '${itemDeviceId}' not authorized` });
        return;
      }

      const result = db.recordAttendance({
        eventId,
        participantId: card.participantId,
        method: item.method || 'NFC',
        deviceId: itemDeviceId,
        operatorUserId: authenticatedUser.id,
        clientEventId: item.clientEventId,
        notes: `Offline sync record (queued at ${item.localTimestamp || 'unknown'})`,
        actorName: `${authenticatedUser.firstName} ${authenticatedUser.lastName} (Offline Sync)`,
      });

      if (result.duplicate || (result as any).isReplay) {
        duplicates++;
      } else if (result.success) {
        synced++;
      } else {
        errors.push({ token: item.token ? `${item.token.slice(0, 10)}...` : 'unknown', error: result.error?.message });
      }
    } catch (err: any) {
      errors.push({ token: item.token ? `${item.token.slice(0, 10)}...` : 'unknown', error: err.message });
    }
  });

  return res.json({
    success: true,
    processed: items.length,
    synced,
    duplicates,
    errors,
  });
});

// --- Attendance Feed & Stats ---
apiRouter.get('/events/:id/attendance', (req: Request, res: Response) => {
  const atts = db.getAttendances(req.params.id);
  const enriched = atts.map(a => ({
    ...a,
    participant: db.getParticipantById(a.participantId),
    device: a.deviceId ? db.getDeviceByCode(a.deviceId) : undefined,
  }));
  return res.json({ success: true, attendances: enriched });
});

apiRouter.get('/events/:id/attendance/stats', (req: Request, res: Response) => {
  const stats = db.getAttendanceStats(req.params.id);
  return res.json({ success: true, stats });
});

// --- Reports ---
apiRouter.get('/events/:id/reports/attendance.csv', (req: Request, res: Response) => {
  const csv = db.generateAttendanceCsv(req.params.id);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${req.params.id}.csv"`);
  return res.send(csv);
});

// --- Devices ---
apiRouter.get('/devices', (_req: Request, res: Response) => {
  return res.json({ success: true, devices: db.getDevices() });
});

apiRouter.post('/devices/enroll', requireRole(['SUPER_ADMIN', 'EVENT_ADMIN', 'CHECK_IN_OPERATOR']), (req: Request, res: Response) => {
  const { deviceCode, deviceName, location } = req.body;
  if (!deviceCode || !deviceName) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'deviceCode and deviceName are required for device enrollment' },
    });
  }

  const device = db.registerOrEnrollDevice({
    deviceCode,
    deviceName,
    location: location || 'Parish Entrance Gate',
  });

  const authenticatedUser = (req as any).user;
  db.logAudit({
    actorUserId: authenticatedUser?.id || 'usr-admin-1',
    actorName: authenticatedUser ? `${authenticatedUser.firstName} ${authenticatedUser.lastName}` : 'Gate Admin',
    action: 'DEVICE_ENROLLED',
    entityType: 'DEVICE',
    entityId: device.id,
    metadata: { deviceCode: device.deviceCode, deviceName: device.deviceName, location: device.location },
  });

  return res.status(201).json({ success: true, device });
});

// --- Audit Logs ---
apiRouter.get('/audit', (_req: Request, res: Response) => {
  return res.json({ success: true, auditLogs: db.getAuditLogs() });
});

// --- Reset / Seed Tool ---
apiRouter.post('/reset-demo', (_req: Request, res: Response) => {
  db.resetToSeed();
  return res.json({ success: true, message: 'Database reset to canonical seed state' });
});
