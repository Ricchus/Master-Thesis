export type ToolType = 'chatgpt' | 'avatar';
export type TaskSetId = 'A' | 'B';
export type EmergencyType = 'A' | 'B';
export type MaterialView = 'inbox' | 'files';
export type FileDocId = 'analysis-summary' | 'analysis-risks' | 'meeting-time' | 'urgent-card';
export type AppFlow = 'consent' | 'intro' | 'guide' | 'study' | 'finished';

export type PhaseId =
  | 'round_intro'
  | 'ema1'
  | 'stage1_replies'
  | 'stage1_task_breakdown'
  | 'ema2'
  | 'analysis'
  | 'urgent'
  | 'ema3'
  | 'cutoff'
  | 'ema4'
  | 'round_complete'
  | 'finished';

export type StageValidationResult = {
  passed: boolean;
  mode: 'rules' | 'rules+ai' | 'fallback';
  issues: string[];
  summary: string;
};

export type MaterialInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string };

export type MaterialBlock =
  | { type: 'paragraph'; content: MaterialInline[] }
  | { type: 'bullets'; items: MaterialInline[][] }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'note'; title?: string; content: MaterialInline[] };

export type Email = {
  id: number;
  timestamp: string;
  from: string;
  subject: string;
  body: MaterialBlock[];
  requiredReply?: boolean;
};

export type TaskFile = {
  id: FileDocId;
  label: string;
  body: MaterialBlock[];
};

export type TaskSet = {
  id: TaskSetId;
  title: string;
  shortTitle: string;
  background: {
    company: string;
    scenario: string;
    role: string;
    objective: string;
  };
  meetingTimeLabel: string;
  emails: Email[];
  files: TaskFile[];
  urgentTasks: Record<EmergencyType, {
    title: string;
    prompt: string;
    deliverableHint: string;
  }>;
  analysisPromptHints: string[];
};

export type ConversationMessage = {
  id: string;
  role: 'assistant' | 'user' | 'system';
  text: string;
  createdAt: number;
};

export type ReplyDraft = {
  emailId: number;
  to: string;
  subject: string;
  body: string;
};

export type AnalysisBrief = {
  keyFindings: string;
  evidence: string;
  recommendation: string;
  risk: string;
  questions: string;
};

export type UrgentDraftA = {
  customerReply: string;
  actionSteps: [string, string, string];
};

export type UrgentDraftB = {
  addOnNote: string;
  bullets: [string, string, string];
};

export type RoundState = {
  roundNumber: 1 | 2;
  tool: ToolType;
  taskSetId: TaskSetId;
  emergencyType: EmergencyType;
  phase: PhaseId;
  startedAt: number | null;
  analysisStartedAt: number | null;
  urgentStartedAt: number | null;
  cutoffReachedAt: number | null;
  emaCompleted: {
    ema1: boolean;
    ema2: boolean;
    ema3: boolean;
    ema4: boolean;
  };
  activeMaterialView: MaterialView;
  selectedEmailId: number;
  selectedFileId: FileDocId;
  replies: ReplyDraft[];
  taskBreakdown: [string, string, string, string];
  analysis: AnalysisBrief;
  urgentA: UrgentDraftA;
  urgentB: UrgentDraftB;
  chatMessages: ConversationMessage[];
  validation: Partial<Record<'stage1_replies' | 'stage1_task_breakdown' | 'analysis' | 'urgent', StageValidationResult>>;
  roundComplete: boolean;
};

export type ComboCode = 'CA-AB' | 'CA-BA' | 'AC-AB' | 'AC-BA';

export type SessionState = {
  version: number;
  participantId: string;
  comboCode: ComboCode;
  createdAt: number;
  currentRoundIndex: 0 | 1;
  appFlow: AppFlow;
  guideStep: number;
  researcherMode: boolean;
  rounds: [RoundState, RoundState];
  lastUpdatedAt: number;
};
