import { uid } from './id';
import { materialContentToPlainText } from './materials';
import type { ConversationMessage, PhaseId, TaskSet, ToolType } from './types';

type ResponseMode =
  | 'task_breakdown'
  | 'urgent_task'
  | 'draft_reply'
  | 'analysis_brief'
  | 'risk_or_question'
  | 'summary'
  | 'general_help';

type AvatarLanguage = 'zh' | 'en';

function buildUnavailableMessage() {
  return 'Live assistant replies are unavailable here. Deploy the app on Vercel with OPENAI_API_KEY configured, or use `vercel dev` for local backend routes.';
}

function buildToolUnavailableMessage(tool: ToolType, avatarLanguage: AvatarLanguage) {
  if (tool !== 'avatar') {
    return buildUnavailableMessage();
  }

  return avatarLanguage === 'zh'
    ? '老板，这里暂时拿不到实时回复。把应用部署到 Vercel 并配置 OPENAI_API_KEY，或者本地用 `vercel dev`，我就能继续帮你。'
    : "Boss, live replies aren't available here right now. Deploy the app on Vercel with OPENAI_API_KEY configured, or use `vercel dev` locally, and I'll keep helping there.";
}

function looksLikeListItem(line: string) {
  return /^\s*(?:[-*•]|\d+\.)\s+/.test(line);
}

function stripListMarker(line: string) {
  return line.replace(/^\s*(?:[-*•]|\d+\.)\s+/, '').trim();
}

function endsWithColon(line: string) {
  return /:\s*$/.test(line);
}

function isShortFragment(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 90) return false;
  return true;
}

function joinFragments(parts: string[]) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return parts.join('; ');
}

