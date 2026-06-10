import React, { useState, useMemo, useRef } from 'react';
import { Search, Filter, Shield, Target, Dribbble, Flag, Download, Upload, RefreshCw, Trash2, Plus, Edit2, X } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { UNIT_OPTIONS, KategoriUnit, Student } from '../data';
import { cn } from '../data';
import * as xlsx from 'xlsx';

const normalizeUnit = (u?: string) => {
  if (!u) return '';
  const t = u.trim();
  if (t === '-' || t.toLowerCase() === 'tiada' || t === '') return '';
  return t.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
};

export function StudentDirectory() {
  const { students, importStudents, addStudent, updateStudent, deleteStudent, syncSystemDataToCloud, resetDatabase } = useAppContext();
  const [search, setSearch] = useState('');
  const [filterAliran, setFilterAliran] = useState('Semua');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterKategori, setFilterKategori] = useState<'Semua' | KategoriUnit>('Semua');
  const [filterUnit, setFilterUnit] = useState('Semua');
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, config: null | {title: string, message: string, onConfirm: () => void, isDestructive?: boolean}}>({isOpen: false, config: null});
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Student, 'id'>>({
    name: '',
    mykid: '',
    gender: 'L',
    aliran: '',
    kelas: '',
    units: {
      beruniform: '',
      kelab: '',
      sukan: '',
      rumah: ''
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.mykid.includes(search);
      const matchAliran = filterAliran === 'Semua' || normalizeUnit(s.aliran) === filterAliran;
      const matchKelas = filterKelas === 'Semua' || normalizeUnit(s.kelas) === filterKelas;
      const matchUnit = filterKategori === 'Semua' 
        ? true 
        : filterUnit === 'Semua' 
          ? true 
          : normalizeUnit(s.units[filterKategori]) === filterUnit;

      return matchSearch && matchAliran && matchKelas && matchUnit;
    }).sort((a, b) => {
      const aliranA = normalizeUnit(a.aliran);
      const aliranB = normalizeUnit(b.aliran);
      if (aliranA !== aliranB) return aliranA.localeCompare(aliranB);
      const aKelas = normalizeUnit(a.kelas);
      const bKelas = normalizeUnit(b.kelas);
      if (aKelas !== bKelas) return aKelas.localeCompare(bKelas);
      return a.name.localeCompare(b.name);
    });
  }, [students, search, filterAliran, filterKelas, filterKategori, filterUnit]);

  const aliranOptions = useMemo(() => {
    const list = Array.from(new Set(students.map(s => normalizeUnit(s.aliran)))).filter(Boolean);
    if(list.length === 0) return ["Tahun 4", "Tahun 5", "Tahun 6"];
    return list.sort((a,b) => a.localeCompare(b));
  }, [students]);

  const unitOptions = useMemo(() => {
    if (filterKategori === 'Semua') return [];
    const fromStudents = students.map(s => normalizeUnit(s.units[filterKategori])).filter(Boolean);
    return Array.from(new Set(fromStudents)).sort();
  }, [students, filterKategori]);
  
  const kelasOptions = useMemo(() => {
    const list = students.filter(s => filterAliran === 'Semua' || normalizeUnit(s.aliran) === filterAliran);
    return Array.from(new Set(list.map(s => normalizeUnit(s.kelas)))).filter(c => c !== "-" && c !== "").sort();
  }, [students, filterAliran]);

  const formKelasOptions = useMemo(() => {
    const list = students.filter(s => !formData.aliran || normalizeUnit(s.aliran) === normalizeUnit(formData.aliran));
    const classes = Array.from(new Set(list.map(s => normalizeUnit(s.kelas)))).filter(Boolean);
    if(classes.length === 0) return ["Ibnu Sina", "Ibnu Khaldun", "Ibnu Rushd", "Ibnu Battuta"];
    return classes.sort((a,b) => a.localeCompare(b));
  }, [students, formData.aliran]);

  const formBeruniformOptions = useMemo(() => {
    const list = Array.from(new Set(students.map(s => normalizeUnit(s.units.beruniform)))).filter(Boolean);
    return list.length > 0 ? list.sort((a,b) => a.localeCompare(b)) : UNIT_OPTIONS.beruniform;
  }, [students]);

  const formKelabOptions = useMemo(() => {
    const list = Array.from(new Set(students.map(s => normalizeUnit(s.units.kelab)))).filter(Boolean);
    return list.length > 0 ? list.sort((a,b) => a.localeCompare(b)) : UNIT_OPTIONS.kelab;
  }, [students]);

  const formSukanOptions = useMemo(() => {
    const list = Array.from(new Set(students.map(s => normalizeUnit(s.units.sukan)))).filter(Boolean);
    return list.length > 0 ? list.sort((a,b) => a.localeCompare(b)) : UNIT_OPTIONS.sukan;
  }, [students]);

  const formRumahOptions = useMemo(() => {
    const list = Array.from(new Set(students.map(s => normalizeUnit(s.units.rumah)))).filter(Boolean);
    return list.length > 0 ? list.sort((a,b) => a.localeCompare(b)) : UNIT_OPTIONS.rumah;
  }, [students]);

  const exportToExcel = () => {
    const dataToExport = filteredStudents.map(s => ({
      "Nama Murid": s.name,
      "MyKid": s.mykid,
      "Jantina": s.gender,
      "Aliran": s.aliran,
      "Kelas": s.kelas,
      "Unit Beruniform": s.units.beruniform,
      "Kelab / Persatuan": s.units.kelab,
      "Sukan / Permainan": s.units.sukan,
      "Rumah Sukan": s.units.rumah
    }));

    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Data Murid");
    xlsx.writeFile(workbook, "Data_Keahlian_Murid.xlsx");
  };

  const exportTemplateExcel = () => {
    const templateData = [
      {
        "Nama Murid": "Ahmad Bin Abu",
        "MyKid": "120101-14-1234",
        "Jantina": "L",
        "Aliran": "Tahun 4",
        "Kelas": "Ibnu Sina",
        "Unit Beruniform": "Pengakap",
        "Kelab / Persatuan": "STEM",
        "Sukan / Permainan": "Bola Sepak",
        "Rumah Sukan": "Merah"
      },
      {
        "Nama Murid": "Siti Binti Ali",
        "MyKid": "120202-14-5678",
        "Jantina": "P",
        "Aliran": "Tahun 5",
        "Kelas": "Ibnu Khaldun",
        "Unit Beruniform": "Tunas Puteri",
        "Kelab / Persatuan": "B. Melayu",
        "Sukan / Permainan": "Bola Jaring",
        "Rumah Sukan": "Biru"
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(templateData);
    
    // Auto-size columns slightly
    worksheet['!cols'] = [
      { wch: 30 }, // Nama
      { wch: 20 }, // Mykid
      { wch: 10 }, // Jantina
      { wch: 15 }, // Aliran
      { wch: 15 }, // Kelas
      { wch: 20 }, // Unit
      { wch: 20 }, // Kelab
      { wch: 20 }, // Sukan
      { wch: 20 }  // Rumah
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Format_Template");
    xlsx.writeFile(workbook, "Template_Import_Murid.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = xlsx.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json<any>(worksheet);

        const newStudents: Student[] = json.map((row) => {
          let rawId = String(row["MyKid"] || `std-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
          let safeId = rawId.replace(/[^a-zA-Z0-9_\-& ]/g, ''); // match isValidId
          if (!safeId) safeId = `std-${Date.now()}`;
          
          return {
            id: safeId.substring(0, 128),
            name: String(row["Nama Murid"] || "Tanpa Nama").trim().substring(0, 150),
            mykid: String(row["MyKid"] || "-").trim().substring(0, 20),
            aliran: normalizeUnit(String(row["Aliran"] || "-").substring(0, 50)) as any,
            kelas: String(row["Kelas"] || "-").trim().substring(0, 50) as any,
            gender: String(row["Jantina"]).toUpperCase().trim() === "P" ? "P" : "L",
            units: {
              beruniform: normalizeUnit(String(row["Unit Beruniform"] || "Tiada").substring(0, 100)),
              kelab: normalizeUnit(String(row["Kelab / Persatuan"] || "Tiada").substring(0, 100)),
              sukan: normalizeUnit(String(row["Sukan / Permainan"] || "Tiada").substring(0, 100)),
              rumah: normalizeUnit(String(row["Rumah Sukan"] || "Tiada").substring(0, 100))
            }
          };
        });

        await importStudents(newStudents);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        console.error("Error importing file:", error);
        alert(`Gagal memuat naik fail. Ralat: ${error instanceof Error ? error.message : "Sila pastikan format Excel tepat (rujuk template)."}`);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleSyncToCloud = async () => {
    setIsSyncing(true);
    await syncSystemDataToCloud();
    setIsSyncing(false);
  };

  const handleResetDatabase = async () => {
    setConfirmModal({
      isOpen: true,
      config: {
         title: "Kosongkan Pangkalan Data",
         message: "AWAS: Adakah anda pasti mahu memadam SEMUA rekod murid dan kehadiran secara kekal? Tindakan ini untuk memastikan pangkalan data kosong dan suci sebelum import fail baru. Tindakan ini tidak boleh diundur.",
         isDestructive: true,
         onConfirm: async () => {
            setIsResetting(true);
            try {
              await resetDatabase();
              alert("Pangkalan data (Database) telah berjaya dikosongkan. Sila muat naik fail Excel yang baru.");
            } catch (error) {
              console.error("Kesilapan ketika mengosongkan data", error);
            } finally {
              setIsResetting(false);
            }
         }
      }
    });
  };

  const openAddModal = () => {
    setEditingStudentId(null);
    setFormData({
      name: '',
      mykid: '',
      gender: 'L',
      aliran: '',
      kelas: '',
      units: {
        beruniform: '',
        kelab: '',
        sukan: '',
        rumah: ''
      }
    });
    setIsModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudentId(student.id);
    setFormData({
      name: student.name,
      mykid: student.mykid,
      gender: student.gender,
      aliran: student.aliran,
      kelas: student.kelas,
      units: {
        beruniform: student.units.beruniform,
        kelab: student.units.kelab,
        sukan: student.units.sukan,
        rumah: student.units.rumah
      }
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    setConfirmModal({
       isOpen: true,
       config: {
          title: "Padam Murid",
          message: `Adakah anda pasti mahu memadam rekod murid "${name}"? Tindakan ini tidak boleh diundur.`,
          isDestructive: true,
          onConfirm: async () => {
             try {
               console.log("Attempting to delete student with ID:", id);
               await deleteStudent(id);
               console.log("Successfully deleted student:", id);
             } catch (error) {
               console.error("Delete failed in UI:", error);
               alert(`Gagal memadam data murid. Sila cuba lagi. Ralat: ${error instanceof Error ? error.message : "Sistem ralat"}`);
             }
          }
       }
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStudentId) {
        await updateStudent(editingStudentId, formData);
      } else {
        await addStudent(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      alert("Gagal menyimpan data murid.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Data Murid</h2>
          <p className="text-sm font-bold text-slate-500 mt-1">
            Pangkalan data pendaftaran kokurikulum • <span className="text-blue-600">{filteredStudents.length}</span> rekod dipaparkan
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
             onClick={() => window.location.reload()}
             className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-sm rounded-xl font-bold transition-colors"
           >
             <RefreshCw size={18} />
             Refresh System
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
          >
            <Plus size={18} />
            Tambah Murid Baru
          </button>
           <button
            onClick={handleResetDatabase}
            disabled={isResetting || isImporting || isSyncing}
            className="flex items-center gap-2 bg-rose-100 hover:bg-rose-200 text-rose-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
            title="Kosongkan semua data dalam database"
          >
            <Trash2 size={18} className={isResetting ? "animate-pulse" : ""} />
            {isResetting ? 'Memadam...' : 'Kosongkan Data'}
          </button>
           {/* Hiding Sync Cloud to avoid confusion as it just adds mock data */}
           {/*
           <button
            onClick={handleSyncToCloud}
            disabled={isSyncing || isResetting || isImporting}
            className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
            title="Muat naik data contoh asas ke Cloud"
          >
            <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? 'Menyelaras...' : 'Sync Cloud'}
          </button>
          */}
          
          <button
            onClick={exportTemplateExcel}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
          >
            <Download size={18} />
            Muat Turun Template
          </button>
          
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || isResetting || isSyncing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            <Upload size={18} className={isImporting ? "animate-bounce" : ""} />
            {isImporting ? 'Memuat naik...' : 'Import Excel'}
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
          >
            <Download size={18} />
            Muat Turun
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="Cari nama atau MyKid..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
              value={filterAliran}
              onChange={(e) => {
                setFilterAliran(e.target.value);
                setFilterKelas('Semua'); // reset kelas when aliran changes
              }}
            >
              <option value="Semua">Semua Aliran</option>
              {aliranOptions.map(a => (
                <option key={a} value={a}>{a.toUpperCase()}</option>
              ))}
            </select>
            <select
              className="px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
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

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500 min-w-max">
            <Filter size={16} /> Filter Unit:
          </div>
          <div className="flex flex-wrap gap-2">
            {(['Semua', 'beruniform', 'kelab', 'sukan', 'rumah'] as const).map(kat => (
              <button
                key={kat}
                onClick={() => {
                  setFilterKategori(kat);
                  setFilterUnit('Semua');
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  filterKategori === kat 
                    ? "bg-slate-800 text-white shadow-md" 
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {kat === 'beruniform' ? 'Uniform' : kat === 'kelab' ? 'Kelab' : kat === 'sukan' ? 'Sukan' : kat === 'rumah' ? 'Rumah' : 'Semua'}
              </button>
            ))}
          </div>

          {filterKategori !== 'Semua' && (
            <select
              className="px-4 py-2 bg-blue-50 text-blue-700 border-none rounded-lg font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none md:ml-auto"
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
            >
              <option value="Semua">Semua {filterKategori}</option>
              {unitOptions.map(u => (
                <option key={u} value={u}>{u.toUpperCase()}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center px-4">
        <h3 className="text-lg font-black text-slate-800 tracking-tight">Senarai Murid</h3>
        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold">
          {filteredStudents.length} rekod ditemui
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Nama Murid</th>
                <th className="px-6 py-4">Tahun & Kelas</th>
                <th className="px-6 py-4">Unit Beruniform</th>
                <th className="px-6 py-4">Kelab / Persatuan</th>
                <th className="px-6 py-4">Sukan / Permainan</th>
                <th className="px-6 py-4">Rumah Sukan</th>
                <th className="px-6 py-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-800">{s.name}</p>
                      <p className="text-xs font-bold text-slate-500">{s.mykid}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800">{s.aliran}</span>
                        <span className="text-xs font-bold text-blue-600">{s.kelas}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <UnitBadge type="beruniform" label={s.units.beruniform} highlight={filterKategori === 'beruniform'} />
                    </td>
                    <td className="px-6 py-4">
                      <UnitBadge type="kelab" label={s.units.kelab} highlight={filterKategori === 'kelab'} />
                    </td>
                    <td className="px-6 py-4">
                      <UnitBadge type="sukan" label={s.units.sukan} highlight={filterKategori === 'sukan'} />
                    </td>
                    <td className="px-6 py-4">
                      <UnitBadge type="rumah" label={s.units.rumah} highlight={filterKategori === 'rumah'} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(s)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Murid"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Murid"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">
                    Tiada rekod ditemui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  {editingStudentId ? 'Edit Data Murid' : 'Pendaftaran Murid Baru'}
                </h3>
                <p className="text-sm font-bold text-slate-500 mt-1">Sila isi maklumat murid dengan tepat</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form id="student-form" onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nama Penuh</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={formData.name}
                      onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                      placeholder="Contoh: Ahmad Bin Abu"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">MyKid / No KP</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={formData.mykid}
                      onChange={e => setFormData(p => ({...p, mykid: e.target.value}))}
                      placeholder="Contoh: 120101-14-1234"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Jantina</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={formData.gender}
                      onChange={e => setFormData(p => ({...p, gender: e.target.value as 'L'|'P'}))}
                    >
                      <option value="L">Lelaki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Aliran / Tahun</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={formData.aliran}
                      onChange={e => setFormData(p => ({...p, aliran: e.target.value as any}))}
                    >
                      <option value="" disabled>Pilih Aliran</option>
                      {aliranOptions.map(a => (
                        <option key={a} value={a}>{a.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Kelas</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={formData.kelas}
                      onChange={e => setFormData(p => ({...p, kelas: e.target.value as any}))}
                    >
                      <option value="" disabled>Pilih Kelas</option>
                      {formKelasOptions.map(cls => (
                        <option key={cls} value={cls}>{cls.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-black text-slate-800 mb-4 tracking-tight uppercase">Pendaftaran Unit Kokurikulum</h4>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Unit Beruniform</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={formData.units.beruniform}
                      onChange={e => setFormData(p => ({...p, units: {...p.units, beruniform: e.target.value}}))}
                    >
                      <option value="" disabled>Pilih Unit Beruniform</option>
                      <option value="-">Tiada ( - )</option>
                      {formBeruniformOptions.map(u => (
                        <option key={u} value={u}>{u.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Kelab & Persatuan</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={formData.units.kelab}
                      onChange={e => setFormData(p => ({...p, units: {...p.units, kelab: e.target.value}}))}
                    >
                      <option value="" disabled>Pilih Kelab & Persatuan</option>
                      <option value="-">Tiada ( - )</option>
                      {formKelabOptions.map(u => (
                        <option key={u} value={u}>{u.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Sukan & Permainan</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={formData.units.sukan}
                      onChange={e => setFormData(p => ({...p, units: {...p.units, sukan: e.target.value}}))}
                    >
                      <option value="" disabled>Pilih Sukan & Permainan</option>
                      <option value="-">Tiada ( - )</option>
                      {formSukanOptions.map(u => (
                        <option key={u} value={u}>{u.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Rumah Sukan</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={formData.units.rumah}
                      onChange={e => setFormData(p => ({...p, units: {...p.units, rumah: e.target.value}}))}
                    >
                      <option value="" disabled>Pilih Rumah Sukan</option>
                      <option value="-">Tiada ( - )</option>
                      {formRumahOptions.map(u => (
                        <option key={u} value={u}>{u.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 rounded-b-[2rem]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                form="student-form"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm"
              >
                {editingStudentId ? 'Simpan Perubahan' : 'Daftar Murid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.config && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-black text-slate-800 mb-2">
                {confirmModal.config.title}
              </h3>
              <p className="text-sm font-bold text-slate-500 leading-relaxed">
                {confirmModal.config.message}
              </p>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setConfirmModal({isOpen: false, config: null})}
                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  confirmModal.config?.onConfirm();
                  setConfirmModal({isOpen: false, config: null});
                }}
                className={cn(
                  "px-5 py-2.5 text-white font-bold rounded-xl transition-colors shadow-sm",
                  confirmModal.config.isDestructive ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                Teruskan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UnitBadge({ type, label, highlight }: { type: KategoriUnit, label: string, highlight?: boolean }) {
  const colors = {
    beruniform: 'bg-indigo-50 text-indigo-700',
    kelab: 'bg-emerald-50 text-emerald-700',
    sukan: 'bg-orange-50 text-orange-700',
    rumah: 'bg-rose-50 text-rose-700'
  };

  const icons = {
    beruniform: <Shield size={12} className="mr-1" />,
    kelab: <Target size={12} className="mr-1" />,
    sukan: <Dribbble size={12} className="mr-1" />,
    rumah: <Flag size={12} className="mr-1" />
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
      colors[type],
      highlight && "ring-2 ring-current ring-offset-1"
    )}>
      {icons[type]}
      {label}
    </span>
  );
}
