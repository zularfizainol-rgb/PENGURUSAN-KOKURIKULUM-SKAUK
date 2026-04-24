import { ReactNode } from "react";

export type Aliran = "Tahun 4" | "Tahun 5" | "Tahun 6";
export type Kelas = "Ibnu Sina" | "Ibnu Khaldun" | "Ibnu Rushd" | "Ibnu Battuta";
export type KategoriUnit = "beruniform" | "kelab" | "sukan" | "rumah";

export interface Student {
  id: string;
  name: string;
  mykid: string;
  aliran: Aliran;
  kelas: Kelas;
  gender: "L" | "P";
  units: {
    beruniform: string;
    kelab: string;
    sukan: string;
    rumah: string;
  };
}

export const UNIT_OPTIONS: Record<KategoriUnit, string[]> = {
  beruniform: ["Pengakap", "TKRS", "Puteri Islam", "BSMM", "Tunas Puteri"],
  kelab: ["ICT", "STEM", "Pendidikan Islam", "Kesenian", "B. Melayu", "B. Inggeris"],
  sukan: ["Bola Sepak", "Bola Jaring", "Badminton", "Olahraga", "Catur"],
  rumah: ["Merah", "Biru", "Kuning", "Hijau"]
};

// Generate realistic mock data
export const generateStudents = (): Student[] => {
  const students: Student[] = [];
  const aliranOpts: Aliran[] = ["Tahun 4", "Tahun 5", "Tahun 6"];
  const kelasOpts: Kelas[] = ["Ibnu Sina", "Ibnu Khaldun", "Ibnu Rushd", "Ibnu Battuta"];
  
  for (let i = 1; i <= 300; i++) {
    const isMale = Math.random() > 0.5;
    students.push({
      id: `std-${i}`,
      name: `Pelajar ${i}`,
      mykid: `120101-14-${String(1000 + i).padStart(4, "0")}`,
      aliran: aliranOpts[Math.floor(Math.random() * aliranOpts.length)],
      kelas: kelasOpts[Math.floor(Math.random() * kelasOpts.length)],
      gender: isMale ? "L" : "P",
      units: {
        beruniform: isMale 
          ? ["Pengakap", "TKRS", "BSMM"][Math.floor(Math.random() * 3)]
          : ["Pengakap", "Puteri Islam", "Tunas Puteri", "BSMM"][Math.floor(Math.random() * 4)],
        kelab: UNIT_OPTIONS.kelab[Math.floor(Math.random() * UNIT_OPTIONS.kelab.length)],
        sukan: UNIT_OPTIONS.sukan[Math.floor(Math.random() * UNIT_OPTIONS.sukan.length)],
        rumah: UNIT_OPTIONS.rumah[Math.floor(Math.random() * UNIT_OPTIONS.rumah.length)],
      }
    });
  }
  return students;
};

export const MOCK_STUDENTS = generateStudents();

// Generate some mock attendance data
// Format: Date -> Unit -> StudentId -> Present (boolean)
export const generateAttendance = (students: Student[]) => {
  const attendance: Record<string, Record<string, Record<string, boolean>>> = {};
  const dates = ["2023-09-06", "2023-09-13", "2023-09-20", "2023-09-27"];
  
  dates.forEach(date => {
    attendance[date] = {};
    
    // Simulate attendance for all units on these dates
    Object.keys(UNIT_OPTIONS).forEach((kategori) => {
      const unitType = kategori as KategoriUnit;
      UNIT_OPTIONS[unitType].forEach(unit => {
        attendance[date][unit] = {};
        
        // Find students in this unit
        const studentsInUnit = students.filter(s => s.units[unitType] === unit);
        studentsInUnit.forEach(student => {
          // 85% attendance rate
          attendance[date][unit][student.id] = Math.random() < 0.85;
        });
      });
    });
  });
  
  return attendance;
};

export const MOCK_ATTENDANCE = generateAttendance(MOCK_STUDENTS);

export const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(" ");
};
