import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Activity,
} from 'lucide-react';
import { AuditLog } from '../types/index.js';
import { api } from '../services/api.js';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs();
      if (res.success && Array.isArray(res.auditLogs)) {
        setLogs(res.auditLogs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = (logs || []).filter((l) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      l.action.toLowerCase().includes(q) ||
      l.entityType.toLowerCase().includes(q) ||
      (l.actorName && l.actorName.toLowerCase().includes(q)) ||
      (l.details && JSON.stringify(l.details).toLowerCase().includes(q));

    const matchesAction = actionFilter === 'ALL' || l.action.startsWith(actionFilter);
    return matchesSearch && matchesAction;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#801B2E]" />
            <h2 className="font-serif text-2xl font-bold text-gray-900">Security & Audit Log Trail</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Immutable audit records of all card programming, check-in operations, revocations, and system actions.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search action, entity ID, actor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E] font-semibold"
          >
            <option value="ALL">All Event Types</option>
            <option value="ATTENDANCE">Attendance Operations</option>
            <option value="NFC">NFC Card Management</option>
            <option value="EVENT">Event Lifecycle</option>
            <option value="PARTICIPANT">Participant Registration</option>
            <option value="OFFLINE">Offline Batch Sync</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/70">
                  <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-4 font-sans font-bold text-gray-900">
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-[10px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-gray-700">
                    {log.actorName || log.actorId || 'System'}
                  </td>
                  <td className="py-2.5 px-4 text-gray-500">
                    {log.entityType} ({log.entityId ? log.entityId.substring(0, 8) : '—'})
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        log.result === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {log.result}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-gray-500 max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
