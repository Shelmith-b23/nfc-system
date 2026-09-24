import React, { useState, useEffect } from 'react';
import {
  Church,
  Radio,
  Wifi,
  WifiOff,
  Clock,
  Shield,
  Smartphone,
  Layers,
  Users,
  CreditCard,
  BarChart3,
  Calendar,
  ClipboardCheck,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { UserRole } from '../types/index.js';

export type NavTab =
  | 'checkin'
  | 'desk'
  | 'analytics'
  | 'events'
  | 'cards'
  | 'participants'
  | 'public'
  | 'audit';

interface NavbarProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  activeDeviceId: string;
  setActiveDeviceId: (devId: string) => void;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  offlineQueueCount?: number;
  onResetSeed?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  userRole,
  setUserRole,
  activeDeviceId,
  setActiveDeviceId,
  isOffline,
  setIsOffline,
  offlineQueueCount,
  onResetSeed,
}) => {
  const [nairobiTime, setNairobiTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      // Format to Africa/Nairobi
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      };
      setNairobiTime(new Intl.DateTimeFormat('en-KE', options).format(now));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { id: 'checkin', label: 'NFC Check-In', icon: Radio, highlight: true },
    { id: 'desk', label: 'Registration Desk', icon: ClipboardCheck },
    { id: 'analytics', label: 'Live Attendance', icon: BarChart3 },
    { id: 'events', label: 'Parish Events', icon: Calendar },
    { id: 'cards', label: 'NFC Cards', icon: CreditCard },
    { id: 'participants', label: 'Participants', icon: Users },
    { id: 'public', label: 'Public Portal', icon: Layers },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#801B2E] text-white shadow-lg border-b border-[#D4AF37]/30">
      {/* Top Utility Parish Bar */}
      <div className="bg-[#5C1321] text-xs px-4 py-1.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-white/80">
          <span className="font-semibold text-[#EAD098]">Blessed Sacrament Catholic Parish</span>
          <span className="text-white/40">•</span>
          <span className="hidden sm:inline">Buru-Phase III, Mumias Road, Nairobi</span>
          <span className="text-white/40">•</span>
          <div className="flex items-center gap-1 text-[#EAD098] font-mono">
            <Clock className="w-3 h-3" />
            <span>{nairobiTime} EAT</span>
          </div>
        </div>

        {/* Quick controls: Role Switcher & Offline Simulator */}
        <div className="flex items-center gap-3">
          {/* Offline Toggle */}
          <button
            id="offline-toggle-button"
            onClick={() => setIsOffline(!isOffline)}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
              isOffline
                ? 'bg-amber-500 text-black font-bold animate-pulse'
                : 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-800/60'
            }`}
            title="Toggle simulated offline network connectivity to test offline NFC queue & sync"
          >
            {isOffline ? (
              <>
                <WifiOff className="w-3 h-3 text-black" />
                <span>OFFLINE MODE ({offlineQueueCount} queued)</span>
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>ONLINE ✓</span>
              </>
            )}
          </button>

          {/* Device Selector */}
          <div className="hidden md:flex items-center gap-1.5 bg-black/25 px-2 py-0.5 rounded border border-white/15">
            <Smartphone className="w-3 h-3 text-[#EAD098]" />
            <select
              id="active-device-select"
              value={activeDeviceId}
              onChange={(e) => setActiveDeviceId(e.target.value)}
              className="bg-transparent text-[11px] text-white font-mono focus:outline-none cursor-pointer"
            >
              <option value="BSC-EVENT-01" className="bg-[#5C1321] text-white">
                BSC-EVENT-01 (Main Gate)
              </option>
              <option value="BSC-EVENT-02" className="bg-[#5C1321] text-white">
                BSC-EVENT-02 (Youth Entrance)
              </option>
              <option value="BSC-EVENT-03" className="bg-[#5C1321] text-white">
                BSC-EVENT-03 (Reg Desk)
              </option>
            </select>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center gap-1.5 bg-black/25 px-2 py-0.5 rounded border border-white/15">
            <Shield className="w-3 h-3 text-[#EAD098]" />
            <select
              id="active-role-select"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as UserRole)}
              className="bg-transparent text-[11px] font-semibold text-[#EAD098] focus:outline-none cursor-pointer"
            >
              <option value="SUPER_ADMIN" className="bg-[#5C1321] text-white">
                Role: Super Admin
              </option>
              <option value="EVENT_ADMIN" className="bg-[#5C1321] text-white">
                Role: Event Admin
              </option>
              <option value="CHECK_IN_OPERATOR" className="bg-[#5C1321] text-white">
                Role: Check-in Operator
              </option>
              <option value="PARTICIPANT" className="bg-[#5C1321] text-white">
                Role: Participant View
              </option>
            </select>
          </div>

          {/* Quick seed reset button */}
          <button
            id="reset-seed-data-btn"
            onClick={onResetSeed}
            className="text-white/60 hover:text-white p-1 transition-colors"
            title="Reset to canonical seed data"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Brand & Crest */}
        <div
          onClick={() => setCurrentTab('checkin')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#997C29] flex items-center justify-center shadow-md border border-[#F5E6B8]/40 group-hover:scale-105 transition-transform">
            <Church className="w-6 h-6 text-[#4A121E]" />
          </div>
          <div>
            <h1 className="font-serif text-lg md:text-xl font-bold tracking-tight text-white leading-tight flex items-center gap-2">
              BLESSED SACRAMENT
              <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-[#D4AF37] text-[#4A121E] font-bold">
                NFC PASS
              </span>
            </h1>
            <p className="text-[11px] text-[#EAD098] font-medium tracking-wide">
              Event Management & Attendance Check-In
            </p>
          </div>
        </div>

        {/* Desktop Nav Items */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#D4AF37] text-[#4A121E] shadow-sm font-bold'
                    : item.highlight
                    ? 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#4A121E]' : 'text-[#EAD098]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Horizontal Scrollable Nav */}
      <div className="lg:hidden flex overflow-x-auto px-3 py-1.5 gap-1.5 bg-[#6B1D2F] border-t border-white/10 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-[#D4AF37] text-[#4A121E] font-bold'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
