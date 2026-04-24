import React, { useMemo, useState, useEffect } from 'react';
import { Users, User, UserRound, GraduationCap, Shield, Target, Dribbble, Flag, ClipboardCheck, Calendar, Download, RefreshCw } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { UNIT_OPTIONS, KategoriUnit } from '../data';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const normalizeUnit = (u?: string) => {
  if (!u) return '';
  const t = u.trim();
  if (t === '-' || t.toLowerCase() === 'tiada' || t === '') return '';
  // Convert strings to Title Case securely to group lowercase anomalies
  return t.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
};

export function DashboardOverview() {
  const { students, attendance } = useAppContext();
  const [selectedCategory, setSelectedCategory] = useState<KategoriUnit>('beruniform');

  const totalStudents = students.length;
  const boys = students.filter(s => s.gender === 'L').length;
  const girls = students.filter(s => s.gender === 'P').length;

  // Calculate overall attendance for the most recent date
  const dates = Object.keys(attendance).sort().reverse();
  const latestDate = dates[0] || '';
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Set default selected date once dates are available
  useEffect(() => {
    if (!selectedDate && latestDate) {
      setSelectedDate(latestDate);
    }
  }, [latestDate, selectedDate]);
  
  let totalAhli = 0;
  let totalHadir = 0;

  if (latestDate) {
    const records = attendance[latestDate];
    Object.values(records).forEach(unitRecord => {
      Object.keys(unitRecord).forEach(() => { totalAhli++; });
      Object.values(unitRecord).forEach(isPresent => { if (isPresent) totalHadir++; });
    });
  }
  
  const overallAttendanceRate = totalAhli > 0 ? Math.round((totalHadir / totalAhli) * 100) : 0;

  const getMembershipCount = (kategori: 'beruniform' | 'kelab' | 'sukan' | 'rumah') => {
    return students.filter(s => normalizeUnit(s.units[kategori]) !== '').length;
  };

  const alirans = useMemo(() => {
    const list = Array.from(new Set(students.map(s => s.aliran))).filter(a => a && normalizeUnit(a) !== "");
    if (list.length === 0) return ["Tahun 4", "Tahun 5", "Tahun 6"]; // fallback
    return list.sort((a, b) => a.localeCompare(b));
  }, [students]);

  // Data for Registration Table
  const tableData = useMemo(() => {
    const fromStudents = students.map(s => normalizeUnit(s.units[selectedCategory])).filter(Boolean);
    const dynamicUnits = Array.from(new Set(fromStudents)).sort();
    
    return dynamicUnits.map(unit => {
      const unitStudents = students.filter(s => normalizeUnit(s.units[selectedCategory]) === unit);
      
      const aliranStats: Record<string, { L: number, P: number }> = {};
      alirans.forEach(al => {
        aliranStats[al] = {
          L: unitStudents.filter(s => s.aliran === al && s.gender === 'L').length,
          P: unitStudents.filter(s => s.aliran === al && s.gender === 'P').length,
        }
      });

      return {
        unitName: unit,
        aliranStats,
        total: unitStudents.length
      };
    });
  }, [students, selectedCategory, alirans]);

  // Data for Attendance Table
  const attendanceTableData = useMemo(() => {
    const fromStudents = students.map(s => normalizeUnit(s.units[selectedCategory])).filter(Boolean);
    const dynamicUnits = Array.from(new Set(fromStudents)).sort();
    
    const dateRecords = attendance[selectedDate] || {};

    return dynamicUnits.map(unit => {
      const unitStudents = students.filter(s => normalizeUnit(s.units[selectedCategory]) === unit);
      const unitAttendance = dateRecords[unit] || {}; // this is student_id -> boolean
      
      const aliranStats: Record<string, { total: number, present: number, totalL: number, presentL: number, totalP: number, presentP: number }> = {};
      
      let overallTotal = 0;
      let overallPresent = 0;

      alirans.forEach(al => {
        const studentsInAliran = unitStudents.filter(s => s.aliran === al);
        const totalL = studentsInAliran.filter(s => s.gender === 'L').length;
        const totalP = studentsInAliran.filter(s => s.gender === 'P').length;
        const total = totalL + totalP;

        const presentL = studentsInAliran.filter(s => s.gender === 'L' && unitAttendance[s.id]).length;
        const presentP = studentsInAliran.filter(s => s.gender === 'P' && unitAttendance[s.id]).length;
        const present = presentL + presentP;

        overallTotal += total;
        overallPresent += present;

        aliranStats[al] = { total, present, totalL, presentL, totalP, presentP };
      });

      return {
        unitName: unit,
        aliranStats,
        overallTotal,
        overallPresent
      };
    });
  }, [students, selectedCategory, alirans, selectedDate, attendance]);

  const downloadAttendancePDF = () => {
    const doc = new jsPDF('landscape');
    
    // Title
    doc.setFontSize(16);
    doc.text('Laporan Analisis Kehadiran Mengikut Unit, Aliran & Jantina', 14, 20);
    
    // Metadata
    doc.setFontSize(10);
    const displayDate = selectedDate ? new Date(selectedDate).toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Tiada Tarikh';
    doc.text(`Tarikh: ${displayDate}`, 14, 30);
    doc.text(`Kategori: ${selectedCategory.toUpperCase()}`, 14, 35);

    const head = [
       [{ content: 'Nama Unit', rowSpan: 2 }, ...alirans.map(al => ({ content: al, colSpan: 2 })), { content: 'Jumlah', rowSpan: 2 }],
       [...alirans.flatMap(() => ['Lelaki', 'Perempuan'])]
    ];

    const body = attendanceTableData.map(row => {
       const rowData: any[] = [row.unitName.toUpperCase()];
       alirans.forEach(al => {
          const st = row.aliranStats[al];
          rowData.push(`${st.presentL}/${st.totalL}`);
          rowData.push(`${st.presentP}/${st.totalP}`);
       });
       rowData.push(`${row.overallPresent}/${row.overallTotal} (${row.overallTotal > 0 ? Math.round(row.overallPresent/row.overallTotal*100) : 0}%)`);
       return rowData;
    });

    autoTable(doc, {
        startY: 45,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], halign: 'center' },
        styles: { fontSize: 8, halign: 'center' },
        columnStyles: { 0: { halign: 'left' } }
    });

    const safeDate = selectedDate || 'Tiada_Tarikh';
    doc.save(`Analisis_Kehadiran_${safeDate}_${selectedCategory}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Dashboard Utama</h2>
          <p className="text-sm font-bold text-slate-500 mt-1">Ringkasan pendaftaran & kehadiran kokurikulum</p>
        </div>
        <div className="flex items-center gap-2">
          <button
             onClick={() => window.location.reload()}
             className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm transition-colors"
           >
             <RefreshCw size={18} />
             Refresh System
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Users size={32} />} title="Jumlah Murid" value={totalStudents.toString()} color="bg-indigo-600" />
        <StatCard icon={<UserRound size={32} />} title="Pelajar Lelaki" value={boys.toString()} color="bg-blue-500" />
        <StatCard icon={<UserRound size={32} />} title="Pelajar Perempuan" value={girls.toString()} color="bg-pink-500" />
        <StatCard 
          icon={<ClipboardCheck size={32} />} 
          title="Kehadiran Terkini" 
          value={`${overallAttendanceRate}%`} 
          subtitle={latestDate}
          color="bg-emerald-500" 
        />
      </div>

      {/* Overview Table for Categories */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-6 mt-6">
        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
          <Target size={24} className="text-blue-500" /> Analisis Pendaftaran Mengikut Kokurikulum
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <OverviewCard title="Badan Beruniform" value={getMembershipCount('beruniform')} total={totalStudents} icon={<Shield size={24} />} color="text-indigo-600 bg-indigo-50 border-indigo-100" />
          <OverviewCard title="Kelab & Persatuan" value={getMembershipCount('kelab')} total={totalStudents} icon={<Target size={24} />} color="text-emerald-600 bg-emerald-50 border-emerald-100" />
          <OverviewCard title="Sukan & Permainan" value={getMembershipCount('sukan')} total={totalStudents} icon={<Dribbble size={24} />} color="text-orange-600 bg-orange-50 border-orange-100" />
          <OverviewCard title="Rumah Sukan" value={getMembershipCount('rumah')} total={totalStudents} icon={<Flag size={24} />} color="text-rose-600 bg-rose-50 border-rose-100" />
        </div>

        {/* Breakdown Analysis Section */}
        <div className="border-t border-slate-100 pt-8 mt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h4 className="text-md font-black text-slate-800">Analisis Terperinci (Aliran & Jantina)</h4>
            <div className="flex flex-wrap gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              {(['beruniform', 'kelab', 'sukan', 'rumah'] as KategoriUnit[]).map(kat => (
                <button
                  key={kat}
                  onClick={() => setSelectedCategory(kat)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    selectedCategory === kat 
                      ? "bg-slate-800 text-white shadow-sm" 
                      : "bg-transparent text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {kat === 'beruniform' ? 'Uniform' : kat === 'kelab' ? 'Kelab' : kat === 'sukan' ? 'Sukan' : 'Rumah'}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 border-b-0">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 border-b border-slate-100" rowSpan={2}>Nama Unit</th>
                  {alirans.map(al => (
                    <th key={al} className="px-6 py-2 text-center border-l border-slate-100" colSpan={2}>{al}</th>
                  ))}
                  <th className="px-6 py-4 text-center border-l border-b border-slate-100" rowSpan={2}>Jumlah<br/>Keseluruhan</th>
                </tr>
                <tr>
                  {alirans.map(al => (
                    <React.Fragment key={`gender-${al}`}>
                      <th className="px-3 py-2 text-center border-l border-b border-slate-100 text-blue-600 bg-blue-50/30">L</th>
                      <th className="px-3 py-2 text-center border-l border-b border-slate-100 text-pink-600 bg-pink-50/30">P</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableData.map((row) => (
                  <tr key={row.unitName} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-700">{row.unitName.toUpperCase()}</td>
                    {alirans.map(al => (
                      <React.Fragment key={`data-${row.unitName}-${al}`}>
                        <td className="px-3 py-4 text-center border-l border-slate-100 font-bold text-blue-600">{row.aliranStats[al]?.L || 0}</td>
                        <td className="px-3 py-4 text-center border-l border-slate-100 font-bold text-pink-600">{row.aliranStats[al]?.P || 0}</td>
                      </React.Fragment>
                    ))}
                    <td className="px-6 py-4 text-center border-l border-slate-100 font-black text-slate-800 bg-slate-50/50">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown Attendance Section */}
        <div className="border-t border-slate-100 pt-8 mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h4 className="text-md font-black text-slate-800 flex items-center gap-2">
                <ClipboardCheck size={20} className="text-emerald-500" /> Analisis Kehadiran Terperinci
              </h4>
              <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Kehadiran: Lelaki (L), Perempuan (P)</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded-xl drop-shadow-sm border border-slate-700">
                <Calendar size={16} className="text-slate-300" />
                <input
                  type="date"
                  className="bg-transparent border-none font-bold text-sm text-white focus:ring-0 outline-none [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <button
                onClick={downloadAttendancePDF}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
              >
                <Download size={16} />
                Muat Turun PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 border-b-0">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-emerald-50/50 text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 border-b border-slate-100" rowSpan={2}>Nama Unit</th>
                  {alirans.map(al => (
                    <th key={`att-${al}`} className="px-6 py-2 text-center border-l border-slate-100" colSpan={2}>{al}</th>
                  ))}
                  <th className="px-6 py-4 text-center border-l border-b border-slate-100" rowSpan={2}>Jum. Hadir /<br/>Jum. Ahli</th>
                  <th className="px-6 py-4 text-center border-l border-b border-slate-100" rowSpan={2}>Kadar<br/>Kehadiran</th>
                </tr>
                <tr>
                  {alirans.map(al => (
                    <React.Fragment key={`att-gender-${al}`}>
                      <th className="px-2 py-2 text-center border-l border-b border-slate-100 text-blue-600 bg-blue-50/20">L</th>
                      <th className="px-2 py-2 text-center border-l border-b border-slate-100 text-pink-600 bg-pink-50/20">P</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceTableData.length > 0 ? (
                  attendanceTableData.map((row) => (
                    <tr key={`att-row-${row.unitName}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-black text-slate-700">{row.unitName.toUpperCase()}</td>
                      {alirans.map(al => {
                        const st = row.aliranStats[al];
                        return (
                          <React.Fragment key={`att-data-${row.unitName}-${al}`}>
                            <td className="px-2 py-3 text-center border-l border-slate-100">
                              <div className="flex flex-col items-center justify-center">
                                <span className="font-bold text-blue-600">{st.presentL}</span>
                                <span className="text-[10px] font-bold opacity-50">/ {st.totalL}</span>
                              </div>
                            </td>
                            <td className="px-2 py-3 text-center border-l border-slate-100">
                              <div className="flex flex-col items-center justify-center">
                                <span className="font-bold text-pink-600">{st.presentP}</span>
                                <span className="text-[10px] font-bold opacity-50">/ {st.totalP}</span>
                              </div>
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="px-6 py-4 text-center border-l border-slate-100 font-black text-slate-800 bg-slate-50/30">
                        {row.overallPresent} <span className="text-xs font-bold text-slate-400">/ {row.overallTotal}</span>
                      </td>
                      <td className="px-6 py-4 text-center border-l border-slate-100 font-black text-emerald-600 bg-emerald-50/30">
                        {row.overallTotal > 0 ? Math.round((row.overallPresent / row.overallTotal) * 100) : 0}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={alirans.length * 2 + 3} className="px-6 py-12 text-center text-slate-400 font-bold">
                      Sila masukkan tarikh kehadiran rekod yang sah.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, subtitle, color }: { icon: React.ReactNode, title: string, value: string, subtitle?: string, color: string }) {
  return (
    <div className={`p-6 rounded-[2rem] text-white flex items-center justify-between shadow-lg ${color}`}>
      <div>
        <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-3xl font-black">{value}</p>
        {subtitle && <p className="text-[10px] font-bold opacity-80 mt-1 uppercase">{subtitle}</p>}
      </div>
      <div className="bg-white/20 p-4 rounded-xl">
        {icon}
      </div>
    </div>
  );
}

function OverviewCard({ title, value, total, icon, color }: { title: string, value: number, total: number, icon: React.ReactNode, color: string }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`flex flex-col gap-4 p-5 rounded-2xl border ${color} bg-opacity-30`}>
      <div className="flex items-center gap-3">
        <div className="p-3 bg-white rounded-xl shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-[13px] font-black text-slate-800 leading-tight">{title}</p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Sistem Rekod</p>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
           <p className="text-3xl font-black text-slate-800">{value}</p>
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Murid Berdaftar</p>
        </div>
        <div className="text-right">
           <p className="text-xl font-black text-slate-800">{percentage}%</p>
        </div>
      </div>
    </div>
  );
}
