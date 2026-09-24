import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  CreditCard,
  CheckCircle,
  Phone,
  Mail,
  Filter,
} from 'lucide-react';
import { Participant, NfcCard, ParishGroup } from '../types/index.js';
import { api } from '../services/api.js';

export const ParticipantsView: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cards, setCards] = useState<NfcCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');

  // New Participant Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    parishGroup: 'YSC' as ParishGroup,
    isParishMember: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [partRes, cardRes] = await Promise.all([api.getParticipants(), api.getNfcCards()]);
      if (partRes.success && Array.isArray(partRes.participants)) setParticipants(partRes.participants);
      if (cardRes.success && Array.isArray(cardRes.cards)) setCards(cardRes.cards);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createParticipant(formData);
      if (res.success) {
        setShowModal(false);
        setFormData({
          firstName: '',
          lastName: '',
          phone: '',
          email: '',
          parishGroup: 'YSC',
          isParishMember: true,
        });
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = (participants || []).filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.participantNumber.toLowerCase().includes(q);

    const matchesGroup = groupFilter === 'ALL' || p.parishGroup === groupFilter;
    return matchesSearch && matchesGroup;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-gray-900">Parishioners & Participants</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Registered Blessed Sacrament parish community members, apostolic guild affiliations, and active NFC card links.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-[#801B2E] hover:bg-[#6B1D2F] text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Participant</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, phone, BSC ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E] font-semibold"
          >
            <option value="ALL">All Groups</option>
            <option value="YSC">YSC (Youth)</option>
            <option value="CMA">CMA (Men)</option>
            <option value="MYM">MYM (Young Adults)</option>
            <option value="PMC">PMC (Children)</option>
            <option value="Choir">Choir</option>
            <option value="Altar Servers">Altar Servers</option>
            <option value="Liturgical Committee">Liturgical Committee</option>
            <option value="Charismatic Renewal">Charismatic Renewal</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">BSC Number</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Parish Guild</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">NFC Card</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => {
                const activeCard = cards.find((c) => c.participantId === p.id && c.status === 'ACTIVE');
                return (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#801B2E]">{p.participantNumber}</td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-gray-900">{p.firstName} {p.lastName}</p>
                      <span className="text-[10px] text-gray-400">
                        {p.isParishMember ? 'Blessed Sacrament Parishioner' : 'Visitor'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span>{p.phone}</span>
                      </div>
                      {p.email && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span>{p.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-800">
                        {p.parishGroup || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {activeCard ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-mono text-[11px] font-bold">
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{activeCard.cardNumber}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[11px] italic">No active card</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Participant Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-serif text-lg font-bold text-gray-900">Register New Parishioner</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Parish Group</label>
                <select
                  value={formData.parishGroup}
                  onChange={(e) => setFormData({ ...formData, parishGroup: e.target.value as ParishGroup })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                >
                  <option value="YSC">YSC</option>
                  <option value="CMA">CMA</option>
                  <option value="MYM">MYM</option>
                  <option value="PMC">PMC</option>
                  <option value="Choir">Choir</option>
                  <option value="Altar Servers">Altar Servers</option>
                  <option value="Liturgical Committee">Liturgical Committee</option>
                  <option value="Charismatic Renewal">Charismatic Renewal</option>
                  <option value="Other">Other</option>
                  <option value="None">None</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#801B2E] text-white font-bold rounded-lg hover:bg-[#6B1D2F]"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
