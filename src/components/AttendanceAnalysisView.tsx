import React, { useState, useMemo, useEffect } from 'react';
import { Filter, BarChart3, TrendingUp, Users, Download, Search } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { UNIT_OPTIONS, KategoriUnit } from '../data';
import { cn } from '../data';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const normalizeUnit = (u?: string) => {
  if (!u) return '';
  const t = u.trim();
  if (t === '-' || t.toLowerCase() === 'tiada' || t === '') return '';
  return t.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
};

export function AttendanceAnalysisView() {
  const { students, attendance } = useAppContext();
  
  const [selectedKategori, setSelectedKategori] = useState<KategoriUnit | 'Semua'>('Semua');
  const [filterAliran, setFilterAliran] = useState('Semua');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamically compute valid units based on what's actually in students data
  const availableUnits = useMemo(() => {
    let fromStudents: string[] = [];
    if (selectedKategori === 'Semua') {
      fromStudents = students.flatMap(s => [
        normalizeUnit(s.units.beruniform),
        normalizeUnit(s.units.kelab),
        normalizeUnit(s.units.sukan),
        normalizeUnit(s.units.rumah)
      ]);
    } else {
      fromStudents = students.map(s => normalizeUnit(s.units[selectedKategori as KategoriUnit]));
    }
    return Array.from(new Set(fromStudents.filter(Boolean))).sort();
  }, [students, selectedKategori]);

  const [selectedUnit, setSelectedUnit] = useState('Semua');

  useEffect(() => {
    if (selectedUnit !== 'Semua' && availableUnits.length > 0 && !availableUnits.includes(selectedUnit)) {
       setSelectedUnit('Semua');
    }
  }, [availableUnits, selectedUnit]);

  // Change default unit when generic category changes
  const handleKategoriChange = (kat: KategoriUnit | 'Semua') => {
    setSelectedKategori(kat);
    setSelectedUnit('Semua');
  };

  const aliranOptions = useMemo(() => {
    const list = Array.from(new Set(students.map(s => normalizeUnit(s.aliran)))).filter(Boolean);
    if(list.length === 0) return ["Tahun 4", "Tahun 5", "Tahun 6"];
    return list.sort((a,b) => a.localeCompare(b));
  }, [students]);

  // Get all unique dates from the attendance records restricted to current category/unit selection
  const allDates = useMemo(() => {
    const dates = new Set<string>();
    Object.entries(attendance).forEach(([date, unitsRecord]) => {
       const hasAttendanceForUnit = (unit: string) => {
         const unitAtt = unitsRecord[unit];
         if (!unitAtt) return false;
         return Object.values(unitAtt).some(isPresent => isPresent === true);
       };

       if (selectedUnit !== 'Semua') {
         if (hasAttendanceForUnit(selectedUnit)) dates.add(date);
       } else if (selectedKategori !== 'Semua') {
         // Category is selected, check if any unit in that category has a record
         const hasRecord = availableUnits.some(u => hasAttendanceForUnit(u));
         if (hasRecord) dates.add(date);
       } else {
         // All categories are selected, just make sure there's at least one valid unit record
         const unitKeys = Object.keys(unitsRecord);
         const hasValidRecord = unitKeys.some(k => k && k.trim() !== "" && hasAttendanceForUnit(k));
         if (hasValidRecord) dates.add(date);
       }
    });
    return Array.from(dates).sort();
  }, [attendance, selectedKategori, selectedUnit, availableUnits]);

  // If filterDate is selected but it's no longer in the valid dates for the selected category/unit, reset it
  useEffect(() => {
    if (filterDate && filterDate !== 'Semua' && !allDates.includes(filterDate)) {
       setFilterDate('');
    }
  }, [allDates, filterDate]);

  const getStudentTargetUnits = (s: typeof students[0]) => {
    if (selectedKategori !== 'Semua') {
       const u = normalizeUnit(s.units[selectedKategori as KategoriUnit]);
       if (selectedUnit !== 'Semua') {
           return u === selectedUnit ? [u] : [];
       }
       return u ? [u] : [];
    } else {
       const allU = [
         normalizeUnit(s.units.beruniform),
         normalizeUnit(s.units.kelab),
         normalizeUnit(s.units.sukan),
         normalizeUnit(s.units.rumah)
       ].filter(Boolean);

       if (selectedUnit !== 'Semua') {
           return allU.includes(selectedUnit) ? [selectedUnit] : [];
       }
       return allU;
    }
  };

  const currentUnitStudents = useMemo(() => {
    let list = students.filter(s => getStudentTargetUnits(s).length > 0);
    
    if (filterAliran !== 'Semua') {
      list = list.filter(s => normalizeUnit(s.aliran) === normalizeUnit(filterAliran));
    }
    return list.sort((a, b) => {
      const aKelas = normalizeUnit(a.kelas);
      const bKelas = normalizeUnit(b.kelas);
      if (aKelas !== bKelas) return aKelas.localeCompare(bKelas);
      return a.name.localeCompare(b.name);
    });
  }, [students, selectedKategori, selectedUnit, filterAliran]);

  // Calculate statistics for the selected criteria
  const studentStats = useMemo(() => {
    return currentUnitStudents.map(student => {
      let presentCount = 0;
      let totalMeetings = 0;
      
      const datesToProcess = (!filterDate || filterDate === 'Semua') ? allDates : [filterDate];
      
      datesToProcess.forEach(date => {
        const tUnits = getStudentTargetUnits(student);
        let presentForAnyDateUnit = false;
        let meetsAnyDateUnit = false;

        tUnits.forEach(u => {
           const dateRecord = attendance[date]?.[u];
           // If dateRecord exists, it means attendance was taken for this unit on this date
           if (dateRecord) {
             meetsAnyDateUnit = true;
             // Check if student was present
             if (dateRecord[student.id]) {
                presentForAnyDateUnit = true;
             }
           }
        });

        if (filterDate && filterDate !== 'Semua') {
          totalMeetings++;
          if (presentForAnyDateUnit) {
            presentCount++;
          }
        } else {
          if (meetsAnyDateUnit) {
            totalMeetings++;
            if (presentForAnyDateUnit) {
              presentCount++;
            }
          }
        }
      });
      
      const rate = totalMeetings > 0 ? Math.round((presentCount / totalMeetings) * 100) : 0;
      return {
        ...student,
        presentCount,
        totalMeetings,
        rate
      };
    });
  }, [currentUnitStudents, attendance, allDates, selectedUnit, filterDate]);

  // Overall statistics for the selected unit
  const overallStats = useMemo(() => {
    let totalPresent = 0;
    let totalExpected = 0;
    
    studentStats.forEach(s => {
      totalPresent += s.presentCount;
      totalExpected += s.totalMeetings;
    });
    
    const rate = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;
    
    return {
      totalStudents: studentStats.length,
      averageRate: rate,
      perfectAttendance: studentStats.filter(s => s.rate === 100 && s.totalMeetings > 0).length
    };
  }, [studentStats]);

  const exportAnalysisToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.text('Laporan Analisis Kehadiran Kokurikulum', 14, 20);
    
    // Metadata
    doc.setFontSize(10);
    doc.text(`Tarikh: ${filterDate || 'Keseluruhan Tarikh'}`, 14, 30);
    doc.text(`Kategori: ${selectedKategori === 'Semua' ? 'Semua Kategori' : selectedKategori.replace(/\b\w/g, l => l.toUpperCase())}`, 14, 35);
    doc.text(`Unit: ${selectedUnit}`, 14, 40);
    doc.text(`Aliran: ${filterAliran}`, 14, 45);

    let currentY = 55;

    // Table 1: Analisis Mengikut Aliran & Jantina
    if (aliranGenderStats.length > 0) {
      doc.setFontSize(12);
      doc.text('Analisis Mengikut Aliran & Jantina', 14, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Aliran', 'Lelaki', 'Perempuan', 'Keseluruhan']],
        body: aliranGenderStats.map(stat => [
          stat.aliran,
          selectedUnit !== 'Semua' 
            ? `${stat.lelaki.present} Hadir (${stat.lelaki.count} Murid)`
            : selectedKategori === 'Semua'
            ? `${stat.lelaki.count} Murid`
            : `${stat.lelaki.present}/${stat.lelaki.expected} (${stat.lelaki.expected ? Math.round((stat.lelaki.present / stat.lelaki.expected) * 100) : 0}%)`,
          selectedUnit !== 'Semua'
            ? `${stat.perempuan.present} Hadir (${stat.perempuan.count} Murid)`
            : selectedKategori === 'Semua'
            ? `${stat.perempuan.count} Murid`
            : `${stat.perempuan.present}/${stat.perempuan.expected} (${stat.perempuan.expected ? Math.round((stat.perempuan.present / stat.perempuan.expected) * 100) : 0}%)`,
          selectedUnit !== 'Semua'
            ? `${stat.total.present} Hadir`
            : selectedKategori === 'Semua'
            ? `${stat.total.count} Murid`
            : `${stat.total.expected ? Math.round((stat.total.present / stat.total.expected) * 100) : 0}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 10 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Table 2: Laporan Individu
    if (studentStats.length > 0) {
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(12);
      doc.text('Laporan Individu', 14, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Nama Murid', 'Kelas', 'Jantina', 'Rekod Hadir', 'Kadar (%)']],
        body: studentStats.map(s => [
          s.name,
          s.kelas,
          s.gender,
          `${s.presentCount}/${s.totalMeetings}`,
          `${s.rate}%`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] },
        styles: { fontSize: 8 },
      });
    }

    const reportName = `Analisis_Kehadiran_${(!filterDate || filterDate === 'Semua') ? 'Keseluruhan' : filterDate}_${selectedKategori}_${selectedUnit}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    doc.save(reportName);
  };

  // Breakdown statistics by Aliran and Gender
  const aliranGenderStats = useMemo(() => {
    const stats: Record<string, {
      aliran: string,
      total: { count: number, present: number, expected: number },
      lelaki: { count: number, present: number, expected: number },
      perempuan: { count: number, present: number, expected: number },
    }> = {};

    studentStats.forEach(s => {
      const aliran = normalizeUnit(s.aliran) || 'Tiada Aliran';
      if (!stats[aliran]) {
        stats[aliran] = {
          aliran,
          total: { count: 0, present: 0, expected: 0 },
          lelaki: { count: 0, present: 0, expected: 0 },
          perempuan: { count: 0, present: 0, expected: 0 }
        };
      }

      // Add to overall total
      stats[aliran].total.count++;
      stats[aliran].total.present += s.presentCount;
      stats[aliran].total.expected += s.totalMeetings;

      // Add to gender
      if (s.gender === 'L') {
        stats[aliran].lelaki.count++;
        stats[aliran].lelaki.present += s.presentCount;
        stats[aliran].lelaki.expected += s.totalMeetings;
      } else if (s.gender === 'P') {
        stats[aliran].perempuan.count++;
        stats[aliran].perempuan.present += s.presentCount;
        stats[aliran].perempuan.expected += s.totalMeetings;
      }
    });

    return Object.values(stats).sort((a, b) => a.aliran.localeCompare(b.aliran));
  }, [studentStats]);

  const filteredStudentStats = useMemo(() => {
    if (!searchQuery) return studentStats;
    const q = searchQuery.toLowerCase();
    return studentStats.filter(s => s.name.toLowerCase().includes(q) || s.mykid.includes(q));
  }, [studentStats, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Analisis Kehadiran</h2>
        <p className="text-sm font-bold text-slate-500 mt-1">Laporan penuh kehadiran mengikut unit dan aliran</p>
      </div>

      {/* Control Panel */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="space-y-4">
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Kategori Unit</p>
            <div className="flex flex-wrap gap-2">
              {(['Semua', 'beruniform', 'kelab', 'sukan', 'rumah'] as const).map(kat => (
                <button
                  key={kat}
                  onClick={() => handleKategoriChange(kat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                    selectedKategori === kat 
                      ? "bg-slate-800 text-white shadow-md" 
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {kat === 'Semua' ? 'Semua Kategori' : kat === 'beruniform' ? 'Uniform' : kat === 'kelab' ? 'Kelab' : kat === 'sukan' ? 'Sukan' : 'Rumah'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start md:items-center gap-4">
            <button
              onClick={exportAnalysisToPDF}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
              title="Muat Turun Analisis"
            >
              <Download size={20} />
              <span className="hidden md:inline">Muat Turun Analisis</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Unit, Aliran & Tarikh</p>
          <div className="flex flex-wrap gap-2">
            <select
              className="px-4 py-2 bg-blue-50 text-blue-700 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
            >
              <option value="Semua">Semua Unit</option>
              {availableUnits.map(u => (
                <option key={u} value={u}>{u.toUpperCase()}</option>
              ))}
            </select>
            <select
              className="px-4 py-2 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
              value={filterAliran}
              onChange={(e) => setFilterAliran(e.target.value)}
            >
              <option value="Semua">Semua Aliran</option>
              {aliranOptions.map(a => (
                <option key={a} value={a}>{a.toUpperCase()}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1 rounded-xl drop-shadow-sm border border-slate-700">
              <select
                className="bg-transparent border-none font-bold text-sm text-white focus:ring-0 outline-none appearance-none pr-6"
                value={filterDate || ""}
                onChange={(e) => setFilterDate(e.target.value)}
              >
                <option value="" className="text-slate-800">Semua Tarikh</option>
                {allDates.map(date => (
                  <option key={date} value={date} className="text-slate-800">
                     {new Date(date).toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 flex items-start gap-4">
          <div className="bg-slate-200 p-3 rounded-xl text-slate-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Jumlah Ahli Penapis</p>
            <p className="text-3xl font-black text-slate-800 leading-none">{overallStats.totalStudents}</p>
          </div>
        </div>
        
        <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex items-start gap-4">
          <div className="bg-blue-200 p-3 rounded-xl text-blue-700">
            <BarChart3 size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Purata Kehadiran Unit</p>
            <p className="text-3xl font-black text-blue-700 leading-none">{overallStats.averageRate}%</p>
          </div>
        </div>

        <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 flex items-start gap-4">
          <div className="bg-emerald-200 p-3 rounded-xl text-emerald-700">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Kehadiran Penuh (100%)</p>
            <p className="text-3xl font-black text-emerald-700 leading-none">{overallStats.perfectAttendance}</p>
          </div>
        </div>
      </div>

      {/* Aliran and Gender stats table */}
      {aliranGenderStats.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">Analisis Mengikut Aliran & Jantina</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Aliran</th>
                  <th className="px-6 py-4 text-center">Lelaki (L)</th>
                  <th className="px-6 py-4 text-center">Perempuan (P)</th>
                  <th className="px-6 py-4 text-center">Keseluruhan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {aliranGenderStats.map(stat => {
                  const rateL = stat.lelaki.expected > 0 ? Math.round((stat.lelaki.present / stat.lelaki.expected) * 100) : 0;
                  const rateP = stat.perempuan.expected > 0 ? Math.round((stat.perempuan.present / stat.perempuan.expected) * 100) : 0;
                  const rateTotal = stat.total.expected > 0 ? Math.round((stat.total.present / stat.total.expected) * 100) : 0;
                  
                  return (
                    <tr key={stat.aliran} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{stat.aliran}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          {selectedUnit !== 'Semua' ? (
                            <>
                              <span className="text-sm font-black text-blue-600">{stat.lelaki.present} Hadir</span>
                              <span className="text-xs font-bold text-slate-400">daripada {stat.lelaki.count} Murid</span>
                            </>
                          ) : selectedKategori === 'Semua' ? (
                            <>
                              <span className="text-sm font-black text-blue-600">{stat.lelaki.count}</span>
                              <span className="text-xs font-bold text-slate-400">Murid Lelaki</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-black text-blue-600">{rateL}% ({stat.lelaki.present}/{stat.lelaki.expected})</span>
                              <span className="text-xs font-bold text-slate-400">{stat.lelaki.count} Murid</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          {selectedUnit !== 'Semua' ? (
                            <>
                              <span className="text-sm font-black text-rose-600">{stat.perempuan.present} Hadir</span>
                              <span className="text-xs font-bold text-slate-400">daripada {stat.perempuan.count} Murid</span>
                            </>
                          ) : selectedKategori === 'Semua' ? (
                            <>
                              <span className="text-sm font-black text-rose-600">{stat.perempuan.count}</span>
                              <span className="text-xs font-bold text-slate-400">Murid Perempuan</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-black text-rose-600">{rateP}% ({stat.perempuan.present}/{stat.perempuan.expected})</span>
                              <span className="text-xs font-bold text-slate-400">{stat.perempuan.count} Murid</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                           {selectedUnit !== 'Semua' ? (
                             <>
                              <span className="text-sm font-black text-slate-800">{stat.total.present} Hadir</span>
                              <span className="text-xs font-bold text-slate-400">Keseluruhan ({stat.total.count})</span>
                             </>
                           ) : selectedKategori === 'Semua' ? (
                             <>
                              <span className="text-sm font-black text-slate-800">{stat.total.count}</span>
                              <span className="text-xs font-bold text-slate-400">Murid Keseluruhan</span>
                             </>
                           ) : (
                             <>
                              <span className="text-sm font-black text-slate-800">{rateTotal}%</span>
                              <span className="text-xs font-bold text-slate-400">{stat.total.count} Murid Keseluruhan</span>
                             </>
                           )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student stats table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">Laporan Individu Murid</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Cari nama / no KP..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Nama Murid</th>
                <th className="px-6 py-4">Tahun & Kelas</th>
                <th className="px-6 py-4 text-center">Rekod (Hadir/Aktiviti)</th>
                <th className="px-6 py-4">Kadar Kehadiran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStudentStats.length > 0 ? (
                filteredStudentStats.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-800">{s.name}</p>
                      <p className="text-xs font-bold text-slate-500">{s.mykid}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700 inline-block mr-2">{s.aliran}</span>
                      <span className="text-xs font-black text-slate-400">{s.kelas}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-black text-slate-700">{s.presentCount}</span>
                      <span className="text-xs font-bold text-slate-400 mx-1">/</span>
                      <span className="text-sm font-bold text-slate-500">{s.totalMeetings}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[100px]">
                          <div 
                            className={cn(
                              "h-2.5 rounded-full",
                              s.rate >= 80 ? "bg-emerald-500" : s.rate >= 50 ? "bg-amber-500" : "bg-rose-500"
                            )} 
                            style={{ width: `${s.rate}%` }}
                          ></div>
                        </div>
                        <span className={cn(
                          "text-sm font-black",
                          s.rate >= 80 ? "text-emerald-700" : s.rate >= 50 ? "text-amber-700" : "text-rose-700"
                        )}>
                          {s.rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold">
                    Tiada rekod pendaftaran untuk ditunjukkan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
