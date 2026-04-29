import React, { useState, useMemo, useEffect } from 'react';
import { ClipboardCheck, Calendar, Filter, Users, CheckCircle2, XCircle, Search } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { UNIT_OPTIONS, KategoriUnit } from '../data';
import { cn } from '../data';

const normalizeUnit = (u?: string) => {
  if (!u) return '';
  const t = u.trim();
  if (t === '-' || t.toLowerCase() === 'tiada' || t === '') return '';
  return t.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
};

export function AttendanceView() {
  const { students, attendance, markAttendance, markAllAttendance } = useAppContext();
  
  // Available dates based on mock data + today + local additions
  const todayStr = new Date().toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedKategori, setSelectedKategori] = useState<KategoriUnit | 'Semua'>('Semua');
  const [filterAliran, setFilterAliran] = useState('Semua');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  const aliranOptions = useMemo(() => {
    const list = Array.from(new Set(students.map(s => normalizeUnit(s.aliran)))).filter(Boolean);
    if(list.length === 0) return ["Tahun 4", "Tahun 5", "Tahun 6"];
    return list.sort((a,b) => a.localeCompare(b));
  }, [students]);

  // Dynamically compute valid units based purely on actual imported student data
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

  // Reset selectedUnit if it doesn't exist in the newly selected category, but keep 'Semua' always valid
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
    if (filterKelas !== 'Semua') {
      list = list.filter(s => normalizeUnit(s.kelas) === filterKelas);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.mykid.includes(q));
    }
    // Sort by aliran, kelas then name
    return list.sort((a, b) => {
      const aliranA = normalizeUnit(a.aliran);
      const aliranB = normalizeUnit(b.aliran);
      if (aliranA !== aliranB) return aliranA.localeCompare(aliranB);
      const aKelas = normalizeUnit(a.kelas);
      const bKelas = normalizeUnit(b.kelas);
      if (aKelas !== bKelas) return aKelas.localeCompare(bKelas);
      return a.name.localeCompare(b.name);
    });
  }, [students, selectedKategori, selectedUnit, filterAliran, filterKelas, searchQuery]);

  // If viewing 'Semua' units, we need a helper to check if they are present natively
  const isStudentPresent = (student: typeof students[0]) => {
     const tUnits = getStudentTargetUnits(student);
     if (tUnits.length === 0) return false;
     return tUnits.some(u => !!attendance[selectedDate]?.[u]?.[student.id]);
  };

  const unitAttendance = attendance[selectedDate]?.[selectedUnit] || {};
  
  const kelasOptions = useMemo(() => {
    const list = students.filter(s => filterAliran === 'Semua' || normalizeUnit(s.aliran) === filterAliran);
    // Don't include '-' or empty as valid class filters if we can avoid it.
    return Array.from(new Set(list.map(s => normalizeUnit(s.kelas)))).filter(c => c !== "-" && c !== "").sort();
  }, [students, filterAliran]);

  const handleMarkAll = (isPresent: boolean) => {
    const grouped: Record<string, string[]> = {};
    currentUnitStudents.forEach(s => {
      const tUnits = getStudentTargetUnits(s);
      tUnits.forEach(u => {
        if (!grouped[u]) grouped[u] = [];
        grouped[u].push(s.id);
      });
    });
    Object.entries(grouped).forEach(([u, ids]) => {
      markAllAttendance(selectedDate, u, ids, isPresent);
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Pengurusan Kehadiran</h2>
          <p className="text-sm font-bold text-slate-500 mt-1">Rekod kehadiran aktiviti kokurikulum</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 px-4 rounded-xl shadow-sm border border-slate-100">
          <Calendar size={20} className="text-blue-500" />
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-none font-black text-sm text-slate-800 focus:ring-0 outline-none pr-8 py-2 min-w-[140px]"
          />
        </div>
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

          <div className="space-y-4">
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Unit, Aliran & Kelas</p>
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
                onChange={(e) => {
                  setFilterAliran(e.target.value);
                  setFilterKelas('Semua');
                }}
              >
                <option value="Semua">Semua Aliran</option>
                {aliranOptions.map(a => (
                   <option key={a} value={a}>{a.toUpperCase()}</option>
                ))}
              </select>
              <select
                className="px-4 py-2 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
              >
                <option value="Semua">Semua Kelas</option>
                {kelasOptions.map(cls => (
                  <option key={cls} value={cls}>{cls.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance List */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">Senarai Nama Ahli</h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto mt-2 md:mt-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari nama / no KP..."
                className="w-full sm:w-48 pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleMarkAll(true)}
                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase shadow-sm hover:bg-emerald-700 transition-colors"
              >
                Tanda Hadir
              </button>
              <button 
                onClick={() => handleMarkAll(false)}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-black uppercase hover:bg-slate-300 transition-colors"
              >
                Kosongkan
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Nama Murid</th>
                <th className="px-6 py-4">Aliran</th>
                <th className="px-6 py-4">Kelas</th>
                <th className="px-6 py-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentUnitStudents.length > 0 ? (
                currentUnitStudents.map((s) => {
                  const isPresent = isStudentPresent(s);
                  const targetUnits = getStudentTargetUnits(s);
                  return (
                    <tr key={s.id} className={cn("transition-colors", isPresent ? "bg-emerald-50/30" : "hover:bg-slate-50")}>
                      <td className="px-6 py-3">
                        {isPresent ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 size={18} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                            <XCircle size={18} />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-sm font-black text-slate-800">{s.name}</p>
                        <p className="text-xs font-bold text-slate-500">{s.mykid}</p>
                        {selectedUnit === 'Semua' && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {targetUnits.map(u => (
                              <span key={u} className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] uppercase font-black tracking-wider">
                                {u}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm font-bold text-slate-700">{s.aliran}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm font-bold text-slate-600">{s.kelas}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => {
                             targetUnits.forEach(u => markAttendance(selectedDate, u, s.id, !isPresent))
                          }}
                          className={cn(
                            "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                            isPresent 
                              ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" 
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          {isPresent ? 'Batalkan' : 'Tanda Hadir'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">
                    Tiada ahli direkodkan untuk padanan ini.
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
