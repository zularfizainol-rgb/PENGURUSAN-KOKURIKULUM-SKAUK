import React, { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_STUDENTS, MOCK_ATTENDANCE, Student, UNIT_OPTIONS } from './data';
import { db } from './firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp, getDocFromServer, writeBatch, getDocs, limit, query } from 'firebase/firestore';

interface AppContextType {
  students: Student[];
  attendance: Record<string, Record<string, Record<string, boolean>>>;
  markAttendance: (date: string, unit: string, studentId: string, isPresent: boolean) => void;
  markAllAttendance: (date: string, unit: string, studentIds: string[], isPresent: boolean) => void;
  importStudents: (newStudents: Student[]) => Promise<void>;
  addStudent: (student: Omit<Student, 'id'>) => Promise<void>;
  updateStudent: (id: string, data: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  syncSystemDataToCloud: () => Promise<void>;
  resetDatabase: () => Promise<void>;
  quotaError: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const normalizeUnit = (u?: string) => {
  if (!u) return '';
  const t = u.trim();
  if (t === '-' || t.toLowerCase() === 'tiada' || t === '') return '';
  return t.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
};

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Record<string, Record<string, boolean>>>>({});
  const [quotaError, setQuotaError] = useState<string | null>(null);

  useEffect(() => {
    // Cleanup incorrect 2026-04-08 attendance for non-sukan units based on actual student data
    if (students.length > 0 && attendance['2026-04-08']) {
      const unitsToRemove = new Set([
        ...students.map(s => normalizeUnit(s.units.beruniform)),
        ...students.map(s => normalizeUnit(s.units.kelab)),
        ...students.map(s => normalizeUnit(s.units.rumah))
      ].filter(Boolean));
      
      const sukanUnits = new Set(students.map(s => normalizeUnit(s.units.sukan)).filter(Boolean));

      Object.keys(attendance['2026-04-08']).forEach(unit => {
        // If it's identified as uniform/kelab/rumah AND not simultaneously a sukan unit
        if (unitsToRemove.has(unit) && !sukanUnits.has(unit)) {
          const safeUnit = unit.replace(/[^a-zA-Z0-9_-]/g, '');
          const docId = `2026-04-08_${safeUnit}`;
          console.log("Dynamically removing 2026-04-08 for unit:", unit);
          deleteDoc(doc(db, "unit_attendances", docId)).catch(() => {});
        }
      });
    }
  }, [students, attendance]);

  // Check connection on boot to catch offline issues gracefully
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
        if(error instanceof Error && error.message.toLowerCase().includes('quota')) {
          setQuotaError(error.message);
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    // Subscribe to students collection
    const unsubscribeStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      const loadedStudents: Student[] = [];
      snapshot.forEach(doc => {
        loadedStudents.push({ ...doc.data() as Student, id: doc.id });
      });
      setStudents(loadedStudents);
      setQuotaError(null);
    }, (error) => {
      console.error("Error fetching students: ", error);
      if (error instanceof Error && error.message.toLowerCase().includes('quota')) {
        setQuotaError(error.message);
      }
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
          console.error(JSON.stringify({
              error: error.message,
              operationType: 'list',
              path: 'students',
              authInfo: { userId: 'anonymous', email: '', emailVerified: false, isAnonymous: true, providerInfo: [] }
          }));
      }
    });

    // Subscribe to attendance records
    const unsubscribeAttendance = onSnapshot(collection(db, "unit_attendances"), (snapshot) => {
      const newAttendance: typeof attendance = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.date && data.unit) {
          if (!newAttendance[data.date]) newAttendance[data.date] = {};
          if (!newAttendance[data.date][data.unit]) newAttendance[data.date][data.unit] = {};
          
          const presentStudents: string[] = data.presentStudents || [];
          presentStudents.forEach(id => {
            newAttendance[data.date][data.unit][id] = true;
          });
        }
      });

      setAttendance(newAttendance);
      setQuotaError(null);
    }, (error) => {
      console.error("Error fetching attendance: ", error);
      if (error instanceof Error && error.message.toLowerCase().includes('quota')) {
        setQuotaError(error.message);
      }
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
          console.error(JSON.stringify({
              error: error.message,
              operationType: 'list',
              path: 'unit_attendances',
              authInfo: { userId: 'anonymous', email: '', emailVerified: false, isAnonymous: true, providerInfo: [] }
          }));
      }
    });

    return () => {
      unsubscribeStudents();
      unsubscribeAttendance();
    };
  }, []);

  const getRecordId = (date: string, unit: string) => {
    const safeUnit = unit.replace(/[^a-zA-Z0-9_-]/g, '');
    return `${date}_${safeUnit}`;
  };

  const markAttendance = async (date: string, unit: string, studentId: string, isPresent: boolean) => {
    // Update local state optimistically
    setAttendance(prev => {
      const newAtt = { ...prev };
      if (!newAtt[date]) newAtt[date] = {};
      // Ensure unit object exists before spreading
      if (!newAtt[date][unit]) newAtt[date][unit] = {};
      newAtt[date][unit] = { ...newAtt[date][unit], [studentId]: isPresent };
      return newAtt;
    });

    try {
      const docId = getRecordId(date, unit);
      const docRef = doc(db, "unit_attendances", docId);
      
      const attDay = attendance[date] || {};
      const attUnit = attDay[unit] || {};
      // Calculate new present students list based on old state + new state
      const currentPresent = Object.keys(attUnit).filter(id => id === studentId ? isPresent : attUnit[id]);
      if (isPresent && !currentPresent.includes(studentId)) currentPresent.push(studentId);
      if (!isPresent) {
        const idx = currentPresent.indexOf(studentId);
        if (idx > -1) currentPresent.splice(idx, 1);
      }

      await setDoc(docRef, {
        date,
        unit,
        presentStudents: currentPresent,
        updatedBy: 'public_teacher',
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Failed to mark attendance", error);
      // If error occurs, onSnapshot will eventually revert the state, but we log it.
    }
  };

  const markAllAttendance = async (date: string, unit: string, studentIds: string[], isPresent: boolean) => {
    setAttendance(prev => {
      const newAtt = { ...prev };
      if (!newAtt[date]) newAtt[date] = {};
      if (!newAtt[date][unit]) newAtt[date][unit] = {};
      const newUnitAtt = { ...newAtt[date][unit] };
      studentIds.forEach(id => {
        newUnitAtt[id] = isPresent;
      });
      newAtt[date][unit] = newUnitAtt;
      return newAtt;
    });

    try {
      const docId = getRecordId(date, unit);
      const docRef = doc(db, "unit_attendances", docId);
      
      const attDay = attendance[date] || {};
      const attUnit = attDay[unit] || {};
      
      let currentPresent = Object.keys(attUnit).filter(id => attUnit[id]);
      if (isPresent) {
        // Add all provided students
        currentPresent = Array.from(new Set([...currentPresent, ...studentIds]));
      } else {
        // Remove all provided students
        currentPresent = currentPresent.filter(id => !studentIds.includes(id));
      }

      await setDoc(docRef, {
        date,
        unit,
        presentStudents: currentPresent,
        updatedBy: 'public_teacher',
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Failed to mark all attendance", error);
    }
  };

  const importStudents = async (newStudents: Student[]) => {
    // Write in batches of 500 (Firestore max)
    const chunkSize = 500;
    for (let i = 0; i < newStudents.length; i += chunkSize) {
      const chunk = newStudents.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      
      chunk.forEach(student => {
        const docRef = doc(db, 'students', student.id);
        batch.set(docRef, student);
      });
      
      try {
        await batch.commit();
      } catch (error) {
        console.error("Batch commit failed", error);
        throw error;
      }
    }
  };

  const addStudent = async (studentData: Omit<Student, 'id'>) => {
    // Generate a new ID based on mykid to avoid duplicates if re-added
    // Or just a random ID if preferable. Let's use custom string to avoid space issues.
    const newId = studentData.mykid.replace(/\s+/g, '') + '_' + Date.now().toString(36);
    const docRef = doc(db, 'students', newId);
    
    // Validate missing options
    const newStudent: Student = {
      ...studentData,
      id: newId
    };
    
    try {
      await setDoc(docRef, newStudent);
    } catch (error) {
      console.error("Failed to add student:", error);
      throw error;
    }
  };

  const updateStudent = async (id: string, data: Partial<Student>) => {
    const docRef = doc(db, 'students', id);
    try {
      await updateDoc(docRef, data);
    } catch (error) {
      console.error("Failed to update student:", error);
      throw error;
    }
  };

  const deleteStudent = async (id: string) => {
    const docRef = doc(db, 'students', id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Failed to delete student:", error);
      throw error;
    }
  };

  // Sync internal system data explicitly
  const syncSystemDataToCloud = async () => {
    try {
      // 1. Sync students
      await importStudents(MOCK_STUDENTS);
      
      // 2. Sync mock attendance
      const batch = writeBatch(db);
      let batchCount = 0;
      for (const [date, units] of Object.entries(MOCK_ATTENDANCE)) {
        for (const [unit, stdMap] of Object.entries(units)) {
          const presentIds = Object.keys(stdMap).filter(id => stdMap[id]);
          const docId = getRecordId(date, unit);
          const ref = doc(db, 'unit_attendances', docId);
          batch.set(ref, {
            date,
            unit,
            presentStudents: presentIds,
            updatedBy: 'system_sync',
            updatedAt: serverTimestamp()
          }, { merge: true });
          batchCount++;
          // commit if reaching limit
           if (batchCount === 490) {
             await batch.commit();
             batchCount = 0;
           }
        }
      }
      if (batchCount > 0) {
         await batch.commit();
      }
      
      alert("Pangkalan data (Database) telah berjaya diselaraskan dengan data sistem.");
    } catch (e) {
      console.error(e);
      alert("Ralat menyelaras database.");
    }
  }

  const resetDatabase = async () => {
    try {
      const deleteCollection = async (collectionName: string) => {
        let isDone = false;
        while (!isDone) {
          const snapshot = await getDocs(query(collection(db, collectionName), limit(400)));
          if (snapshot.size === 0) {
            isDone = true;
            break;
          }
          const batch = writeBatch(db);
          snapshot.docs.forEach(document => {
            batch.delete(document.ref);
          });
          await batch.commit();
        }
      };

      await deleteCollection('students');
      await deleteCollection('unit_attendances');
      
    } catch (e) {
      console.error("Failed to reset database", e);
      if (e instanceof Error) {
        alert("Gagal memadam data dari pangkalan data: " + e.message);
      }
      throw e;
    }
  };

  return (
    <AppContext.Provider value={{ students, attendance, markAttendance, markAllAttendance, importStudents, addStudent, updateStudent, deleteStudent, syncSystemDataToCloud, resetDatabase, quotaError }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
