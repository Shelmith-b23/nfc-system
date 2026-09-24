import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react';
import { ParishEvent, Participant, NfcCard, CheckInResponse } from '../types/index.js';
import { api } from '../services/api.js';

interface CheckInKioskProps {
  events: ParishEvent[];
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
  activeDeviceId: string;
  isOffline: boolean;
  offlineQueue?: any[];
  setOfflineQueue?: React.Dispatch<React.SetStateAction<any[]>>;
  onCheckInCompleted?: () => void;
  onCheckInSuccess?: () => void;
}

type CheckInMode = 'NFC' | 'QR' | 'MANUAL';

export const CheckInKiosk: React.FC<CheckInKioskProps> = ({
  events = [],
  selectedEventId,
  setSelectedEventId,
  activeDeviceId,
  isOffline = false,
  offlineQueue = [],
  setOfflineQueue,
  onCheckInCompleted,
  onCheckInSuccess,
}) => {
  const notifyCheckInComplete = () => {
    if (onCheckInCompleted) onCheckInCompleted();
    if (onCheckInSuccess) onCheckInSuccess();
  };
  const [mode, setMode] = useState<CheckInMode>('NFC');
  const [loading, setLoading] = useState(false);
  const [webNfcSupported, setWebNfcSupported] = useState<boolean>(false);
  const [webNfcActive, setWebNfcActive] = useState<boolean>(false);

  // Result state (shown for 2.5 seconds or until cleared)
  const [checkInResult, setCheckInResult] = useState<CheckInResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Stats for the selected event
  const [checkedInCount, setCheckedInCount] = useState<number>(0);
  const [totalRegistered, setTotalRegistered] = useState<number>(0);

  // Manual fallback search
  const [manualQuery, setManualQuery] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allCards, setAllCards] = useState<NfcCard[]>([]);

  // QR fallback input
  const [qrInput, setQrInput] = useState('');

  // Auto-reset timer ref
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  // Refresh counts
  const refreshStats = async () => {
    if (!selectedEvent) return;
    try {
      const res = await api.getAttendanceStats(selectedEvent.id);
      if (res.success) {
        setCheckedInCount(res.stats.totalCheckedIn);
        setTotalRegistered(res.stats.totalRegistered);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Check Web NFC availability
  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setWebNfcSupported(true);
    }
    refreshStats();
    loadParticipantsAndCards();
  }, [selectedEventId]);

  const loadParticipantsAndCards = async () => {
    try {
      const [partRes, cardRes] = await Promise.all([api.getParticipants(), api.getNfcCards()]);
      if (partRes.success) setParticipants(partRes.participants);
      if (cardRes.success) setAllCards(cardRes.cards);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerResultDisplay = (result: CheckInResponse) => {
    setCheckInResult(result);
    refreshStats();
    if (onCheckInCompleted) onCheckInCompleted();

    // Sound effect simulation using Web Audio API
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (result.success) {
        // High pleasant ding
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if ('status' in result && result.status === 'ALREADY_CHECKED_IN') {
        // Double warning beep
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(349.23, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        // Low error buzz
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // Audio context might be restricted before user gesture
    }

    // Auto reset after 2.5 seconds to return to ready state
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setCheckInResult(null);
    }, 2800);
  };

  // Perform NFC tap
  const handleNfcTap = async (rawToken: string, cardLabel?: string) => {
    if (!selectedEvent) return;
    setLoading(true);

    if (isOffline) {
      // OFFLINE MODE: Queue tap locally
      const queueItem = {
        token: rawToken,
        method: 'NFC',
        deviceId: activeDeviceId,
        clientEventId: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        localTimestamp: new Date().toISOString(),
        cardLabel: cardLabel || 'NFC Card',
      };
      if (setOfflineQueue) {
        setOfflineQueue((prev) => [...(prev || []), queueItem]);
      }
      setStatusMessage(`✓ OFFLINE: Queued tap for ${cardLabel || 'Card'}. Will sync when online.`);
      setCheckedInCount((c) => c + 1);
      setLoading(false);
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    try {
      const res = await api.checkInNfc(selectedEvent.id, {
        token: rawToken,
        device_id: activeDeviceId,
      });
      triggerResultDisplay(res);
    } catch (err: any) {
      triggerResultDisplay({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message || 'Connection failed' },
      });
    } finally {
      setLoading(false);
    }
  };

  // Perform QR Check-in
  const handleQrCheckIn = async (tokenOrCode: string) => {
    if (!selectedEvent || !tokenOrCode.trim()) return;
    setLoading(true);
    try {
      const res = await api.checkInQr(selectedEvent.id, {
        qr_token: tokenOrCode.trim(),
        registration_code: tokenOrCode.trim(),
        device_id: activeDeviceId,
      });
      triggerResultDisplay(res);
      setQrInput('');
    } catch (err: any) {
      triggerResultDisplay({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message || 'Check-in failed' },
      });
    } finally {
      setLoading(false);
    }
  };

  // Perform Manual Check-in
  const handleManualCheckIn = async (participantId: string) => {
    if (!selectedEvent) return;
    setLoading(true);
    try {
      const res = await api.checkInManual(selectedEvent.id, {
        participant_id: participantId,
        device_id: activeDeviceId,
        notes: 'Manual desk verification',
      });
      triggerResultDisplay(res);
    } catch (err: any) {
      triggerResultDisplay({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message },
      });
    } finally {
      setLoading(false);
    }
  };

  // Offline queue sync
  const handleSyncOffline = async () => {
    const queue = offlineQueue || [];
    if (!selectedEvent || queue.length === 0) return;
    setLoading(true);
    try {
      const res = await api.syncOfflineQueue(selectedEvent.id, queue, activeDeviceId);
      if (res.success) {
        setStatusMessage(
          `✓ SYNC COMPLETE: ${res.synced} check-ins uploaded successfully (${res.duplicates} duplicate conflicts resolved safely without double entries).`
        );
        if (setOfflineQueue) {
          setOfflineQueue([]);
        }
        refreshStats();
        notifyCheckInComplete();
      }
    } catch (err: any) {
      setStatusMessage(`Sync error: ${err.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Start real Web NFC reader if device supports it
  const startWebNfc = async () => {
    if (!('NDEFReader' in window)) return;
    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      setWebNfcActive(true);
      ndef.addEventListener('reading', ({ message, serialNumber }: any) => {
        let token = serialNumber;
        for (const record of message.records) {
          const textDecoder = new TextDecoder(record.encoding);
          token = textDecoder.decode(record.data);
        }
        handleNfcTap(token, `Hardware Tag ${serialNumber}`);
      });
    } catch (err) {
      console.warn('Web NFC scan error:', err);
      alert('Could not start Web NFC scanner. Please use simulated tap or Android app.');
    }
  };

  // Sample cards for quick interactive testing
  const testCards = [
    {
      name: 'Shelmith Wambui',
      number: 'BSC-000124',
      token: 'BSCNFC:v1:982f1b4a7d6e5c3a',
      status: 'Ready to Check In (Unchecked)',
      color: 'border-emerald-500 bg-emerald-50/70',
      badge: 'TEST SUCCESS',
    },
    {
      name: 'Brian Mwangi',
      number: 'BSC-000125',
      token: 'BSCNFC:v1:4c8a2e1f9b3d7a6e',
      status: 'Already Checked In',
      color: 'border-amber-500 bg-amber-50/70',
      badge: 'TEST DUPLICATE',
    },
    {
      name: 'Agnes Muthoni',
      number: 'BSC-000129',
      token: 'BSCNFC:v1:1e7d3a9b6c2f4a8e',
      status: 'Revoked Card (Lost/Inactive)',
      color: 'border-rose-400 bg-rose-50/70',
      badge: 'TEST REVOKED',
    },
    {
      name: 'Blank Unassigned Tag',
      number: 'BSC-CARD-000132',
      token: 'BSCNFC:v1:blank_unassigned_tag_01',
      status: 'Not Assigned to Member',
      color: 'border-gray-400 bg-gray-50/70',
      badge: 'TEST UNASSIGNED',
    },
  ];

  const filteredParticipants = participants.filter((p) => {
    const q = manualQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.participantNumber.toLowerCase().includes(q) ||
      (p.parishGroup && p.parishGroup.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Event Selector & Reader Status Banner */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D4AF37]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-[#801B2E] uppercase tracking-wider block">
            Selected Active Event
          </span>
          <div className="flex items-center gap-3 mt-1">
            <select
              id="kiosk-event-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="font-serif text-lg md:text-xl font-bold text-gray-900 bg-transparent border-b-2 border-[#801B2E] pb-0.5 focus:outline-none cursor-pointer"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title} ({evt.status})
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Venue: <span className="font-medium text-gray-800">{selectedEvent?.venue}</span> • Device:{' '}
            <span className="font-mono text-[#801B2E] font-semibold">{activeDeviceId}</span>
          </p>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-6">
          <div className="text-center">
            <span className="text-[10px] text-gray-400 uppercase font-semibold block tracking-wider">
              Checked In
            </span>
            <span className="font-serif text-2xl md:text-3xl font-extrabold text-[#801B2E]">
              {checkedInCount}
            </span>
          </div>
          <div className="text-gray-300 font-light text-2xl">/</div>
          <div className="text-center">
            <span className="text-[10px] text-gray-400 uppercase font-semibold block tracking-wider">
              Registered
            </span>
            <span className="font-serif text-xl md:text-2xl font-bold text-gray-700">
              {totalRegistered}
            </span>
          </div>
          <button
            onClick={refreshStats}
            className="p-2 rounded-lg text-gray-400 hover:text-[#801B2E] hover:bg-gray-100 transition-colors"
            title="Refresh counts"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Offline Alert & Sync banner if queue exists */}
      {(offlineQueue?.length || 0) > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between gap-4 text-amber-900">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">
                {(offlineQueue?.length || 0)} Check-ins Queued in Local Offline Storage
              </p>
              <p className="text-xs text-amber-800">
                Ready to synchronize idempotently. Tap records were stored safely on this device.
              </p>
            </div>
          </div>
          <button
            id="sync-offline-queue-btn"
            onClick={handleSyncOffline}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Queue Now</span>
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Check-In Mode Switcher: NFC (Primary) | QR Fallback | Manual Search Fallback */}
      <div className="flex border-b border-gray-200">
        <button
          id="mode-tab-nfc"
          onClick={() => setMode('NFC')}
          className={`flex-1 py-3 px-4 text-center font-semibold text-sm border-b-2 transition-all flex items-center justify-center gap-2 ${
            mode === 'NFC'
              ? 'border-[#801B2E] text-[#801B2E] bg-white shadow-sm font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Radio className="w-4 h-4 text-[#801B2E]" />
          <span>NFC Reader (Primary)</span>
        </button>

        <button
          id="mode-tab-qr"
          onClick={() => setMode('QR')}
          className={`flex-1 py-3 px-4 text-center font-semibold text-sm border-b-2 transition-all flex items-center justify-center gap-2 ${
            mode === 'QR'
              ? 'border-[#801B2E] text-[#801B2E] bg-white shadow-sm font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>QR Fallback Scanner</span>
        </button>

        <button
          id="mode-tab-manual"
          onClick={() => setMode('MANUAL')}
          className={`flex-1 py-3 px-4 text-center font-semibold text-sm border-b-2 transition-all flex items-center justify-center gap-2 ${
            mode === 'MANUAL'
              ? 'border-[#801B2E] text-[#801B2E] bg-white shadow-sm font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Manual Participant Search</span>
        </button>
      </div>

      {/* --- RESULT FEEDBACK MODAL / OVERLAY --- */}
      {checkInResult && (
        <div
          id="checkin-feedback-banner"
          className="animate-scaleIn transition-all duration-200"
        >
          {checkInResult.success ? (
            // Success Result
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-2xl p-6 md:p-8 shadow-xl text-center space-y-3 relative overflow-hidden">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto border-2 border-white/40 shadow-inner">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <div>
                <span className="text-xs uppercase font-bold tracking-[0.2em] text-emerald-200 block">
                  Attendance Recorded
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-extrabold mt-0.5">
                  ✓ CHECK-IN SUCCESS
                </h2>
              </div>

              <div className="bg-white/10 rounded-xl p-4 max-w-md mx-auto border border-white/20">
                <h3 className="text-xl font-bold text-white">
                  {checkInResult.participant.firstName} {checkInResult.participant.lastName}
                </h3>
                <p className="font-mono text-emerald-200 text-sm font-semibold mt-0.5">
                  {checkInResult.participant.participantNumber} • {checkInResult.participant.parishGroup || 'Parishioner'}
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-white/80 mt-2 pt-2 border-t border-white/15">
                  <span>Method: <strong className="text-white">{checkInResult.method}</strong></span>
                  <span>•</span>
                  <span>
                    Time: <strong className="text-white">{new Date(checkInResult.checkInAt).toLocaleTimeString()}</strong>
                  </span>
                </div>
              </div>

              <p className="font-serif text-lg font-bold text-[#EAD098] tracking-widest uppercase">
                WELCOME! KARIBU SANA
              </p>

              <button
                onClick={() => setCheckInResult(null)}
                className="text-xs text-white/60 hover:text-white underline pt-1 block mx-auto"
              >
                Ready for next participant (auto-clearing...)
              </button>
            </div>
          ) : checkInResult.status === 'ALREADY_CHECKED_IN' ? (
            // Duplicate Warning
            <div className="bg-gradient-to-br from-amber-600 to-amber-800 text-white rounded-2xl p-6 md:p-8 shadow-xl text-center space-y-3 relative">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto border-2 border-white/40">
                <AlertTriangle className="w-10 h-10 text-white" />
              </div>
              <div>
                <span className="text-xs uppercase font-bold tracking-[0.2em] text-amber-200 block">
                  Duplicate Prevention
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-extrabold mt-0.5">
                  ⚠ ALREADY CHECKED IN
                </h2>
              </div>

              <div className="bg-white/10 rounded-xl p-4 max-w-md mx-auto border border-white/20">
                <h3 className="text-xl font-bold text-white">
                  {checkInResult.participant.firstName} {checkInResult.participant.lastName}
                </h3>
                <p className="font-mono text-amber-200 text-sm font-semibold mt-0.5">
                  {checkInResult.participant.participantNumber}
                </p>
                <p className="text-xs text-white/90 mt-2">
                  Previously checked in at:{' '}
                  <strong className="text-white">
                    {new Date(checkInResult.checkedInAt).toLocaleTimeString()}
                  </strong>{' '}
                  ({checkInResult.method})
                </p>
              </div>

              <p className="text-xs text-amber-200 font-medium">
                No duplicate record created. Entry already validated.
              </p>

              <button
                onClick={() => setCheckInResult(null)}
                className="text-xs text-white/60 hover:text-white underline pt-1 block mx-auto"
              >
                Dismiss & Ready
              </button>
            </div>
          ) : (
            // Error Result
            <div className="bg-gradient-to-br from-red-600 to-red-800 text-white rounded-2xl p-6 md:p-8 shadow-xl text-center space-y-3 relative">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto border-2 border-white/40">
                <XCircle className="w-10 h-10 text-white" />
              </div>
              <div>
                <span className="text-xs uppercase font-bold tracking-[0.2em] text-red-200 block">
                  Validation Error
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-extrabold mt-0.5">
                  ✕ {checkInResult.error.code.replace(/_/g, ' ')}
                </h2>
              </div>

              <div className="bg-white/10 rounded-xl p-4 max-w-md mx-auto border border-white/20">
                <p className="text-sm font-medium text-white">{checkInResult.error.message}</p>
              </div>

              <p className="text-xs text-red-200 font-medium">
                Please direct the participant to the Registration Desk.
              </p>

              <button
                onClick={() => setCheckInResult(null)}
                className="text-xs text-white/60 hover:text-white underline pt-1 block mx-auto"
              >
                Dismiss & Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- 1. NFC READER MODE --- */}
      {mode === 'NFC' && (
        <div className="space-y-6">
          {/* Main Android / Kiosk Reader Screen Area */}
          <div className="bg-gradient-to-b from-[#2E0B13] via-[#4A121E] to-[#2E0B13] text-white rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden border border-[#D4AF37]/30">
            {/* Background radio pulse ripples */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
              <div className="w-72 h-72 rounded-full border-4 border-white animate-ping"></div>
              <div className="w-96 h-96 rounded-full border-2 border-white"></div>
            </div>

            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-[#D4AF37]/40 text-xs font-semibold text-[#EAD098]">
                <Radio className="w-3.5 h-3.5 animate-pulse text-[#D4AF37]" />
                <span>NFC Check-In Terminal • Ready</span>
              </div>

              <div className="py-4">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#F5E6B8] text-[#4A121E] flex items-center justify-center mx-auto shadow-2xl hover:scale-105 transition-transform">
                  <Radio className="w-12 h-12 rotate-45" />
                </div>
              </div>

              <div>
                <h2 className="font-serif text-2xl md:text-3xl font-extrabold tracking-wide uppercase text-white drop-shadow">
                  Tap Participant NFC Card
                </h2>
                <p className="text-xs md:text-sm text-[#EAD098]/80 max-w-md mx-auto mt-1">
                  Hold the parish event card near the reader device to validate registration and record attendance.
                </p>
              </div>

              {/* Hardware Web NFC Button (if available on Chrome/Android) */}
              {webNfcSupported && (
                <div className="pt-2">
                  <button
                    onClick={startWebNfc}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow ${
                      webNfcActive
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                        : 'bg-[#D4AF37] text-[#4A121E] hover:bg-[#EAD098]'
                    }`}
                  >
                    {webNfcActive ? '✓ Web NFC Active (Listening for Hardware Tags)' : 'Enable Android Web NFC Reader'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Card Tapper Simulator (Essential for testing & demonstration) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-bold text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#801B2E]" />
                  Simulate Physical NFC Card Tap
                </h3>
                <p className="text-xs text-gray-500">
                  Select any provisioned physical card below to simulate tapping it against this reader.
                </p>
              </div>
              <span className="text-[11px] font-mono text-gray-400">Card Test Deck</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {testCards.map((card, idx) => (
                <button
                  key={idx}
                  id={`simulate-tap-card-${idx}`}
                  onClick={() => handleNfcTap(card.token, card.name)}
                  disabled={loading}
                  className={`p-3.5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm flex flex-col justify-between ${card.color}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] text-gray-500">{card.number}</span>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-black/10">
                        {card.badge}
                      </span>
                    </div>
                    <p className="font-bold text-sm text-gray-900">{card.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{card.status}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-black/10 flex items-center justify-between text-xs font-semibold text-[#801B2E]">
                    <span>Tap This Card</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>

            {/* Custom raw token entry */}
            <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-3">
              <span className="text-xs text-gray-500 font-medium shrink-0">
                Custom Tag Opaque Token:
              </span>
              <div className="flex-1 w-full flex items-center gap-2">
                <input
                  id="custom-nfc-token-input"
                  type="text"
                  placeholder="e.g. BSCNFC:v1:982f1b4a7d6e5c3a"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                      handleNfcTap((e.target as HTMLInputElement).value, 'Custom Tag');
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = document.getElementById('custom-nfc-token-input') as HTMLInputElement;
                    if (input?.value) handleNfcTap(input.value, 'Custom Tag');
                  }}
                  className="px-3 py-1.5 bg-[#801B2E] text-white text-xs font-bold rounded-lg shrink-0 hover:bg-[#6B1D2F]"
                >
                  Tap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 2. QR CODE SCANNER FALLBACK --- */}
      {mode === 'QR' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-6">
          <div className="max-w-md mx-auto text-center space-y-2">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto text-gray-700">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="font-serif text-xl font-bold text-gray-900">QR Check-In Fallback</h3>
            <p className="text-xs text-gray-500">
              Scan or enter the participant's QR registration pass code (e.g.{' '}
              <span className="font-mono font-semibold">BSC-EVT-000001</span>).
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-4">
            <div className="flex gap-2">
              <input
                id="qr-manual-code-input"
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Paste QR payload or Registration Code..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E] text-sm font-mono"
                onKeyDown={(e) => e.key === 'Enter' && handleQrCheckIn(qrInput)}
              />
              <button
                id="submit-qr-code-btn"
                onClick={() => handleQrCheckIn(qrInput)}
                disabled={loading || !qrInput.trim()}
                className="px-5 py-2.5 bg-[#801B2E] hover:bg-[#6B1D2F] text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                Validate
              </button>
            </div>

            {/* Quick test QR codes */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Sample Registered Passes to Test:</p>
              <div className="flex flex-wrap gap-2">
                {['BSC-EVT-000001', 'BSC-EVT-000002', 'BSC-EVT-000003'].map((code) => (
                  <button
                    key={code}
                    onClick={() => handleQrCheckIn(code)}
                    className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-mono text-gray-800 border border-gray-200"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 3. MANUAL SEARCH FALLBACK --- */}
      {mode === 'MANUAL' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-gray-900">Manual Check-In Lookup</h3>
              <p className="text-xs text-gray-500">
                Search registered participants if their card is damaged or QR pass is unavailable.
              </p>
            </div>
            <div className="w-full sm:w-72 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                id="manual-search-input"
                type="text"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder="Search name, phone, BSC#..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">BSC #</th>
                  <th className="py-2.5 px-3">Participant Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Parish Group</th>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredParticipants.slice(0, 10).map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-700">{p.participantNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">
                      {p.firstName} {p.lastName}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">{p.phone}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                        {p.parishGroup || 'General'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {p.isParishMember ? (
                        <span className="text-emerald-700 font-bold text-[10px]">PARISHIONER</span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">VISITOR</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        id={`manual-checkin-btn-${p.id}`}
                        onClick={() => handleManualCheckIn(p.id)}
                        disabled={loading}
                        className="px-3 py-1 bg-[#801B2E] hover:bg-[#6B1D2F] text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
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
    </div>
  );
};
