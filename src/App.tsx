import React, { useState, useEffect } from 'react';
import {
  Church,
  Radio,
  Calendar,
  CreditCard,
  BarChart3,
  Users,
  ClipboardCheck,
  ShieldCheck,
  Globe,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { ParishEvent, UserRole, NfcDevice } from './types/index.js';
import { api } from './services/api.js';

// Modular Components
import { Navbar, NavTab } from './components/Navbar.js';
import { CheckInKiosk } from './components/CheckInKiosk.js';
import { EventsView } from './components/EventsView.js';
import { PublicRegistration } from './components/PublicRegistration.js';
import { NfcCardsView } from './components/NfcCardsView.js';
import { AttendanceDashboard } from './components/AttendanceDashboard.js';
import { ParticipantsView } from './components/ParticipantsView.js';
import { RegistrationDesk } from './components/RegistrationDesk.js';
import { AuditLogsView } from './components/AuditLogsView.js';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('checkin');
  const [userRole, setUserRole] = useState<UserRole>('SUPER_ADMIN');
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [deviceId, setDeviceId] = useState<string>('GATE-A-READER-1');

  // Local offline queue with browser persistence
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('bsc_offline_checkins');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bsc_offline_checkins', JSON.stringify(offlineQueue));
    } catch (e) {
      console.warn('Failed to persist offline queue', e);
    }
  }, [offlineQueue]);

  const [events, setEvents] = useState<ParishEvent[]>([]);
  const [devices, setDevices] = useState<NfcDevice[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Target event code for public page navigation
  const [publicEventCode, setPublicEventCode] = useState<string | undefined>(undefined);

  // Key stats ticker at top
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [eventsRes, devicesRes] = await Promise.all([
        api.getEvents(),
        api.getDevices(),
      ]);

      if (eventsRes.success && Array.isArray(eventsRes.events)) {
        setEvents(eventsRes.events);
        if (!selectedEventId && eventsRes.events.length > 0) {
          // Prefer LIVE event, then first published event
          const live = eventsRes.events.find((e) => e.status === 'LIVE');
          const pub = eventsRes.events.find((e) => e.status === 'PUBLISHED');
          setSelectedEventId(live?.id || pub?.id || eventsRes.events[0]?.id || '');
        }
      }

      if (devicesRes.success && Array.isArray(devicesRes.devices) && devicesRes.devices.length > 0) {
        setDevices(devicesRes.devices);
      }
    } catch (err: any) {
      console.error('Error initializing applet:', err);
      setError(err.message || 'Failed to load parish data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [refreshTrigger]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-gray-900 font-sans flex flex-col selection:bg-[#801B2E] selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'public') setPublicEventCode(undefined);
        }}
        userRole={userRole}
        setUserRole={setUserRole}
        activeDeviceId={deviceId}
        setActiveDeviceId={setDeviceId}
        isOffline={isOffline}
        setIsOffline={setIsOffline}
        offlineQueueCount={offlineQueue.length}
        onResetSeed={() => {
          api.resetDemoDatabase().then(() => setRefreshTrigger((p) => p + 1));
        }}
      />

      {/* Main Content Body */}
      <main className="flex-1 pb-16">
        {loading && (events?.length || 0) === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
            <div className="w-10 h-10 border-4 border-[#801B2E] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-serif text-sm font-semibold text-gray-700">
              Connecting to Blessed Sacrament Parish System...
            </p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
            <h3 className="font-serif text-base font-bold text-red-900">System Connection Notice</h3>
            <p className="text-xs text-red-700">{error}</p>
            <button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              className="px-4 py-2 bg-[#801B2E] text-white text-xs font-bold rounded-xl"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            {/* TAB 1: KIOSK (Fast NFC Entrance Gate) */}
            {currentTab === 'checkin' && (
              <div className="animate-fadeIn">
                <CheckInKiosk
                  events={events}
                  selectedEventId={selectedEventId}
                  setSelectedEventId={setSelectedEventId}
                  isOffline={isOffline}
                  activeDeviceId={deviceId}
                  offlineQueue={offlineQueue}
                  setOfflineQueue={setOfflineQueue}
                  onCheckInCompleted={() => setRefreshTrigger((prev) => prev + 1)}
                  onCheckInSuccess={() => setRefreshTrigger((prev) => prev + 1)}
                />
              </div>
            )}

            {/* TAB 2: EVENTS MANAGEMENT */}
            {currentTab === 'events' && (
              <div className="animate-fadeIn">
                <EventsView
                  events={events}
                  onRefreshEvents={() => setRefreshTrigger((prev) => prev + 1)}
                  userRole={userRole}
                  onSelectEventForCheckIn={(eventId) => {
                    setSelectedEventId(eventId);
                    setCurrentTab('checkin');
                  }}
                  onOpenPublicPage={(code) => {
                    setPublicEventCode(code);
                    setCurrentTab('public');
                  }}
                />
              </div>
            )}

            {/* TAB 3: PUBLIC REGISTRATION & PASS */}
            {currentTab === 'public' && (
              <div className="animate-fadeIn">
                <PublicRegistration
                  events={events}
                  initialEventCode={publicEventCode}
                />
              </div>
            )}

            {/* TAB 4: NFC CARDS MANAGEMENT */}
            {currentTab === 'cards' && (
              <div className="animate-fadeIn">
                <NfcCardsView
                  userRole={userRole}
                  onRefreshCards={() => setRefreshTrigger((prev) => prev + 1)}
                />
              </div>
            )}

            {/* TAB 5: ATTENDANCE DASHBOARD & LIVE TELEMETRY */}
            {currentTab === 'analytics' && (
              <div className="animate-fadeIn">
                <AttendanceDashboard
                  events={events}
                  selectedEventId={selectedEventId}
                  setSelectedEventId={setSelectedEventId}
                />
              </div>
            )}

            {/* TAB 6: PARTICIPANTS DIRECTORY */}
            {currentTab === 'participants' && (
              <div className="animate-fadeIn">
                <ParticipantsView />
              </div>
            )}

            {/* TAB 7: REGISTRATION DESK (VOLUNTEER KIOSK) */}
            {currentTab === 'desk' && (
              <div className="animate-fadeIn">
                <RegistrationDesk
                  events={events}
                  selectedEventId={selectedEventId}
                  setSelectedEventId={setSelectedEventId}
                  activeDeviceId={deviceId}
                  onCheckInCompleted={() => setRefreshTrigger((prev) => prev + 1)}
                />
              </div>
            )}

            {/* TAB 8: AUDIT LOGS */}
            {currentTab === 'audit' && (
              <div className="animate-fadeIn">
                <AuditLogsView />
              </div>
            )}
          </>
        )}
      </main>

      {/* Parish Footer */}
      <footer className="border-t border-gray-200 bg-white py-4 px-6 text-center text-xs text-gray-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="font-semibold text-gray-700">
              Blessed Sacrament Catholic Parish
            </span>
            <span>• Buru-Phase III, Mumias Road, Nairobi</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span>Encrypted NFC Attendance Gate v1.2</span>
            <span>•</span>
            <span>Archdiocese of Nairobi</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