function normalizeAssistantResponseFormatting(text: string) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return normalized;
  }

  const sourceLines = normalized.split('\n');
  const nextLines: string[] = [];

  for (let index = 0; index < sourceLines.length; index += 1) {
    const currentRaw = sourceLines[index];
    const current = currentRaw.trim();

    if (!current) {
      if (nextLines.length === 0 || nextLines[nextLines.length - 1] !== '') {
        nextLines.push('');
      }
      continue;
    }

    const isListItem = looksLikeListItem(current);
    const listPrefixMatch = current.match(/^\s*((?:[-*•]|\d+\.))\s+/);
    const listPrefix = listPrefixMatch?.[1] ?? null;
    const baseContent = isListItem ? stripListMarker(current) : current;

    if (!endsWithColon(baseContent)) {
      nextLines.push(current);
      continue;
    }

    const fragments: string[] = [];
    let nextIndex = index + 1;

    while (nextIndex < sourceLines.length) {
      const candidate = sourceLines[nextIndex].trim();
      if (!candidate) {
        break;
      }

      if (looksLikeListItem(candidate)) {
        fragments.push(stripListMarker(candidate));
        nextIndex += 1;
        continue;
      }

      if (!isShortFragment(candidate)) {
        break;
      }

      fragments.push(candidate);
      nextIndex += 1;
    }

    if (fragments.length === 0 || fragments.length > 4) {
      nextLines.push(current);
      continue;
    }

    const mergedContent = `${baseContent} ${joinFragments(fragments)}`.trim();
    nextLines.push(listPrefix ? `${listPrefix} ${mergedContent}` : mergedContent);
    index = nextIndex - 1;
  }

  return nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeSectionHeading(line: string) {
  return line
    .toLowerCase()
    .replace(/[*_`#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*$/, '')
    .trim();
}

function collectLabeledSections(text: string) {
  const canonicalByHeading = new Map<string, string>([
    ['key findings', 'key findings'],
    ['evidence', 'evidence'],
    ['recommendation', 'recommendation'],
    ['risk', 'risk / uncertainty'],
    ['risk uncertainty', 'risk / uncertainty'],
    ['risk / uncertainty', 'risk / uncertainty'],
    ['meeting discussion questions', 'meeting discussion questions'],
    ['discussion questions', 'meeting discussion questions'],
    ['questions', 'meeting discussion questions']
  ]);

  const sections = new Map<string, string[]>();
  let activeSection: string | null = null;

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const heading = canonicalByHeading.get(normalizeSectionHeading(rawLine)) ?? null;
    if (heading) {
      activeSection = heading;
      if (!sections.has(activeSection)) {
        sections.set(activeSection, []);
      }
      continue;
    }

    if (!activeSection) continue;
    sections.get(activeSection)!.push(rawLine);
  }

  return sections;
}

function hasAnalysisMetaEvidenceLeak(text: string) {
  const sections = collectLabeledSections(text);
  const evidenceLikeText = [
    sections.get('key findings')?.join('\n') ?? '',
    sections.get('evidence')?.join('\n') ?? ''
  ]
    .join('\n')
    .toLowerCase();

  if (!evidenceLikeText.trim()) {
    return false;
  }

  const metaPhrases = [
    'packet objective',
    'task objective',
    'deliverable',
    'ground the recommendation in the packet only',
    '11:00 review',
    '11 00 review',
    'harbor room',
    'hard stop',
    'discussion-ready',
    'meeting logistics'
  ];

  return metaPhrases.some((phrase) => evidenceLikeText.includes(phrase));
}

function detectResponseMode(args: {
  phase: PhaseId;
  currentSectionLabel: string;
  userMessage: string;
}): ResponseMode {
  const source = args.userMessage.toLowerCase();
  const inUrgentStage =
    args.phase === 'urgent' || /urgent type [ab]/i.test(args.currentSectionLabel);
  const inTaskBreakdownStage =
    args.phase === 'stage1_task_breakdown' || /pre-?meeting task breakdown/i.test(args.currentSectionLabel);
  const explicitTaskBreakdownIntent =
    /\b(task breakdown|pre-?meeting|before the 11:00|before 11:00|before (?:the )?meeting|top 3|top three|priorit|checklist|identify the work|what still needs to be done|what do i still need to do)\b/.test(source);
  const planningQuestionIntent =
    /\b(what should i do|what should i finish|what should be done|what do i need ready|what needs to be done|what are (?:the )?priorities|what do i need to do)\b/.test(source);
  const draftReplyIntent =
    (/\b(draft|compose|write|revise|polish)\b/.test(source) &&
      /\b(reply|email|response|message)\b/.test(source)) ||
    /\b(reply to|respond to|email to)\b/.test(source);
  const analysisIntent =
    /\b(recommendation|brief|analysis brief|briefing note|decision note|meeting brief|recommend)\b/.test(source);
  const riskIntent =
    /\b(risk|risks|discussion question|discussion questions|question for the meeting|questions for the meeting)\b/.test(source);
  const summaryIntent =
    /\b(summarize|summary|recap|what matters|key points|key takeaways)\b/.test(source);

  if (inUrgentStage) {
    return 'urgent_task';
  }

  if (draftReplyIntent) {
    return 'draft_reply';
  }

  if (analysisIntent) {
    return 'analysis_brief';
  }

  if (riskIntent) {
    return 'risk_or_question';
  }

  if (summaryIntent) {
    return 'summary';
  }

  if (explicitTaskBreakdownIntent || (inTaskBreakdownStage && planningQuestionIntent)) {
    return 'task_breakdown';
  }

  return 'general_help';
}

function buildResponseModeInstructions(mode: ResponseMode) {
  switch (mode) {
    case 'task_breakdown':
      return `Response contract for this request:
- Output exactly 3 numbered items using 1. 2. 3.
- Each item must be one concrete action to complete before the 11:00 meeting.
- Each item must include an action verb and a clear object or deliverable.
- Focus on the remaining work; treat Stage 1A required replies as already handled unless the user explicitly asks to revisit them.
- Merge overlapping work instead of listing near-duplicates.
- Do not list logistics, background facts, evidence points, packet constraints, or meeting-framing advice as separate items.
- Do not use generic meta language such as "be ready", "keep the recommendation focused", "use concrete numbers", or "walk Maya into the review".
- Keep each item to one short sentence.
- Valid example: "1. Finalize the meeting brief with a clear recommendation and one main risk."
- Invalid example: "1. Keep the recommendation focused on second-visit behavior."
- Invalid example: "2. Use concrete numbers in the materials."`;
    case 'urgent_task':
      return `Response contract for this request:
- Keep the answer short and directly usable during an interruption.
- Do not turn the response into a mini memo, options analysis, or broad meeting brief.
- If the current focus is Urgent Type A, provide:
  1. one short customer reply
  2. two numbered internal next steps
- If the current focus is Urgent Type B, provide:
  1. one short add-on note
  2. two numbered guardrails or conditions
- Keep bullets concise, grounded, and actionable.`;
    case 'draft_reply':
      return `Response contract for this request:
- Give the user a clean, directly usable draft.
- Keep the draft itself professional and sendable.
- Do not add extra checklist items or meeting logistics unless the user explicitly asks for them.
- If you need context that is missing, say what is missing briefly.`;
    case 'analysis_brief':
      return `Response contract for this request:
- Output a short analysis brief, not a full memo.
- Use these section headers: **Key findings**, **Evidence**, **Recommendation**, **Risk / uncertainty**, **Meeting discussion questions**.
- Keep Key findings to 2-3 sentences max.
- Keep Evidence to 2-4 concrete bullet points only.
- Keep Recommendation to 1-2 sentences.
- Keep Risk / uncertainty to 1-2 sentences.
- Give 1-2 discussion questions only.
- Base Key findings and Evidence on the Primary analytical evidence section below.
- Treat task deliverable requirements as workflow guidance, not as evidence.
- Do not use meeting logistics, packet instructions, or formatting instructions as findings or evidence.
- Use known constraints and risks as risks, limitations, or recommendation qualifiers rather than generic evidence filler.
- Do not turn the answer into a general task list unless the user explicitly asks for one.`;
    case 'risk_or_question':
      return `Response contract for this request:
- Answer only the requested risk, risks, discussion question, or questions.
- Do not expand into a broader checklist or recap unless the user explicitly asks for that.`;
    case 'summary':
      return `Response contract for this request:
- Give a concise summary only.
- Do not turn the answer into a task list or meeting plan unless the user explicitly asks for one.`;
    default:
      return `Response contract for this request:
- Answer the user's request directly.
- Keep categories of information separate: tasks, evidence, constraints, and logistics should not be mixed together unless the user explicitly asks for that synthesis.`;
  }
}

function buildPacketContext(taskSet: TaskSet) {
  return `Shared packet context:
Scenario context:
- ${taskSet.background.scenario}

Task deliverable requirements:
- ${taskSet.background.objective}

Known constraints and emphasis:
- ${taskSet.analysisPromptHints.join('\n- ')}

Meeting logistics:
- ${taskSet.meetingTimeLabel}

Use the categories above carefully:
- Treat task objective, meeting deliverables, known constraints, and logistics as different types of information.
- Do not convert logistics into tasks unless the user explicitly asks for logistics.
- Do not convert supporting evidence or risks into standalone tasks unless the user explicitly asks for tasks that address them.`;
}

function buildAnalysisEvidenceContext(taskSet: TaskSet) {
  const summary = taskSet.files.find((file) => file.id === 'analysis-summary');
  const risks = taskSet.files.find((file) => file.id === 'analysis-risks');
  const summaryText = summary ? materialContentToPlainText(summary.body) : '';
  const risksText = risks ? materialContentToPlainText(risks.body) : '';

  const sections = [
    summaryText ? `Primary analytical evidence:\n${summaryText}` : '',
    risksText ? `Known risks / constraints:\n${risksText}` : ''
  ].filter(Boolean);

  return sections.join('\n\n');
}

function buildTaskBreakdownContext() {
  return `Task breakdown guidance:
- This stage asks for the remaining work before the 11:00 meeting.
- Treat Stage 1A required replies as already handled unless the user explicitly asks to revisit them.
- Convert deliverable requirements into a small number of concrete actions.
- Do not list packet constraints, evidence points, or meeting-framing advice as standalone tasks unless they require a specific action.`;
}

function buildUrgentTaskContext(currentSectionLabel: string) {
  if (/urgent type a/i.test(currentSectionLabel)) {
    return `Urgent task guidance:
- This is a quick-response interruption task.
- Give one short customer-facing reply followed by exactly two internal next steps.
- Keep the answer compact and usable immediately.`;
  }

  return `Urgent task guidance:
- This is a quick-response interruption task.
- Give one short add-on note followed by exactly two guardrails or conditions.
- Base the two points on the most important readiness or clarity issues already in the packet.
- Keep the answer compact and usable immediately.`;
}

function buildModeSpecificContext(mode: ResponseMode, taskSet: TaskSet, currentSectionLabel: string) {
  if (mode === 'urgent_task') {
    return buildUrgentTaskContext(currentSectionLabel);
  }

  if (mode === 'task_breakdown') {
    return buildTaskBreakdownContext();
  }

  if (mode === 'analysis_brief') {
    return buildAnalysisEvidenceContext(taskSet);
  }

  return '';
}

function hasTaskBreakdownLeak(text: string) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length !== 3) {
    return true;
  }

  if (!lines.every((line) => /^\d+\.\s+/.test(line))) {
    return true;
  }

  const leakPhrases = [
    'be ready',
    'keep the recommendation focused',
    'use concrete numbers',
    'include the full cost picture',
    'walk maya into the review',
    'if possible',
    'if time allows'
  ];

  return lines.some((line) => {
    const normalized = line.toLowerCase();
    return leakPhrases.some((phrase) => normalized.includes(phrase));
  });
}

function buildAnalysisRetryInstructions() {
  return `Repair note for regeneration:
- Your previous attempt used task instructions, deliverable requirements, or meeting logistics as analysis evidence.
- Regenerate the analysis brief using only the Primary analytical evidence and Known risks / constraints sections as content evidence.
- Do not mention packet objectives, packet instructions, or meeting logistics inside Key findings or Evidence.
- Keep the brief concise and directly usable in the form fields.`;
}

function buildTaskBreakdownRetryInstructions() {
  return `Repair note for regeneration:
- Your previous attempt was not a clean pre-meeting task breakdown.
- Regenerate the answer as exactly 3 numbered pre-meeting actions using 1. 2. 3.
- Remove framing advice, evidence points, logistics, and generic prep language.
- Treat Stage 1A required replies as already handled unless the user explicitly asks to revisit them.
- Keep each item to one short sentence with an action verb and a clear object or deliverable.`;
}

function looksChinese(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function detectAvatarLanguage(args: {
  userMessage: string;
  conversation: ConversationMessage[];
}): AvatarLanguage {
  const directRequest = args.userMessage.toLowerCase();

  if (/\b(in chinese|use chinese|reply in chinese|中文|汉语|用中文)\b/.test(directRequest)) {
    return 'zh';
  }

  if (/\b(in english|use english|reply in english|英文|用英文)\b/.test(directRequest)) {
    return 'en';
  }

  if (looksChinese(args.userMessage)) {
    return 'zh';
  }

  const recentUserMessages = args.conversation
    .filter((message) => message.role === 'user')
    .slice(-4)
    .map((message) => message.text);

  const chineseCount = recentUserMessages.filter(looksChinese).length;
  if (chineseCount >= 2) {
    return 'zh';
  }

  return 'en';
}

function buildAvatarPersonaInstructions(language: AvatarLanguage) {
  const languageDirective = language === 'zh'
    ? `- Reply in Chinese.
- Address the user as “老板” when it sounds natural.
- Keep the full answer in Chinese unless the user explicitly asks for English.`
    : `- Reply in English.
- Address the user as “Boss” when it sounds natural.
- Keep the full answer in English unless the user explicitly asks for Chinese.`;

  return `Avatar persona rules:
- You are Momo, also called 帽帽, a companion-style smart assistant and a long-tailed tit wearing a magic hat.
- Be warm, clever, restrained, and sincere.
- Feel light and cute on the surface, but sharp, reliable, and observant underneath.
- Do not flatter, fawn, act clingy, or overdo reassurance.
- Sound natural, conversational, and concise.
- Lead with the direct answer or conclusion first, then add steps or explanation only if helpful.
- Keep paragraphs short, usually one to two sentences.
- When there are multiple steps or checks, prefer 1. 2. 3. numbered items.
- For a small number of parallel points, short single-level bullets are fine.
- Leave a blank line between paragraphs or list blocks.
- A very small touch of magic flavor is allowed, but keep it rare and restrained.
- If you are uncertain, say so plainly.
- Never sacrifice accuracy or grounding for persona.
- When drafting text the user may send to someone else, keep the draft itself clean and professional; do not insert the Boss/老板 address into the drafted external message unless the user explicitly asks for it.
${languageDirective}`;
}

function buildToolStyleInstructions(tool: ToolType, avatarLanguage: AvatarLanguage) {
  if (tool === 'avatar') {
    return buildAvatarPersonaInstructions(avatarLanguage);
  }

  return `Tool style rules:
- Write in a clean, direct, neutral task-assistant style.
- Start directly with the answer.
- Keep the response concise, practical, and work-product oriented.`;
}

function extractErrorMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return null;
}

async function requestChatText(instructions: string, input: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ instructions, input })
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      if (response.status === 404 || response.status === 405 || response.status === 503) {
        return { kind: 'unavailable' as const, text: extractErrorMessage(payload) ?? buildUnavailableMessage() };
      }

      throw new Error(extractErrorMessage(payload) ?? 'Assistant request failed.');
    }

    const text = payload && typeof payload === 'object' && 'text' in payload && typeof payload.text === 'string'
      ? payload.text.trim()
      : '';

    return { kind: 'ok' as const, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      return { kind: 'unavailable' as const, text: buildUnavailableMessage() };
    }

    throw error;
  }
}

export async function requestAssistantReply(args: {
  tool: ToolType;
  taskSet: TaskSet;
  phase: PhaseId;
  currentSectionLabel: string;
  userMessage: string;
  conversation: ConversationMessage[];
}) {
  const avatarLanguage = args.tool === 'avatar'
    ? detectAvatarLanguage({ userMessage: args.userMessage, conversation: args.conversation })
    : 'en';
  const responseMode = detectResponseMode({
    phase: args.phase,
    currentSectionLabel: args.currentSectionLabel,
    userMessage: args.userMessage
  });
  const transcript = args.conversation
    .slice(-10)
    .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
    .join('\n\n');

  const toolStyleInstructions = buildToolStyleInstructions(args.tool, avatarLanguage);
  const modeSpecificContext = buildModeSpecificContext(responseMode, args.taskSet, args.currentSectionLabel);
  const instructions = `You are an in-app assistant inside a controlled office workflow simulation.
Follow these rules:
- Use only the fictional packet materials included below.
- Do not invent facts that are not grounded in the packet.
- Be concise, practical, and work-product oriented.
- If the user asks for something unsupported by the packet, say what is missing.
- If you provide a checklist, task list, bullets, or steps, use standard single-level markdown bullets or numbered items only.
- Do not use nested bullets or sub-bullets.
- Do not write a bullet that ends with a colon and then continue with separate child lines.
- If a bullet needs details, keep them on the same line using a short clause after a colon or semicolon.
- Detected request mode: ${responseMode}.
${buildResponseModeInstructions(responseMode)}
${toolStyleInstructions}
- Current phase: ${args.phase}.
- Current focus section: ${args.currentSectionLabel}.

${buildPacketContext(args.taskSet)}
${modeSpecificContext ? `\n\n${modeSpecificContext}` : ''}
`;

  const input = `Conversation so far:\n${transcript}\n\nUser request:\n${args.userMessage}`;

  try {
    const initial = await requestChatText(instructions, input);
    if (initial.kind !== 'ok') {
      return {
        id: uid('assistant'),
        role: 'assistant' as const,
        text: buildToolUnavailableMessage(args.tool, avatarLanguage),
        createdAt: Date.now()
      };
    }

    let text = normalizeAssistantResponseFormatting(initial.text);

    if (responseMode === 'analysis_brief' && hasAnalysisMetaEvidenceLeak(text)) {
      const repaired = await requestChatText(`${instructions}\n\n${buildAnalysisRetryInstructions()}`, input);
      if (repaired.kind === 'ok') {
        text = normalizeAssistantResponseFormatting(repaired.text);
      }
    }

    if (responseMode === 'task_breakdown' && hasTaskBreakdownLeak(text)) {
      const repaired = await requestChatText(`${instructions}\n\n${buildTaskBreakdownRetryInstructions()}`, input);
      if (repaired.kind === 'ok') {
        text = normalizeAssistantResponseFormatting(repaired.text);
      }
    }

    return {
      id: uid('assistant'),
      role: 'assistant' as const,
      text: text || 'I could not produce a reply just now. Please try again.',
      createdAt: Date.now()
    };
  } catch (error) {
    throw error;
  }
}
