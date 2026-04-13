import { uid } from './id';
import type { ConversationMessage, PhaseId, TaskSet, ToolType } from './types';

type ResponseMode =
  | 'task_breakdown'
  | 'draft_reply'
  | 'analysis_brief'
  | 'risk_or_question'
  | 'summary'
  | 'general_help';

function buildUnavailableMessage() {
  return 'Live assistant replies are unavailable here. Deploy the app on Vercel with OPENAI_API_KEY configured, or use `vercel dev` for local backend routes.';
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

function detectResponseMode(args: {
  phase: PhaseId;
  currentSectionLabel: string;
  userMessage: string;
}): ResponseMode {
  const source = args.userMessage.toLowerCase();

  if (
    /\b(task breakdown|pre-?meeting|before the 11:00|before 11:00|top 3|top three|priorit|checklist|identify the work|what still needs to be done|what do i still need to do)\b/.test(source)
  ) {
    return 'task_breakdown';
  }

  if (
    /\b(draft|compose|write|revise|polish)\b/.test(source) &&
    /\b(reply|email|response|message)\b/.test(source)
  ) {
    return 'draft_reply';
  }

  if (/\b(reply to|respond to|email to)\b/.test(source)) {
    return 'draft_reply';
  }

  if (
    /\b(recommendation|brief|analysis brief|briefing note|decision note|meeting brief|recommend)\b/.test(source)
  ) {
    return 'analysis_brief';
  }

  if (/\b(risk|risks|discussion question|discussion questions|question for the meeting|questions for the meeting)\b/.test(source)) {
    return 'risk_or_question';
  }

  if (/\b(summarize|summary|recap|what matters|key points|key takeaways)\b/.test(source)) {
    return 'summary';
  }

  return 'general_help';
}

function buildResponseModeInstructions(mode: ResponseMode) {
  switch (mode) {
    case 'task_breakdown':
      return `Response contract for this request:
- Output exactly 3 numbered priority actions.
- Each item must be one concrete action to complete before the 11:00 meeting.
- Merge overlapping work instead of listing near-duplicates.
- Do not list logistics, background facts, risks, or evidence as separate items unless they require a concrete action.
- Do not restate the same deliverable in multiple forms.
- Keep each item to one sentence.`;
    case 'draft_reply':
      return `Response contract for this request:
- Give the user a clean, directly usable draft.
- Keep the draft itself professional and sendable.
- Do not add extra checklist items or meeting logistics unless the user explicitly asks for them.
- If you need context that is missing, say what is missing briefly.`;
    case 'analysis_brief':
      return `Response contract for this request:
- Organize the answer as a concise work product.
- Prefer a tight structure such as recommendation, evidence, risk, and discussion question when relevant.
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
  return `Packet context:
Task objective:
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

function buildToolStyleInstructions(tool: ToolType) {
  if (tool === 'avatar') {
    return `Tool persona rules:
- Write in a warm, supportive avatar-assistant style.
- For normal assistant replies, include one very short supportive opener before the main answer and one very short supportive closer after the main answer.
- Keep the opener and closer as separate short paragraphs, each only one sentence.
- The main body must stay concise, practical, grounded in the packet, and work-product oriented.
- Do not let the supportive framing take over the answer.
- Do not use emojis, internet slang, multiple exclamation points, or exaggerated praise.
- If you provide bullet points or numbered steps, keep the opener before the list and the closer after the list.
- If you draft text the user may send to someone else, keep the draft itself clean and professional. Put any supportive avatar framing outside the drafted text, not inside it.`;
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

export async function requestAssistantReply(args: {
  tool: ToolType;
  taskSet: TaskSet;
  phase: PhaseId;
  currentSectionLabel: string;
  userMessage: string;
  conversation: ConversationMessage[];
}) {
  const responseMode = detectResponseMode({
    phase: args.phase,
    currentSectionLabel: args.currentSectionLabel,
    userMessage: args.userMessage
  });
  const transcript = args.conversation
    .slice(-10)
    .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
    .join('\n\n');

  const toolStyleInstructions = buildToolStyleInstructions(args.tool);
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

Scenario:
- ${args.taskSet.background.scenario}

${buildPacketContext(args.taskSet)}
`;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instructions,
        input: `Conversation so far:\n${transcript}\n\nUser request:\n${args.userMessage}`
      })
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      if (response.status === 404 || response.status === 405 || response.status === 503) {
        return {
          id: uid('assistant'),
          role: 'assistant' as const,
          text: extractErrorMessage(payload) ?? buildUnavailableMessage(),
          createdAt: Date.now()
        };
      }

      throw new Error(extractErrorMessage(payload) ?? 'Assistant request failed.');
    }

    const text = payload && typeof payload === 'object' && 'text' in payload && typeof payload.text === 'string'
      ? normalizeAssistantResponseFormatting(payload.text)
      : '';

    return {
      id: uid('assistant'),
      role: 'assistant' as const,
      text: text || 'I could not produce a reply just now. Please try again.',
      createdAt: Date.now()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      return {
        id: uid('assistant'),
        role: 'assistant' as const,
        text: buildUnavailableMessage(),
        createdAt: Date.now()
      };
    }

    throw error;
  }
}
