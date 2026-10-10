/** Formas de los datos del Buzón de Escucha tal y como viajan por la API. */

import type {
  ListeningStatus,
  ListeningTopic,
  ListeningType,
  NpsGroup,
  NpsResult,
} from './listening';

export type { ListeningStatus, ListeningTopic, ListeningType };

export interface ListeningSubmission {
  type: ListeningType;
  topic: ListeningTopic;
  mood: number;
  npsScore?: number | null;
  courseId?: string | null;
  subject: string;
  message: string;
  anonymous: boolean;
}

export interface OwnListeningEntry {
  id: string;
  type: ListeningType;
  topic: ListeningTopic;
  mood: number;
  npsScore: number | null;
  subject: string;
  message: string;
  anonymous: boolean;
  courseTitle: string | null;
  status: ListeningStatus;
  reply: string | null;
  repliedAt: string | null;
  repliedBy: string | null;
  unreadReply: boolean;
  createdAt: string;
}

export interface StaffListeningEntry {
  id: string;
  type: ListeningType;
  topic: ListeningTopic;
  mood: number;
  npsScore: number | null;
  npsGroup: NpsGroup | null;
  subject: string;
  message: string;
  anonymous: boolean;
  author: { name: string; email: string } | null;
  courseId: string | null;
  courseTitle: string | null;
  status: ListeningStatus;
  reply: string | null;
  repliedAt: string | null;
  repliedBy: string | null;
  createdAt: string;
}

interface Bucket {
  count: number;
  avgMood: number | null;
}

export interface ListeningSummaryData {
  total: number;
  pending: number;
  answered: number;
  avgMood: number | null;
  moodDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  sentiment: { positive: number; neutral: number; negative: number };
  nps: NpsResult & { distribution: number[] };
  avgResponseHours: number | null;
  byType: (Bucket & { key: ListeningType; label: string })[];
  byTopic: (Bucket & { key: ListeningTopic; label: string })[];
  byStatus: { key: ListeningStatus; label: string; count: number }[];
  byCourse: (Bucket & { courseId: string; title: string; nps: number | null })[];
  weekly: (Bucket & { weekStart: string; nps: number | null })[];
}

export interface ListeningAdminFilter {
  days?: number;
  status?: ListeningStatus | '';
  type?: ListeningType | '';
  topic?: ListeningTopic | '';
  courseId?: string;
  mood?: number | '';
}

export interface ListeningAdminResponse {
  summary: ListeningSummaryData;
  entries: StaffListeningEntry[];
  courses: { id: string; title: string }[];
}
