import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Radio,
  QrCode,
  Search,
  RefreshCw,
  Users,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import { ParishEvent, AttendanceStats, EventAttendance, Participant, NfcDevice } from '../types/index.js';
import { api } from '../services/api.js';

interface AttendanceDashboardProps {
  events: ParishEvent[];
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
}

export const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({
  events,
  selectedEventId,
  setSelectedEventId,
}) => {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [attendances, setAttendances] = useState<
    (EventAttendance & { participant?: Participant; device?: NfcDevice })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  const loadData = async () => {
    if (!selectedEvent) return;
    setLoading(true);
    try {
      const [statsRes, attRes] = await Promise.all([
        api.getAttendanceStats(selectedEvent.id),
        api.getEventAttendance(selectedEvent.id),
      ]);
      if (statsRes.success) setStats(statsRes.stats);
      if (attRes.success) setAttendances(attRes.attendances);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Periodic poll every 8 seconds for live attendance
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [selectedEventId]);

  const handleDownloadCsv = () => {
    if (!selectedEvent) return;
    window.open(api.getCsvReportUrl(selectedEvent.id), '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <span className="text-[11px] font-bold text-[#801B2E] uppercase tracking-wider block">
            Live Attendance Dashboard
          </span>
          <div className="flex items-center gap-3 mt-1">
            <select
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
            Real-time check-in stream, gate telemetry, and parish attendance analysis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Refresh Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            id="download-attendance-csv-btn"
            onClick={handleDownloadCsv}
            className="px-4 py-2 bg-[#801B2E] hover:bg-[#6B1D2F] text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Registered, Checked In, Remaining, Attendance Rate */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
              Registered
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif text-3xl font-extrabold text-gray-900">
                {stats.totalRegistered}
              </span>
              <span className="text-xs text-gray-500">participants</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm bg-emerald-50/30">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
              Checked In
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif text-3xl font-extrabold text-emerald-700">
                {stats.totalCheckedIn}
              </span>
              <span className="text-xs text-emerald-800 font-semibold">
                ({stats.attendanceRate}%)
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
              Remaining
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif text-3xl font-extrabold text-gray-700">
                {stats.remaining}
              </span>
              <span className="text-xs text-gray-500">awaiting arrival</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D4AF37]/50 shadow-sm bg-[#FAF7F2]">
            <span className="text-[10px] uppercase font-bold text-[#801B2E] tracking-wider block">
              Primary Channel
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif text-3xl font-extrabold text-[#801B2E]">
                {stats.byMethod.nfc}
              </span>
              <span className="text-xs text-gray-700 font-semibold">NFC Taps</span>
            </div>
          </div>
        </div>
      )}

      {/* Method Distribution Breakdown & Hourly Distribution */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Methods Breakdown */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#801B2E]" />
                Check-Ins By Channel
              </h3>
              <span className="text-xs text-gray-400 font-mono">Channel Mix</span>
            </div>

            <div className="space-y-3 pt-2">
              {/* NFC */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-600" /> NFC Card Tap
                  </span>
                  <span>{stats.byMethod.nfc} ({stats.totalCheckedIn > 0 ? Math.round((stats.byMethod.nfc / stats.totalCheckedIn) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${stats.totalCheckedIn > 0 ? (stats.byMethod.nfc / stats.totalCheckedIn) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* QR */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-blue-600" /> QR Pass Scan
                  </span>
                  <span>{stats.byMethod.qr} ({stats.totalCheckedIn > 0 ? Math.round((stats.byMethod.qr / stats.totalCheckedIn) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${stats.totalCheckedIn > 0 ? (stats.byMethod.qr / stats.totalCheckedIn) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* MANUAL */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-gray-600" /> Manual Desk Lookup
                  </span>
                  <span>{stats.byMethod.manual} ({stats.totalCheckedIn > 0 ? Math.round((stats.byMethod.manual / stats.totalCheckedIn) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${stats.totalCheckedIn > 0 ? (stats.byMethod.manual / stats.totalCheckedIn) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Group Participation Breakdown */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-3">
            <h3 className="font-serif text-base font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#801B2E]" />
              Parish Groups Participation
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(stats?.byGroup || []).map((grp) => {
                const pct = grp.registered > 0 ? Math.round((grp.checkedIn / grp.registered) * 100) : 0;
                return (
                  <div key={grp.group} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                    <span className="font-semibold text-gray-800">{grp.group}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 font-mono text-[11px]">
                        {grp.checkedIn} / {grp.registered}
                      </span>
                      <span className="w-12 text-right font-bold text-[#801B2E]">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Live Check-In Ticker / Feed (Prompt Section 37) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <h3 className="font-serif text-base font-bold text-gray-900">
              Live Check-In Activity Stream
            </h3>
          </div>
          <span className="text-[11px] font-mono text-gray-400">Updates live every 8s</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">Arrival Time</th>
                <th className="py-2.5 px-3">Participant</th>
                <th className="py-2.5 px-3">BSC Number</th>
                <th className="py-2.5 px-3">Parish Group</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Gate / Device</th>
                <th className="py-2.5 px-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
              {attendances.slice(0, 12).map((a) => {
                const timeStr = new Date(a.checkInAt).toLocaleTimeString();
                return (
                  <tr key={a.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-2 px-3 font-semibold text-gray-900 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span>{timeStr}</span>
                    </td>
                    <td className="py-2 px-3 font-sans font-bold text-gray-900">
                      {a.participant ? `${a.participant.firstName} ${a.participant.lastName}` : 'Member'}
                    </td>
                    <td className="py-2 px-3 text-gray-600">
                      {a.participant?.participantNumber || '—'}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                        {a.participant?.parishGroup || 'General'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.method === 'NFC'
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.method === 'QR'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {a.method}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500 font-sans text-[11px]">
                      {a.device?.deviceName || a.deviceId || 'Gate A'}
                    </td>
                    <td className="py-2 px-3 text-gray-400 font-sans truncate max-w-xs">
                      {a.notes || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Report Modal (Prompt Section 65) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-gray-300 my-8 space-y-6 print:m-0 print:p-0">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 print:hidden">
              <span className="font-bold text-sm text-gray-700">Official Parish Report Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#801B2E] text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Parish Document */}
            <div className="font-serif text-gray-900 space-y-6 text-sm">
              <div className="text-center border-b-2 border-[#801B2E] pb-4">
                <h2 className="text-xl font-extrabold uppercase tracking-wide text-[#801B2E]">
                  Blessed Sacrament Catholic Parish
                </h2>
                <p className="text-xs text-gray-600 uppercase tracking-widest mt-0.5">
                  Buru-Phase III, Mumias Road, Nairobi, Kenya
                </p>
                <h3 className="text-base font-bold text-gray-800 mt-2 uppercase">
                  Event Attendance Official Report
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p><strong>Event:</strong> {selectedEvent?.title}</p>
                  <p><strong>Venue:</strong> {selectedEvent?.venue}</p>
                  <p><strong>Category:</strong> {selectedEvent?.category}</p>
                </div>
                <div className="text-right">
                  <p><strong>Date:</strong> {new Date(selectedEvent?.startAt || '').toLocaleDateString('en-KE')}</p>
                  <p><strong>Generated:</strong> {new Date().toLocaleString('en-KE')}</p>
                  <p><strong>Status:</strong> {selectedEvent?.status}</p>
                </div>
              </div>

              <div className="border-t border-b border-gray-200 py-3 text-xs font-mono space-y-1 bg-gray-50 p-4 rounded">
                <p>REGISTERED PARTICIPANTS: <strong>{stats?.totalRegistered}</strong></p>
                <p>CHECKED IN: <strong>{stats?.totalCheckedIn}</strong> ({stats?.attendanceRate}%)</p>
                <p>NOT CHECKED IN: <strong>{stats?.remaining}</strong></p>
                <div className="pt-2 border-t border-gray-200 flex gap-6">
                  <span>NFC: <strong>{stats?.byMethod.nfc}</strong></span>
                  <span>QR: <strong>{stats?.byMethod.qr}</strong></span>
                  <span>MANUAL: <strong>{stats?.byMethod.manual}</strong></span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-xs uppercase mb-2 border-b pb-1">Sample Arrival Registry</h4>
                <table className="w-full text-[11px] text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="py-1">BSC #</th>
                      <th className="py-1">Name</th>
                      <th className="py-1">Group</th>
                      <th className="py-1">Time</th>
                      <th className="py-1">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendances.slice(0, 10).map((a) => (
                      <tr key={a.id} className="border-b border-gray-100">
                        <td className="py-1 font-mono">{a.participant?.participantNumber}</td>
                        <td className="py-1 font-sans">{a.participant?.firstName} {a.participant?.lastName}</td>
                        <td className="py-1 font-sans">{a.participant?.parishGroup}</td>
                        <td className="py-1 font-mono">{new Date(a.checkInAt).toLocaleTimeString()}</td>
                        <td className="py-1 font-bold">{a.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-8 flex justify-between text-xs text-gray-500 border-t">
                <div>Parish Executive Signature: _______________________</div>
                <div>Office Seal: [ Blessed Sacrament Parish ]</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
