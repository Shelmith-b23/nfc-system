import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  UserPlus,
  Search,
  QrCode,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { ParishEvent, Participant, NfcCard } from '../types/index.js';
import { api } from '../services/api.js';

interface RegistrationDeskProps {
  events: ParishEvent[];
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
  activeDeviceId: string;
  onCheckInCompleted: () => void;
}

type DeskTab = 'SEARCH' | 'WALKIN' | 'CHECK_NFC' | 'SCAN_QR';

export const RegistrationDesk: React.FC<RegistrationDeskProps> = ({
  events,
  selectedEventId,
  setSelectedEventId,
  activeDeviceId,
  onCheckInCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<DeskTab>('SEARCH');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cards, setCards] = useState<NfcCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deskMessage, setDeskMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Walk-in form state
  const [walkin, setWalkin] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    parishGroup: 'YSC',
    isParishMember: true,
  });

  // Card tester state
  const [testCardInput, setTestCardInput] = useState('');
  const [cardTestResult, setCardTestResult] = useState<any>(null);

  // QR input state
  const [qrCodeInput, setQrCodeInput] = useState('');

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  const loadData = async () => {
    try {
      const [partRes, cardRes] = await Promise.all([api.getParticipants(), api.getNfcCards()]);
      if (partRes.success && Array.isArray(partRes.participants)) setParticipants(partRes.participants);
      if (cardRes.success && Array.isArray(cardRes.cards)) setCards(cardRes.cards);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEventId]);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setDeskMessage({ text, type });
    setTimeout(() => setDeskMessage(null), 4500);
  };

  // 1. Manual check-in from desk
  const handleQuickCheckIn = async (participantId: string, name: string) => {
    if (!selectedEvent) return;
    try {
      const res = await api.checkInManual(selectedEvent.id, {
        participant_id: participantId,
        device_id: activeDeviceId,
        notes: 'Verified at Parish Registration Desk',
      });

      if (res.success) {
        showMsg(`✓ Checked in ${name} successfully!`, 'success');
        onCheckInCompleted();
      } else if ('status' in res && res.status === 'ALREADY_CHECKED_IN') {
        showMsg(`⚠ ${name} was already checked in at ${new Date(res.checkedInAt).toLocaleTimeString()}`, 'error');
      } else {
        showMsg(`Error: ${(res as any).error?.message || 'Check-in failed'}`, 'error');
      }
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  // 2. Fast Walk-in registration & check-in
  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      // Register for event (will create participant if new)
      const res = await api.registerForEvent(selectedEvent.id, {
        firstName: walkin.firstName,
        lastName: walkin.lastName,
        phone: walkin.phone,
        parishGroup: walkin.parishGroup,
        isParishMember: walkin.isParishMember,
        actorName: 'Registration Desk Kiosk',
      });

      if (res.success) {
        // Automatically check them in on the spot
        const checkRes = await api.checkInManual(selectedEvent.id, {
          participant_id: res.participant.id,
          device_id: activeDeviceId,
          notes: 'Walk-in registration & verified at Desk',
        });

        showMsg(`✓ Walk-in Registered & Checked In: ${res.participant.firstName} ${res.participant.lastName} (${res.registration.registrationCode})`, 'success');
        setWalkin({ firstName: '', lastName: '', phone: '', parishGroup: 'YSC', isParishMember: true });
        loadData();
        onCheckInCompleted();
      }
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  // 3. Inspect / Test NFC card status
  const handleCheckNfcTag = () => {
    const query = testCardInput.trim().toLowerCase();
    if (!query) return;

    const card = cards.find(
      (c) =>
        c.cardNumber.toLowerCase() === query ||
        c.rawTokenPreview?.toLowerCase() === query ||
        (c.participant && `${c.participant.firstName} ${c.participant.lastName}`.toLowerCase().includes(query))
    );

    if (card) {
      setCardTestResult({
        found: true,
        card,
        participant: card.participant,
      });
    } else {
      setCardTestResult({
        found: false,
        message: 'No active card matching this serial or token was found in the database.',
      });
    }
  };

  // 4. Scan QR code
  const handleScanQr = async () => {
    if (!selectedEvent || !qrCodeInput.trim()) return;
    try {
      const res = await api.checkInQr(selectedEvent.id, {
        qr_token: qrCodeInput.trim(),
        registration_code: qrCodeInput.trim(),
        device_id: activeDeviceId,
      });

      if (res.success) {
        showMsg(`✓ QR Check-in Success: ${res.participant.firstName} ${res.participant.lastName}`, 'success');
        setQrCodeInput('');
        onCheckInCompleted();
      } else if ('status' in res && res.status === 'ALREADY_CHECKED_IN') {
        showMsg(`⚠ Participant was already checked in`, 'error');
      } else {
        showMsg((res as any).error?.message || 'Check-in failed', 'error');
      }
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  const filtered = (participants || []).filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.participantNumber.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Kiosk Header */}
      <div className="bg-gradient-to-r from-[#801B2E] to-[#5C1321] text-white rounded-2xl p-6 shadow-md border border-[#D4AF37]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#EAD098]" />
            <h2 className="font-serif text-xl md:text-2xl font-bold">Event Day Registration Desk</h2>
          </div>
          <p className="text-xs text-[#EAD098]/80 mt-1">
            Simplified helper station for parish volunteers: solve check-in exceptions, register walk-ins, and inspect NFC cards.
          </p>
        </div>

        <div className="bg-black/30 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
          <span className="text-white/60 block text-[10px] uppercase font-semibold">Active Kiosk Desk</span>
          <span className="font-mono text-[#EAD098] font-bold">{activeDeviceId}</span>
        </div>
      </div>

      {/* Message Banner */}
      {deskMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 border animate-fadeIn ${
            deskMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          {deskMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <span>{deskMessage.text}</span>
        </div>
      )}

      {/* Desk Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('SEARCH')}
          className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'SEARCH' ? 'bg-white text-[#801B2E] shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Search & Check In</span>
        </button>

        <button
          onClick={() => setActiveTab('WALKIN')}
          className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'WALKIN' ? 'bg-white text-[#801B2E] shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Walk-In Registration</span>
        </button>

        <button
          onClick={() => setActiveTab('CHECK_NFC')}
          className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'CHECK_NFC' ? 'bg-white text-[#801B2E] shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Inspect NFC Card</span>
        </button>

        <button
          onClick={() => setActiveTab('SCAN_QR')}
          className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'SCAN_QR' ? 'bg-white text-[#801B2E] shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Quick QR Scan</span>
        </button>
      </div>

      {/* --- TAB 1: Search & Check In --- */}
      {activeTab === 'SEARCH' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-base font-bold text-gray-900">
                Participant Registry Lookup
              </h3>
              <p className="text-xs text-gray-500">
                Quickly locate a parishioner and mark their attendance directly at the desk.
              </p>
            </div>
            <div className="w-full sm:w-72 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Type name, phone or BSC#..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">BSC #</th>
                  <th className="py-2.5 px-3">Participant</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Guild</th>
                  <th className="py-2.5 px-3 text-right">Desk Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.slice(0, 8).map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-700">{p.participantNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">{p.firstName} {p.lastName}</td>
                    <td className="py-2.5 px-3 text-gray-600">{p.phone}</td>
                    <td className="py-2.5 px-3 text-gray-600">{p.parishGroup || 'Parishioner'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleQuickCheckIn(p.id, `${p.firstName} ${p.lastName}`)}
                        className="px-3 py-1 bg-[#801B2E] text-white text-xs font-bold rounded-lg hover:bg-[#6B1D2F] shadow-sm"
                      >
                        Check In
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 2: Walk-In Registration --- */}
      {activeTab === 'WALKIN' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 max-w-xl mx-auto space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-serif text-base font-bold text-gray-900">
              Instant Walk-In Registration & Check-In
            </h3>
            <p className="text-xs text-gray-500">
              For participants who did not register online before arriving at Blessed Sacrament.
            </p>
          </div>

          <form onSubmit={handleWalkinSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mary"
                  value={walkin.firstName}
                  onChange={(e) => setWalkin({ ...walkin, firstName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wanjiku"
                  value={walkin.lastName}
                  onChange={(e) => setWalkin({ ...walkin, lastName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                placeholder="+254 7..."
                value={walkin.phone}
                onChange={(e) => setWalkin({ ...walkin, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Parish Group</label>
              <select
                value={walkin.parishGroup}
                onChange={(e) => setWalkin({ ...walkin, parishGroup: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
              >
                <option value="YSC">YSC (Youth)</option>
                <option value="CMA">CMA (Men)</option>
                <option value="MYM">MYM (Young Adults)</option>
                <option value="PMC">PMC (Children)</option>
                <option value="Choir">Choir</option>
                <option value="Altar Servers">Altar Servers</option>
                <option value="Other">Other Parishioner</option>
                <option value="None">Visitor</option>
              </select>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-2.5 bg-[#801B2E] text-white font-bold rounded-xl hover:bg-[#6B1D2F] shadow transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register & Admit Participant</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- TAB 3: Inspect NFC Card --- */}
      {activeTab === 'CHECK_NFC' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 max-w-xl mx-auto space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-serif text-base font-bold text-gray-900">
              NFC Card Status & Diagnostics
            </h3>
            <p className="text-xs text-gray-500">
              Enter or tap a card serial number to verify its assignment, cryptographic hash, and validity.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. BSC-CARD-000124"
              value={testCardInput}
              onChange={(e) => setTestCardInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheckNfcTag()}
              className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
            />
            <button
              onClick={handleCheckNfcTag}
              className="px-4 py-2 bg-[#801B2E] text-white font-bold text-xs rounded-xl hover:bg-[#6B1D2F]"
            >
              Inspect Tag
            </button>
          </div>

          {cardTestResult && (
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-2 text-xs animate-scaleIn">
              {cardTestResult.found ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-[#801B2E]">
                      {cardTestResult.card.cardNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        cardTestResult.card.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {cardTestResult.card.status}
                    </span>
                  </div>
                  {cardTestResult.participant ? (
                    <div className="text-gray-700 space-y-0.5">
                      <p><strong>Passholder:</strong> {cardTestResult.participant.firstName} {cardTestResult.participant.lastName}</p>
                      <p><strong>BSC Number:</strong> {cardTestResult.participant.participantNumber}</p>
                      <p><strong>Guild:</strong> {cardTestResult.participant.parishGroup || 'Parishioner'}</p>
                    </div>
                  ) : (
                    <p className="text-amber-700 font-semibold">Card is not yet assigned to any member.</p>
                  )}
                  <p className="font-mono text-[10px] text-gray-400 pt-1 border-t">
                    SHA-256 Hash: {cardTestResult.card.tokenHash}
                  </p>
                </>
              ) : (
                <p className="text-rose-700 font-semibold">{cardTestResult.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: Quick QR Scan --- */}
      {activeTab === 'SCAN_QR' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 max-w-xl mx-auto space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-serif text-base font-bold text-gray-900">
              Quick QR Pass Check-In
            </h3>
            <p className="text-xs text-gray-500">
              Scan or enter registration code (e.g. <span className="font-mono font-semibold">BSC-EVT-000001</span>) to record entry.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paste QR payload or BSC-EVT-..."
              value={qrCodeInput}
              onChange={(e) => setQrCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScanQr()}
              className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
            />
            <button
              onClick={handleScanQr}
              className="px-5 py-2 bg-[#801B2E] text-white font-bold text-xs rounded-xl hover:bg-[#6B1D2F]"
            >
              Verify & Check In
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
