import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  UserX,
  Search,
  CheckCircle,
  Eye,
  Zap,
} from 'lucide-react';
import { NfcCard, Participant, UserRole } from '../types/index.js';
import { api } from '../services/api.js';
import { NfcCardGraphic } from './NfcCardGraphic.js';

interface NfcCardsViewProps {
  userRole: UserRole;
  onRefreshCards: () => void;
}

export const NfcCardsView: React.FC<NfcCardsViewProps> = ({ userRole, onRefreshCards }) => {
  const [cards, setCards] = useState<(NfcCard & { participant?: Participant })[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected card for visual inspection (PVC card front/back preview)
  const [inspectedCard, setInspectedCard] = useState<(NfcCard & { participant?: Participant }) | null>(null);

  // Modals
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<NfcCard | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState<NfcCard | null>(null);
  const [revokeReason, setRevokeReason] = useState('Reported lost or damaged');

  // Programming tool state
  const [progStep, setProgStep] = useState<number>(1);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [customCardNo, setCustomCardNo] = useState<string>('');
  const [programSuccessCard, setProgramSuccessCard] = useState<NfcCard | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cardsRes, partRes] = await Promise.all([api.getNfcCards(), api.getParticipants()]);
      if (cardsRes.success && Array.isArray(cardsRes.cards)) {
        setCards(cardsRes.cards);
      }
      if (partRes.success && Array.isArray(partRes.participants)) {
        setParticipants(partRes.participants);
        if (!selectedParticipantId && partRes.participants.length > 0) {
          setSelectedParticipantId(partRes.participants[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Stats
  const safeCards = cards || [];
  const totalCards = safeCards.length;
  const activeCards = safeCards.filter((c) => c.status === 'ACTIVE').length;
  const unassignedCards = safeCards.filter((c) => c.status === 'UNASSIGNED').length;
  const revokedCards = safeCards.filter((c) => c.status === 'REVOKED').length;
  const lostCards = safeCards.filter((c) => c.status === 'LOST').length;

  const handleAssignCard = async (cardId: string, participantId: string) => {
    try {
      const res = await api.assignNfcCard(cardId, participantId);
      if (res.success) {
        setShowAssignModal(null);
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRevokeCard = async () => {
    if (!showRevokeModal) return;
    try {
      const res = await api.revokeNfcCard(showRevokeModal.id, revokeReason);
      if (res.success) {
        setShowRevokeModal(null);
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReplaceCard = async (oldCardId: string) => {
    if (confirm('Issue a replacement card for this participant? The existing card will be REVOKED.')) {
      try {
        const res = await api.replaceNfcCard(oldCardId);
        if (res.success) {
          alert(`Success: Replaced with new card ${res.newCard.cardNumber}`);
          loadData();
        }
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleProgramCard = async () => {
    setLoading(true);
    try {
      const res = await api.issueNfcCard({
        participantId: selectedParticipantId || undefined,
        customCardNumber: customCardNo.trim() || undefined,
      });
      if (res.success) {
        setProgramSuccessCard(res.card);
        setProgStep(4);
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCards = cards.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const partName = c.participant ? `${c.participant.firstName} ${c.participant.lastName}`.toLowerCase() : '';
    const partNum = c.participant?.participantNumber?.toLowerCase() || '';
    return c.cardNumber.toLowerCase().includes(q) || partName.includes(q) || partNum.includes(q) || c.status.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-gray-900">NFC Event Cards Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Issue, assign, revoke, and inspect physical encrypted NFC cards for Blessed Sacrament parishioners.
          </p>
        </div>

        {(userRole === 'SUPER_ADMIN' || userRole === 'EVENT_ADMIN') && (
          <button
            id="program-nfc-card-btn"
            onClick={() => {
              setProgStep(1);
              setProgramSuccessCard(null);
              setShowProgramModal(true);
            }}
            className="px-4 py-2.5 bg-[#801B2E] hover:bg-[#6B1D2F] text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-[#EAD098]" />
            <span>NFC Card Programming Tool</span>
          </button>
        )}
      </div>

      {/* Dashboard KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Cards</span>
          <span className="font-serif text-2xl font-bold text-gray-900">{totalCards}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm text-center bg-emerald-50/40">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">Active</span>
          <span className="font-serif text-2xl font-bold text-emerald-800">{activeCards}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm text-center bg-blue-50/40">
          <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">Unassigned</span>
          <span className="font-serif text-2xl font-bold text-blue-800">{unassignedCards}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm text-center bg-rose-50/40">
          <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">Revoked</span>
          <span className="font-serif text-2xl font-bold text-rose-800">{revokedCards}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm text-center bg-amber-50/40">
          <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">Lost</span>
          <span className="font-serif text-2xl font-bold text-amber-800">{lostCards}</span>
        </div>
      </div>

      {/* Visual PVC Card Inspection Banner (if card clicked) */}
      {inspectedCard && (
        <div className="bg-white rounded-2xl p-6 shadow-md border border-[#D4AF37]/50 space-y-4 animate-scaleIn">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#801B2E]" />
              <h3 className="font-serif text-base font-bold text-gray-900">
                Physical PVC Card Specification Preview (Front & Back)
              </h3>
            </div>
            <button
              onClick={() => setInspectedCard(null)}
              className="text-xs text-gray-400 hover:text-gray-600 font-bold"
            >
              ✕ Close Preview
            </button>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-8 py-2">
            <div className="text-center space-y-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Card Front View (Click to Flip)
              </span>
              <NfcCardGraphic
                cardNumber={inspectedCard.cardNumber}
                participantName={
                  inspectedCard.participant
                    ? `${inspectedCard.participant.firstName} ${inspectedCard.participant.lastName}`
                    : 'Unassigned Blank Tag'
                }
                participantNumber={inspectedCard.participant?.participantNumber || 'BSC-UNASSIGNED'}
                parishGroup={inspectedCard.participant?.parishGroup || 'Parishioner'}
                status={inspectedCard.status}
                flip={false}
              />
            </div>

            <div className="text-center space-y-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Card Back View (Click to Flip)
              </span>
              <NfcCardGraphic
                cardNumber={inspectedCard.cardNumber}
                participantName={
                  inspectedCard.participant
                    ? `${inspectedCard.participant.firstName} ${inspectedCard.participant.lastName}`
                    : 'Unassigned Blank Tag'
                }
                participantNumber={inspectedCard.participant?.participantNumber || 'BSC-UNASSIGNED'}
                parishGroup={inspectedCard.participant?.parishGroup || 'Parishioner'}
                status={inspectedCard.status}
                flip={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Cards Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#801B2E]" />
            <h3 className="font-serif text-base font-bold text-gray-900">Card Inventory</h3>
          </div>

          <div className="w-full sm:w-64 relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search card serial, member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#801B2E]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Card Serial</th>
                <th className="py-3 px-4">Assigned Participant</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Token Hash (SHA-256)</th>
                <th className="py-3 px-4">Issued Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCards.map((card) => (
                <tr key={card.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[#801B2E]">{card.cardNumber}</td>
                  <td className="py-3 px-4">
                    {card.participant ? (
                      <div>
                        <p className="font-bold text-gray-900">
                          {card.participant.firstName} {card.participant.lastName}
                        </p>
                        <p className="font-mono text-[10px] text-gray-500">
                          {card.participant.participantNumber} • {card.participant.parishGroup || 'Parish'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Unassigned Card</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        card.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : card.status === 'UNASSIGNED'
                          ? 'bg-blue-100 text-blue-800'
                          : card.status === 'REVOKED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {card.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-gray-400">
                    {card.tokenHash.substring(0, 16)}...
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {card.issuedAt ? new Date(card.issuedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setInspectedCard(card)}
                        className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                        title="View Physical Card Graphic"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {card.status === 'UNASSIGNED' && (
                        <button
                          onClick={() => setShowAssignModal(card)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold"
                        >
                          Assign
                        </button>
                      )}

                      {card.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() => handleReplaceCard(card.id)}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-semibold"
                            title="Issue replacement card"
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => setShowRevokeModal(card)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-semibold"
                            title="Revoke card"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- NFC CARD PROGRAMMING TOOL MODAL (Prompt Section 35) --- */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#801B2E]" />
                <h3 className="font-serif text-lg font-bold text-gray-900">
                  NFC Card Programming Terminal
                </h3>
              </div>
              <button
                onClick={() => setShowProgramModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-between text-xs font-semibold border-b border-gray-100 pb-3 text-gray-500">
              <span className={progStep >= 1 ? 'text-[#801B2E] font-bold' : ''}>1. Select Member</span>
              <span>→</span>
              <span className={progStep >= 2 ? 'text-[#801B2E] font-bold' : ''}>2. Generate Token</span>
              <span>→</span>
              <span className={progStep >= 3 ? 'text-[#801B2E] font-bold' : ''}>3. Write Tag</span>
              <span>→</span>
              <span className={progStep >= 4 ? 'text-emerald-700 font-bold' : ''}>4. Verify</span>
            </div>

            {/* Step 1: Select Participant */}
            {progStep === 1 && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-gray-800 block mb-1">Select Participant to Issue Card</label>
                  <select
                    value={selectedParticipantId}
                    onChange={(e) => setSelectedParticipantId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-semibold focus:outline-none focus:border-[#801B2E]"
                  >
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.participantNumber} — {p.firstName} {p.lastName} ({p.parishGroup || 'Parishioner'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-800 block mb-1">Custom Card Serial Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. BSC-CARD-000140 (Auto-generated if blank)"
                    value={customCardNo}
                    onChange={(e) => setCustomCardNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono focus:outline-none focus:border-[#801B2E]"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setProgStep(2)}
                    className="px-5 py-2 bg-[#801B2E] text-white font-bold rounded-xl hover:bg-[#6B1D2F]"
                  >
                    Continue to Tag Writing →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 & 3: Place blank card and write token */}
            {(progStep === 2 || progStep === 3) && (
              <div className="space-y-4 text-center py-4">
                <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-300 text-amber-600 flex items-center justify-center mx-auto animate-pulse">
                  <CreditCard className="w-10 h-10" />
                </div>
                <h4 className="font-serif text-base font-bold text-gray-900">
                  Ready to Program Secure Opaque Token
                </h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  A cryptographically secure token <span className="font-mono text-[#801B2E]">BSCNFC:v1:&lt;random&gt;</span> will be provisioned. Only the SHA-256 hash is recorded in the parish registry.
                </p>

                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => setProgStep(1)}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700"
                  >
                    Back
                  </button>
                  <button
                    id="confirm-program-card-btn"
                    onClick={handleProgramCard}
                    disabled={loading}
                    className="px-6 py-2 bg-[#801B2E] text-white text-xs font-bold rounded-xl shadow hover:bg-[#6B1D2F] disabled:opacity-50"
                  >
                    {loading ? 'Writing to Tag...' : 'Write & Activate Card'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Verification Success */}
            {progStep === 4 && programSuccessCard && (
              <div className="space-y-4 text-center py-4 animate-scaleIn">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h4 className="font-serif text-lg font-bold text-gray-900">
                  ✓ Card Successfully Programmed!
                </h4>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono text-emerald-900">
                  <p>Card Serial: <strong>{programSuccessCard.cardNumber}</strong></p>
                  <p>Status: <strong>ACTIVE</strong></p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    SHA-256: {programSuccessCard.tokenHash.substring(0, 24)}...
                  </p>
                </div>
                <p className="text-xs text-gray-600">
                  The card is now registered and immediately eligible for attendance tap at all parish events.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setShowProgramModal(false)}
                    className="px-6 py-2 bg-[#801B2E] text-white text-xs font-bold rounded-xl hover:bg-[#6B1D2F]"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <h3 className="font-serif text-lg font-bold text-gray-900">
              Revoke NFC Card {showRevokeModal.cardNumber}
            </h3>
            <p className="text-xs text-gray-600">
              Revoking this card immediately prevents it from checking into events. This operation is audited.
            </p>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Reason for Revocation</label>
              <select
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
              >
                <option value="Card lost by parishioner">Card lost by parishioner</option>
                <option value="Card damaged or defective">Card damaged or defective</option>
                <option value="Replaced by new card">Replaced by new card</option>
                <option value="Administrative revocation">Administrative revocation</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRevokeModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeCard}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow"
              >
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <h3 className="font-serif text-lg font-bold text-gray-900">
              Assign Card {showAssignModal.cardNumber}
            </h3>
            <p className="text-xs text-gray-600">
              Select a registered parishioner to link this physical NFC tag.
            </p>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Select Participant</label>
              <select
                id="assign-participant-select"
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#801B2E]"
                defaultValue={participants[0]?.id}
                onChange={(e) => (showAssignModal as any).targetParticipantId = e.target.value}
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.participantNumber} — {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAssignModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetId = (showAssignModal as any).targetParticipantId || participants[0]?.id;
                  if (targetId) handleAssignCard(showAssignModal.id, targetId);
                }}
                className="px-4 py-2 bg-[#801B2E] text-white text-xs font-bold rounded-lg shadow hover:bg-[#6B1D2F]"
              >
                Assign Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
