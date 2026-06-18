import type {Difficulty, FeedbackMode, TestMode} from '@/types/models';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type PracticeStackParamList = {
  SubjectSelect: undefined;
  CourseSelect: {subjectId?: number; subjectName?: string};
  Config: {
    subjectId: number;
    subjectName: string;
    courseId: number | null;
    courseName: string | null;
  };
  ExamPlayer: {sessionId: number; setId: number};
  Results: {sessionId: number; score: number};
  Practice: undefined
};

export type HistoryStackParamList = {
  HistoryList: undefined;
  SessionReview: {sessionId: number};
  QuestionSetLibrary: undefined;
};

export type ProfileStackParamList = {
  Settings: undefined;
  Analytics: undefined;
  TestPreferences: undefined;
  LocationDetails: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Practice: undefined;
  History: undefined;
  Profile: undefined;
};

export interface SessionConfig {
  count: number;
  difficulty: Difficulty;
  feedbackMode: FeedbackMode;
  mode: TestMode;
  timerMinutes: number;
  source: 'generate' | 'reuse';
}
