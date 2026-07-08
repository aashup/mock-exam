import {create} from 'zustand';
import type {FeedbackMode, QuestionWithOptions, TestMode} from '@/types/models';
import {sessionRepo} from '@/db/repositories/sessionRepo';
import {analyticsRepo} from '@/db/repositories/analyticsRepo';

type Status = 'idle' | 'running' | 'paused' | 'submitted';

interface ExamState {
  sessionId: number | null;
  setId: number | null;
  questions: QuestionWithOptions[];
  currentIndex: number;
  /** questionId -> selected optionId */
  answers: Record<number, number>;
  timeRemaining: number | null; // null = untimed
  mode: TestMode;
  feedbackMode: FeedbackMode;
  status: Status;
  startedAt: string | null;

  start: (params: {
    sessionId: number;
    setId: number;
    questions: QuestionWithOptions[];
    mode: TestMode;
    feedbackMode: FeedbackMode;
    durationSeconds: number | null;
  }) => void;
  resume: (params: {
    sessionId: number;
    setId: number;
    questions: QuestionWithOptions[];
    mode: TestMode;
    feedbackMode: FeedbackMode;
    currentIndex: number;
    timeRemaining: number | null;
  }) => void;
  saveAnswer: (questionId: number, optionId: number) => Promise<void>;
  goToNext: () => void;
  goToPrev: () => void;
  jumpTo: (index: number) => void;
  tick: () => void;
  submit: () => Promise<number>;
  reset: () => void;
}

function isCorrect(q: QuestionWithOptions, optionId: number): boolean {
  // console.log('[ExamStore] isCorrect', q.options, optionId);
  return q.options.some(o => o.id === optionId && (o.is_correct === 1 || o.is_correct === true));
}

export const useExamStore = create<ExamState>((set, get) => ({
  sessionId: null,
  setId: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  timeRemaining: null,
  mode: 'untimed',
  feedbackMode: 'end',
  status: 'idle',
  startedAt: null,

  start: ({sessionId, setId, questions, mode, feedbackMode, durationSeconds}) =>
    set({
      sessionId,
      setId,
      questions,
      currentIndex: 0,
      answers: {},
      mode,
      feedbackMode,
      timeRemaining: mode === 'timed' ? durationSeconds : null,
      status: 'running',
      startedAt: new Date().toISOString(),
    }),

  resume: ({sessionId, setId, questions, mode, feedbackMode, currentIndex, timeRemaining}) =>
    set({
      sessionId,
      setId,
      questions,
      currentIndex,
      answers: {},
      mode,
      feedbackMode,
      timeRemaining,
      status: 'running',
      startedAt: new Date().toISOString(),
    }),

  async saveAnswer(questionId, optionId) {
    const {sessionId, questions, answers} = get();
    if (sessionId == null) {
      return;
    }
    const q = questions.find(item => item.id === questionId);
    if (!q) {
      return;
    }
    const correct = isCorrect(q, optionId);
    console.log('[ExamStore] saveAnswer', {questionId, optionId, correct});
    set({answers: {...answers, [questionId]: optionId}});
    await sessionRepo.recordAttempt({
      sessionId,
      questionId,
      selectedOptionId: optionId,
      isCorrect: correct,
      timeTakenSeconds: null,
    });
  },

  goToNext: () => {
    const {currentIndex, questions} = get();
    if (currentIndex < questions.length - 1) {
      set({currentIndex: currentIndex + 1});
    }
  },
  goToPrev: () => {
    const {currentIndex} = get();
    if (currentIndex > 0) {
      set({currentIndex: currentIndex - 1});
    }
  },
  jumpTo: index => set({currentIndex: index}),

  tick: () => {
    const {timeRemaining, status} = get();
    if (status !== 'running' || timeRemaining == null) {
      return;
    }
    if (timeRemaining <= 1) {
      set({timeRemaining: 0});
      void get().submit(); // auto-submit on expiry
    } else {
      set({timeRemaining: timeRemaining - 1});
    }
  },

  async submit() {
    const {sessionId, questions, answers, setId} = get();
    if (sessionId == null) {
      return 0;
    }
    const total = questions.length;
    let correct = 0;
    for (const q of questions) {
      const chosen = answers[q.id];
      if (chosen != null && isCorrect(q, chosen)) {
        correct += 1;
      }
    }
    const score = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

    await sessionRepo.complete(sessionId, score);
    await analyticsRepo.recordSessionResult({setId: setId!, attempted: total, correct});

    set({status: 'submitted'});
    return score;
  },

  reset: () =>
    set({
      sessionId: null,
      setId: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      timeRemaining: null,
      status: 'idle',
      startedAt: null,
    }),
}));
