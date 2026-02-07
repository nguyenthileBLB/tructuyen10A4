

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SHORT_ANSWER = 'SHORT_ANSWER',
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // For Multiple Choice
  correctAnswer?: number | string; // Index for MC, Text for SA
  points: number;
  timeLimit?: number; // Time in seconds
}

export interface Exam {
  id: string;
  code: string; // 6 digit access code
  title: string;
  description: string;
  teacherName: string;
  createdAt: number;
  questions: Question[];
  isPublished: boolean;
  musicUri?: string; // Base64 string of the MP3 file
}

export interface Submission {
  id: string;
  examId: string;
  studentName: string;
  team: string; // New field for Team
  answers: Record<string, string | number>; // questionId -> answer
  score: number;
  maxScore: number;
  feedback?: Record<string, string>; // questionId -> AI feedback
  submittedAt: number;
}

export interface StudentSession {
    examId: string;
    studentName: string;
    team: string;
    joinedAt: number;
}

export interface Team {
  id: string;
  name: string;
  color: string; // Tailwind class string
}

export type UserRole = 'TEACHER' | 'STUDENT' | null;

export interface ExamGenerationConfig {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

// --- P2P TYPES ---
export type P2PMessageType = 'SYNC_EXAM' | 'SUBMIT_EXAM' | 'STUDENT_JOIN' | 'HOST_CLOSE' | 'LIVE_SCORE_UPDATE' | 'HOST_ENDED' | 'START_EXAM' | 'PLAYER_READY';

export interface P2PMessage {
  type: P2PMessageType;
  payload: any;
}