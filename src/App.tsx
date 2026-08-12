import React, { useState } from 'react';
import { LayoutDashboard, Users, ClipboardCheck, Settings, UsersRound, Calendar, PieChart, GraduationCap, BarChart3 } from 'lucide-react';
import { AppProvider, useAppContext } from './AppContext';
import { DashboardOverview } from './components/DashboardOverview';
import { StudentDirectory } from './components/StudentDirectory';
import { AttendanceView } from './components/AttendanceView';
import { AttendanceAnalysisView } from './components/AttendanceAnalysisView';

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}

function MainLayout() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'directory' | 'attendance' | 'attendance_analysis'>('dashboard');
  const { quotaError } = useAppContext();

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20 hidden md:flex">
        <div className="px-6 py-8 border-b border-white/10">
          <div className="flex gap-2 mb-4">
            <img src="https://i.postimg.cc/x1yzrs3k/IMG-20220901-WA0001(1).jpg" alt="Logo SK AU Keramat" className="h-12 w-auto object-contain rounded-lg" referrerPolicy="no-referrer" />
            <img src="https://i.postimg.cc/bYsF95Q0/IMG-20220901-WA0002(1).jpg" alt="Logo TS25" className="h-12 w-auto object-contain rounded-lg" referrerPolicy="no-referrer" />
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-tight">SKAUK</h1>
              <p className="text-[10px] uppercase font-bold tracking-widest text-blue-400">Kokurikulum</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          <NavButton 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="Dashboard Utama"
          />
          <NavButton 
            active={currentView === 'directory'} 
            onClick={() => setCurrentView('directory')}
            icon={<UsersRound size={20} />}
            label="Data Murid"
          />
          <NavButton 
            active={currentView === 'attendance'} 
            onClick={() => setCurrentView('attendance')}
            icon={<ClipboardCheck size={20} />}
            label="Kehadiran"
          />
          <NavButton 
            active={currentView === 'attendance_analysis'} 
            onClick={() => setCurrentView('attendance_analysis')}
            icon={<BarChart3 size={20} />}
            label="Analisis Kehadiran"
          />
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <div className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center">
              <Settings size={18} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Mod Awam</p>
              <p className="text-xs text-slate-500">Akses Guru</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between z-20 shadow-md">
          <div className="flex bg-slate-900 items-center gap-2">
            <div className="hidden sm:flex gap-1.5 mr-1">
              <img src="https://i.postimg.cc/x1yzrs3k/IMG-20220901-WA0001(1).jpg" alt="Logo SK AU Keramat" className="h-8 w-auto object-contain rounded-md" referrerPolicy="no-referrer" />
              <img src="https://i.postimg.cc/bYsF95Q0/IMG-20220901-WA0002(1).jpg" alt="Logo TS25" className="h-8 w-auto object-contain rounded-md" referrerPolicy="no-referrer" />
            </div>
            <div className="bg-blue-600 p-1.5 rounded-lg">
               <GraduationCap size={20} />
            </div>
            <h1 className="text-lg font-black tracking-wide">SKAUK</h1>
          </div>
          <div className="flex items-center gap-3">
            <select 
              className="bg-slate-800 border-none text-sm font-bold rounded-lg py-2 pl-3 px-8 text-white focus:ring-0 max-w-[140px]"
              value={currentView}
              onChange={(e) => setCurrentView(e.target.value as any)}
            >
              <option value="dashboard">Dashboard</option>
              <option value="directory">Data Murid</option>
              <option value="attendance">Kehadiran</option>
              <option value="attendance_analysis">Analisis Kehadiran</option>
            </select>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full">
          {quotaError && (
            <div className="bg-red-50 border-b border-red-100 p-4 mb-4">
              <div className="max-w-7xl mx-auto flex items-start gap-3 text-red-800">
                <div className="bg-red-100 p-2 rounded-lg shrink-0">
                  <Settings size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-red-900">Had Kuota Pangkalan Data Dicapai</h3>
                  <p className="text-sm mt-1">
                    Maaf, sistem telah mencapai had percuma membaca data harian dari Firestore. 
                    Anda boleh mencuba lagi esok setelah kuota diset semula, atau hubungi pentadbir sistem untuk menaik taraf pelan pangkalan data (Blaze Plan).
                  </p>
                  <p className="text-xs opacity-75 mt-2 font-mono">{quotaError}</p>
                </div>
              </div>
            </div>
          )}
          <div className="max-w-7xl mx-auto p-4 md:p-8 pb-32">
            {currentView === 'dashboard' && <DashboardOverview />}
            {currentView === 'directory' && <StudentDirectory />}
            {currentView === 'attendance' && <AttendanceView />}
            {currentView === 'attendance_analysis' && <AttendanceAnalysisView />}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
        active 
          ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-sm' 
          : 'hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

