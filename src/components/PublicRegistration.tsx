import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Church,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  QrCode,
  CreditCard,
  Printer,
  Download,
  Share2,
  Users,
} from 'lucide-react';
import { ParishEvent, ParishGroup } from '../types/index.js';
import { api } from '../services/api.js';

interface PublicRegistrationProps {
  events: ParishEvent[];
  initialEventCode?: string;
}

export const PublicRegistration: React.FC<PublicRegistrationProps> = ({
  events,
  initialEventCode,
}) => {
  const publishedEvents = events.filter(
    (e) => e.status === 'PUBLISHED' || e.status === 'LIVE'
  );

  const [selectedEventId, setSelectedEventId] = useState<string>(
    events.find((e) => e.eventCode === initialEventCode)?.id ||
      publishedEvents[0]?.id ||
      events[0]?.id ||
      ''
  );

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    parishGroup: 'YSC' as ParishGroup,
    isParishMember: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success Confirmation State
  const [confirmation, setConfirmation] = useState<{
    registrationCode: string;
    qrDataUrl: string;
    participant: any;
    event: ParishEvent;
    hasNfcCard: boolean;
    cardSummary?: any;
  } | null>(null);

  const currentEvent = events.find((e) => e.id === selectedEventId) || events[0];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.registerForEvent(currentEvent.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        email: formData.email,
        parishGroup: formData.parishGroup,
        isParishMember: formData.isParishMember,
      });

      if (res.success) {
        // Generate QR code data URL for display
        const qrUrl = await QRCode.toDataURL(res.registration.rawQrToken || res.registration.registrationCode, {
          width: 200,
          margin: 1,
          color: { dark: '#221F1F', light: '#FFFFFF' },
        });

        setConfirmation({
          registrationCode: res.registration.registrationCode,
          qrDataUrl: qrUrl,
          participant: res.participant,
          event: currentEvent,
          hasNfcCard: res.hasNfcCard,
          cardSummary: res.cardSummary,
        });
      } else {
        setErrorMsg((res as any).error?.message || 'Registration failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred during registration');
    } finally {
      setSubmitting(false);
    }
  };

  const parishGroups: ParishGroup[] = [
    'YSC',
    'CMA',
    'MYM',
    'PMC',
    'Choir',
    'Altar Servers',
    'Liturgical Committee',
    'Charismatic Renewal',
    'Other',
    'None',
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Public Banner */}
      <div className="text-center space-y-2 py-4 border-b border-gray-200">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#801B2E]/10 text-[#801B2E] text-xs font-bold uppercase tracking-wider">
          <Church className="w-3.5 h-3.5" />
          <span>Blessed Sacrament Catholic Parish • Buru-Phase III</span>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
          Parish Event Registration
        </h1>
        <p className="text-xs md:text-sm text-gray-600 max-w-lg mx-auto">
          Mumias Road, Nairobi, Kenya • Official participant registration and electronic attendance gateway.
        </p>
      </div>

      {/* Confirmation View if registered */}
      {confirmation ? (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-emerald-300 space-y-6 animate-scaleIn">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest block">
              Registration Confirmed
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-gray-900">
              {confirmation.event.title}
            </h2>
            <p className="text-xs text-gray-500">
              Thank you, <strong className="text-gray-900">{confirmation.participant.firstName}</strong>. Your entry pass is ready.
            </p>
          </div>

          <div className="bg-[#FAF7F2] rounded-2xl p-6 border border-[#D4AF37]/40 flex flex-col md:flex-row items-center justify-between gap-6 max-w-xl mx-auto">
            {/* QR Pass */}
            <div className="text-center space-y-2 shrink-0">
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 inline-block">
                <img
                  src={confirmation.qrDataUrl}
                  alt="Registration QR Pass"
                  className="w-40 h-40 rounded"
                />
              </div>
              <span className="text-[10px] font-mono text-gray-500 block uppercase font-semibold">
                Scan At Entrance
              </span>
            </div>

            {/* Details */}
            <div className="space-y-2.5 text-xs text-gray-700 flex-1 w-full">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                  Registration Number
                </span>
                <p className="font-mono text-base font-extrabold text-[#801B2E]">
                  {confirmation.registrationCode}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                  Participant Identifier
                </span>
                <p className="font-mono font-bold text-gray-900">
                  {confirmation.participant.participantNumber}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                  Parish Group & Venue
                </span>
                <p className="font-semibold text-gray-800">
                  {confirmation.participant.parishGroup || 'Parishioner'} • {confirmation.event.venue}
                </p>
              </div>

              {confirmation.hasNfcCard ? (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>NFC Card Active:</strong> You can simply tap your card ({confirmation.cardSummary?.cardNumber}) at the gate!
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Present this QR code on your mobile screen at the entrance check-in desk.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Registration Slip</span>
            </button>
            <button
              onClick={() => {
                setConfirmation(null);
                setFormData({
                  firstName: '',
                  lastName: '',
                  phone: '',
                  email: '',
                  parishGroup: 'YSC',
                  isParishMember: true,
                });
              }}
              className="px-5 py-2 rounded-xl bg-[#801B2E] text-white text-xs font-bold hover:bg-[#6B1D2F]"
            >
              Register Another Person
            </button>
          </div>
        </div>
      ) : (
        /* Event Selection & Registration Form */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Event Overview Card */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-3">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Choose Event to Attend
              </label>
              <select
                id="public-event-selector"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E] font-semibold"
              >
                {publishedEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title}
                  </option>
                ))}
              </select>

              {currentEvent && (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase font-semibold">
                    {currentEvent.category}
                  </span>
                  <h3 className="font-serif text-base font-bold text-gray-900 leading-snug">
                    {currentEvent.title}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {currentEvent.description}
                  </p>

                  <div className="space-y-2 text-xs text-gray-700 pt-2 border-t border-gray-100">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-[#801B2E] shrink-0 mt-0.5" />
                      <span className="font-medium">{currentEvent.venue}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-[#801B2E] shrink-0 mt-0.5" />
                      <span>
                        {new Date(currentEvent.startAt).toLocaleDateString('en-KE', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-[#801B2E] shrink-0 mt-0.5" />
                      <span>
                        {new Date(currentEvent.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(currentEvent.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#D4AF37]/30 text-xs text-gray-700 space-y-1.5">
              <span className="font-serif font-bold text-[#801B2E] block">NFC Card Holders:</span>
              <p className="text-[11px] text-gray-600 leading-normal">
                If you already possess an official Blessed Sacrament Parish Event Card, register here to link your attendance, then simply tap your card at the entrance gate.
              </p>
            </div>
          </div>

          {/* Right Column: Registration Form */}
          <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h3 className="font-serif text-lg font-bold text-gray-900 mb-1">
              Participant Information
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Fields marked with an asterisk (*) are required. You will receive an instant QR entry pass upon submission.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">First Name *</label>
                  <input
                    id="reg-first-name"
                    type="text"
                    required
                    placeholder="e.g. Shelmith"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Last Name *</label>
                  <input
                    id="reg-last-name"
                    type="text"
                    required
                    placeholder="e.g. Wambui"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Phone Number (Safaricom/Airtel) *</label>
                  <input
                    id="reg-phone"
                    type="tel"
                    required
                    placeholder="e.g. +254 712 345 678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Email Address</label>
                  <input
                    id="reg-email"
                    type="email"
                    placeholder="e.g. shelwangui23@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Parish Group / Guild</label>
                  <select
                    id="reg-parish-group"
                    value={formData.parishGroup}
                    onChange={(e) => setFormData({ ...formData, parishGroup: e.target.value as ParishGroup })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  >
                    {parishGroups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isParishMember}
                      onChange={(e) => setFormData({ ...formData, isParishMember: e.target.checked })}
                      className="rounded text-[#801B2E] focus:ring-[#801B2E]"
                    />
                    <span className="font-semibold text-gray-800">
                      I am a registered parishioner of Blessed Sacrament
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
                <button
                  id="submit-registration-btn"
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#801B2E] hover:bg-[#6B1D2F] text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'Registering...' : 'Register For Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
