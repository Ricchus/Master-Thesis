import { buildParticipantId } from './id';
import { uid } from './id';
import type { ComboCode, EmergencyType, ReplyDraft, RoundState, SessionState, ToolType } from './types';

const COMBOS: readonly ComboCode[] = ['CA-AB', 'CA-BA', 'AC-AB', 'AC-BA'] as const;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildReplies(): ReplyDraft[] {
  return [
    { emailId: 6, to: '', subject: '', body: '' },
    { emailId: 14, to: '', subject: '', body: '' }
  ];
}

function buildRound(roundNumber: 1 | 2, tool: ToolType, taskSetId: 'A' | 'B', emergencyType: EmergencyType): RoundState {
  return {
    roundNumber,
    tool,
    taskSetId,
    emergencyType,
    phase: 'round_intro',
    startedAt: null,
    analysisStartedAt: null,
    urgentStartedAt: null,
    cutoffReachedAt: null,
    emaCompleted: { ema1: false, ema2: false, ema3: false, ema4: false },
    activeMaterialView: 'inbox',
    selectedEmailId: 1,
    selectedFileId: 'analysis-summary',
    replies: buildReplies(),
    taskBreakdown: ['', '', '', ''],
    analysis: {
      keyFindings: '',
      evidence: '',
      recommendation: '',
      risk: '',
      questions: ''
    },
    urgentA: { customerReply: '', actionSteps: ['', '', ''] },
    urgentB: { addOnNote: '', bullets: ['', '', ''] },
    chatMessages: [
      {
        id: uid('assistant'),
        role: 'assistant',
        text:
          tool === 'avatar'
            ? "Hi, I'm your avatar assistant. I can help summarize the packet and draft grounded responses."
            : 'Hello. I can help summarize packet materials and draft grounded responses.',
        createdAt: Date.now()
      }
    ],
    validation: {},
    roundComplete: false
  };
}

export function createNewSession(): SessionState {
  const comboCode = pick(COMBOS);
  const [toolToken, setToken] = comboCode.split('-') as [string, string];
  const roundTools: [ToolType, ToolType] = toolToken === 'CA' ? ['chatgpt', 'avatar'] : ['avatar', 'chatgpt'];
  const roundSets: ['A' | 'B', 'A' | 'B'] = setToken === 'AB' ? ['A', 'B'] : ['B', 'A'];
  const round1Emergency: EmergencyType = Math.random() < 0.5 ? 'A' : 'B';
  const round2Emergency: EmergencyType = round1Emergency === 'A' ? 'B' : 'A';

  return {
    version: 3,
    participantId: buildParticipantId(comboCode),
    comboCode,
    createdAt: Date.now(),
    currentRoundIndex: 0,
    appFlow: 'intro',
    guideStep: 0,
    researcherMode: false,
    rounds: [
      buildRound(1, roundTools[0], roundSets[0], round1Emergency),
      buildRound(2, roundTools[1], roundSets[1], round2Emergency)
    ],
    lastUpdatedAt: Date.now()
  };
}
