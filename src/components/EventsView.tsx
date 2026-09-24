import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Plus,
  Radio,
  QrCode,
  Users,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { ParishEvent, UserRole } from '../types/index.js';
import { api } from '../services/api.js';

interface EventsViewProps {
  events: ParishEvent[];
  onRefreshEvents: () => void;
  userRole: UserRole;
  onSelectEventForCheckIn: (eventId: string) => void;
  onOpenPublicPage: (eventCode: string) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  onRefreshEvents,
  userRole,
  onSelectEventForCheckIn,
  onOpenPublicPage,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<ParishEvent | null>(null);

  // New Event Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Youth & Sports',
    venue: '',
    startAt: '2026-10-10T08:00',
    endAt: '2026-10-10T16:00',
    capacity: '300',
    status: 'PUBLISHED',
    allowNfcCheckin: true,
    allowQrCheckin: true,
    allowManualCheckin: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.createEvent({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        venue: formData.venue,
        startAt: new Date(formData.startAt).toISOString(),
        endAt: new Date(formData.endAt).toISOString(),
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
        status: formData.status as any,
        allowRegistration: true,
        allowNfcCheckin: formData.allowNfcCheckin,
        allowQrCheckin: formData.allowQrCheckin,
        allowManualCheckin: formData.allowManualCheckin,
      });

      if (res.success) {
        setShowCreateModal(false);
        onRefreshEvents();
      } else {
        setErrorMsg((res as any).error?.message || 'Failed to create event');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating event');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (id: string) => {
    await api.publishEvent(id);
    onRefreshEvents();
  };

  const handleCancel = async (id: string) => {
    if (confirm('Are you sure you want to cancel this parish event?')) {
      await api.cancelEvent(id);
      onRefreshEvents();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 animate-pulse border border-emerald-300">● LIVE NOW</span>;
      case 'PUBLISHED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">PUBLISHED</span>;
      case 'DRAFT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">DRAFT</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">COMPLETED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">CANCELLED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-gray-900">Parish Events Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure Blessed Sacrament Parish events, registration windows, and NFC attendance gates.
          </p>
        </div>

        {(userRole === 'SUPER_ADMIN' || userRole === 'EVENT_ADMIN') && (
          <button
            id="create-new-event-btn"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#801B2E] hover:bg-[#6B1D2F] text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Parish Event</span>
          </button>
        )}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 hover:border-[#D4AF37]/60 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
                    {event.eventCode} • {event.category}
                  </span>
                  <h3 className="font-serif text-lg font-bold text-gray-900 mt-0.5 leading-snug">
                    {event.title}
                  </h3>
                </div>
                {getStatusBadge(event.status)}
              </div>

              <p className="text-xs text-gray-600 line-clamp-2">{event.description}</p>

              <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#801B2E] shrink-0" />
                  <span className="font-medium text-gray-800">{event.venue}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#801B2E] shrink-0" />
                  <span>
                    {new Date(event.startAt).toLocaleDateString('en-KE', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    • {new Date(event.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {new Date(event.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {event.capacity && (
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>Capacity: {event.capacity} persons</span>
                  </div>
                )}
              </div>

              {/* Check-in capabilities pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {event.allowNfcCheckin && (
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-semibold flex items-center gap-1">
                    <Radio className="w-3 h-3" /> NFC Tap
                  </span>
                )}
                {event.allowQrCheckin && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-semibold flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> QR Pass
                  </span>
                )}
                {event.allowManualCheckin && (
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-semibold">
                    Manual Desk
                  </span>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 gap-2">
              <button
                onClick={() => onOpenPublicPage(event.eventCode)}
                className="text-xs text-[#801B2E] hover:underline font-semibold flex items-center gap-1"
              >
                <span>Public Portal</span>
                <ExternalLink className="w-3 h-3" />
              </button>

              <div className="flex items-center gap-2">
                {event.status === 'DRAFT' && (
                  <button
                    onClick={() => handlePublish(event.id)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg"
                  >
                    Publish
                  </button>
                )}
                {event.status !== 'CANCELLED' && event.status !== 'COMPLETED' && (
                  <button
                    onClick={() => onSelectEventForCheckIn(event.id)}
                    className="px-3 py-1 bg-[#801B2E] hover:bg-[#6B1D2F] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1"
                  >
                    <span>Check-In Mode</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 my-8 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-serif text-lg font-bold text-gray-900">Create New Parish Event</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parish Youth Leadership Workshop 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  >
                    <option value="Youth & Sports">Youth & Sports (YSC)</option>
                    <option value="Pastoral & Governance">Pastoral & Governance (PPC)</option>
                    <option value="Liturgical & Spiritual">Liturgical & Spiritual</option>
                    <option value="Men Ministry">Men Ministry (CMA)</option>
                    <option value="Women Guild">Women Guild (CWA)</option>
                    <option value="Children & PMC">Children & PMC</option>
                    <option value="Choir & Music">Choir & Music</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Venue *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fr. Grol Hall, Buru-Phase III"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of event purpose and agenda..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startAt}
                    onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">End Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.endAt}
                    onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Capacity (Max)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  >
                    <option value="PUBLISHED">PUBLISHED (Open for registration)</option>
                    <option value="LIVE">LIVE (Check-in active now)</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <span className="font-semibold text-gray-700 block mb-2">Check-in Channels</span>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowNfcCheckin}
                      onChange={(e) => setFormData({ ...formData, allowNfcCheckin: e.target.checked })}
                    />
                    <span>Allow NFC Card Check-in</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowQrCheckin}
                      onChange={(e) => setFormData({ ...formData, allowQrCheckin: e.target.checked })}
                    />
                    <span>Allow QR Check-in</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowManualCheckin}
                      onChange={(e) => setFormData({ ...formData, allowManualCheckin: e.target.checked })}
                    />
                    <span>Allow Manual Verification</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#801B2E] hover:bg-[#6B1D2F] text-white font-bold rounded-lg shadow disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Parish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
