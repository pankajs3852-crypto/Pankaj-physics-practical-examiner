
export interface TranscriptionEntry {
  role: 'user' | 'examiner';
  text: string;
  timestamp: number;
  avatar?: string;
  senderName?: string;
}

export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum ClassLevel {
  XI = '11th',
  XII = '12th'
}

export enum ExamStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR'
}

export interface ExamStats {
  grade: string;
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  topicsCovered: string[];
}
