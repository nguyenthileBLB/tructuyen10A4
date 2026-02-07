import { Exam, Submission, QuestionType, Team, StudentSession } from '../types';

const EXAMS_KEY = 'edugemini_exams';
const SUBMISSIONS_KEY = 'edugemini_submissions';
const TEAMS_KEY = 'edugemini_teams_v2'; 
const SESSIONS_KEY = 'edugemini_sessions';
const DEVICE_HISTORY_KEY = 'edugemini_device_history'; // New key for device locking

// --- INDEXED DB HELPER (FOR AUDIO FILES) ---
const DB_NAME = 'EduQuizAudioDB';
const STORE_NAME = 'audioFiles';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const saveAudioToDB = async (examId: string, file: Blob): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(file, examId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getAudioFromDB = async (examId: string): Promise<Blob | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(examId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const deleteAudioFromDB = async (examId: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(examId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// --- HELPER FUNCTIONS ---

const getStudentSessionsRaw = (): StudentSession[] => {
    const data = localStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
}

// --- CORE DATA LOGIC ---

// Dữ liệu mẫu cố định
const DEFAULT_EXAMS: Exam[] = [
  {
    id: 'default-math-01',
    code: '123456',
    title: 'Toán Học Vui - Lớp 5',
    description: 'Bài kiểm tra kiến thức cơ bản về phân số và hình học.',
    teacherName: 'Hệ Thống',
    createdAt: Date.now(),
    isPublished: true, // Mặc định mở để học sinh test
    questions: [
      {
        id: 'q1',
        text: 'Kết quả của phép tính 25 + 15 x 2 là bao nhiêu?',
        type: QuestionType.MULTIPLE_CHOICE,
        options: ['80', '55', '65', '40'],
        correctAnswer: 1, // 55
        points: 10,
        timeLimit: 30
      },
      {
        id: 'q2',
        text: 'Diện tích hình vuông có cạnh 5cm là:',
        type: QuestionType.MULTIPLE_CHOICE,
        options: ['20cm2', '25cm2', '10cm2', '50cm2'],
        correctAnswer: 1, // 25cm2
        points: 10,
        timeLimit: 30
      },
      {
        id: 'q3',
        text: 'Một lớp học có 40 học sinh, trong đó có 25 nữ. Hỏi số học sinh nam chiếm bao nhiêu phần trăm?',
        type: QuestionType.SHORT_ANSWER,
        correctAnswer: '37.5%',
        points: 10,
        timeLimit: 60
      }
    ]
  }
];

const DEFAULT_TEAMS: Team[] = [
  { id: 'team_red', name: 'Đội Đỏ', color: 'bg-red-500 text-white' },
  { id: 'team_blue', name: 'Đội Xanh', color: 'bg-blue-500 text-white' }
];

// Helper to generate a random 6-digit numeric code
export const generateExamCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const saveExam = (exam: Exam): void => {
  const exams = getExams();
  const existingIndex = exams.findIndex((e) => e.id === exam.id);
  
  if (existingIndex >= 0) {
    exams[existingIndex] = exam;
  } else {
    exams.push(exam);
  }
  
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
};

export const getExams = (): Exam[] => {
  const data = localStorage.getItem(EXAMS_KEY);
  if (data) {
    return JSON.parse(data);
  } else {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(DEFAULT_EXAMS));
    return DEFAULT_EXAMS;
  }
};

export const getExamByCode = (code: string): Exam | undefined => {
  const exams = getExams();
  return exams.find((e) => e.code === code);
};

export const getExamById = (id: string): Exam | undefined => {
    const exams = getExams();
    return exams.find(e => e.id === id);
}

export const toggleExamStatus = (id: string, isPublished: boolean): void => {
    const exams = getExams();
    const updatedExams = exams.map(e => e.id === id ? { ...e, isPublished } : e);
    localStorage.setItem(EXAMS_KEY, JSON.stringify(updatedExams));
};

export const deleteExam = async (id: string): Promise<void> => {
    const exams = getExams();
    const newExams = exams.filter(e => e.id !== id);
    localStorage.setItem(EXAMS_KEY, JSON.stringify(newExams));

    const submissions = getSubmissions();
    const newSubmissions = submissions.filter(s => s.examId !== id);
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(newSubmissions));

    // Uses the helper defined above
    const sessions = getStudentSessionsRaw();
    const newSessions = sessions.filter(s => s.examId !== id);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(newSessions));

    try {
        await deleteAudioFromDB(id);
    } catch (e) {
        console.error("Failed to delete audio", e);
    }
}

// --- EXPORT / IMPORT LOGIC ---
export const exportExamData = (exam: Exam): string => {
    return JSON.stringify(exam);
}

export const exportSubmissionData = (submission: Submission): string => {
    // Add a type marker so we know it's a submission
    return JSON.stringify({ ...submission, _dataType: 'SUBMISSION' });
}

export const importData = (jsonString: string): { success: boolean; type: 'EXAM' | 'SUBMISSION' | 'UNKNOWN'; message: string } => {
    try {
        const data = JSON.parse(jsonString);
        
        // CASE 1: IMPORT SUBMISSION (Student Result)
        if (data._dataType === 'SUBMISSION' && data.examId && data.answers) {
            delete data._dataType; // Clean up
            saveSubmission(data);
            return { success: true, type: 'SUBMISSION', message: `Đã nạp bài làm của "${data.studentName}"` };
        }
        
        // CASE 2: IMPORT EXAM
        if (data.id && data.questions && data.title) {
             // Generate new ID to avoid conflict if teacher imports same exam twice
             const newExam = { ...data, id: crypto.randomUUID(), code: generateExamCode(), teacherName: 'Imported' };
             saveExam(newExam);
             return { success: true, type: 'EXAM', message: `Đã nạp đề thi "${newExam.title}"` };
        }

        return { success: false, type: 'UNKNOWN', message: 'Dữ liệu không hợp lệ.' };
    } catch (e) {
        console.error("Import failed", e);
        return { success: false, type: 'UNKNOWN', message: 'Lỗi định dạng JSON.' };
    }
}

// -----------------------------

export const saveSubmission = (submission: Submission): void => {
  const submissions = getSubmissions();
  const existingIndex = submissions.findIndex(s => 
      s.examId === submission.examId && 
      s.studentName.trim().toLowerCase() === submission.studentName.trim().toLowerCase()
  );

  if (existingIndex >= 0) {
      submissions[existingIndex] = {
          ...submission,
          id: submissions[existingIndex].id
      };
  } else {
      submissions.push(submission);
  }

  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
};

export const getSubmissions = (): Submission[] => {
  const data = localStorage.getItem(SUBMISSIONS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getSubmissionsForExam = (examId: string): Submission[] => {
    return getSubmissions().filter(s => s.examId === examId);
}

// ADDED: Function to delete a single submission
export const deleteSubmission = (submissionId: string): void => {
    const submissions = getSubmissions();
    const newSubmissions = submissions.filter(s => s.id !== submissionId);
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(newSubmissions));
}

export const getTeamScores = (examId: string): Record<string, number> => {
    const submissions = getSubmissionsForExam(examId);
    const scores: Record<string, number> = {};
    
    submissions.forEach(sub => {
        const teamName = sub.team || 'Khác';
        if (!scores[teamName]) scores[teamName] = 0;
        scores[teamName] += sub.score;
    });
    
    return scores;
}

export const getTeams = (): Team[] => {
    const data = localStorage.getItem(TEAMS_KEY);
    return data ? JSON.parse(data) : DEFAULT_TEAMS;
};

export const saveTeams = (teams: Team[]): void => {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
};

// --- Session / Waiting Room Management ---

export const getStudentSessions = (examId: string): StudentSession[] => {
    return getStudentSessionsRaw().filter(s => s.examId === examId);
}

export const registerStudentSession = (session: StudentSession): void => {
    const sessions = getStudentSessionsRaw();
    const idx = sessions.findIndex(s => s.examId === session.examId && s.studentName.toLowerCase() === session.studentName.toLowerCase());
    
    if (idx >= 0) {
        sessions[idx] = session; 
    } else {
        sessions.push(session);
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

// --- DEVICE SUBMISSION HISTORY (For "One Submission Per Device") ---
export const hasDeviceSubmitted = (examId: string): boolean => {
    const history = JSON.parse(localStorage.getItem(DEVICE_HISTORY_KEY) || '{}');
    return !!history[examId];
}

export const markDeviceAsSubmitted = (examId: string): void => {
    const history = JSON.parse(localStorage.getItem(DEVICE_HISTORY_KEY) || '{}');
    history[examId] = true;
    localStorage.setItem(DEVICE_HISTORY_KEY, JSON.stringify(history));
}