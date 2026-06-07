export type Role = 'student' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  mobile?: string | null;
  device_id?: string | null;
  last_sync_at?: string | null;
  created_at?: string | null;
  // Present on the admin users listing.
  sessions_count?: number;
  question_sets_count?: number;
}

export interface SubjectRef {
  id: number;
  name: string;
}

/** A syllabus topic belonging to a subject. */
export interface Topic {
  id: number;
  subject_id: number;
  title: string;
  description: string | null;
  position: number;
}

/** Subject as returned by GET /admin/subjects (withCount('courses'), with topics). */
export interface Subject {
  id: number;
  name: string;
  courses_count?: number;
  topics?: Topic[];
  created_at?: string | null;
  updated_at?: string | null;
}

/** Course as returned by GET /admin/courses (with('subjects:id,name')). */
export interface Course {
  id: number;
  name: string;
  exam_type: string | null;
  subjects: SubjectRef[];
  created_at?: string | null;
  updated_at?: string | null;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/** A parsed MCQ option (matches the AI JSON shape). */
export interface ParsedOption {
  text: string;
  is_correct: boolean;
}

/** A parsed MCQ (matches the AI JSON shape the prompt asks for). */
export interface ParsedQuestion {
  question: string;
  options: ParsedOption[];
  explanation?: string | null;
}

/** Question set as returned by GET /admin/question-sets. */
export interface QuestionSet {
  id: number;
  subject_id: number;
  course_id: number | null;
  difficulty: Difficulty;
  ai_provider: string | null;
  total_questions: number;
  questions_count?: number;
  generated_at: string | null;
  created_at?: string | null;
  subject?: SubjectRef | null;
  course?: SubjectRef | null;
}

/** A stored MCQ option (persisted, with an id). */
export interface QuestionOption {
  id: number;
  question_id: number;
  text: string;
  is_correct: boolean;
}

/** A stored question with its options (GET …/questions). */
export interface Question {
  id: number;
  set_id: number;
  text: string;
  explanation: string | null;
  options: QuestionOption[];
}

export interface ApiUsageRow {
  user_id: number;
  email: string;
  provider: string;
  prompt_tokens: number | string;
  completion_tokens: number | string;
  questions_generated: number | string;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  metadata: string | null;
  created_at: string | null;
}

export interface DeviceLocation {
  id: number;
  user_id: string;
  user_email: string | null;
  device_id: string | null;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  location_source: 'gps' | 'network' | 'fused';
  battery_level: number | null;
  recorded_at: string;
  created_at: string | null;
}

/** Laravel length-aware paginator shape. */
export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}
