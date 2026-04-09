import { uid } from './id';
import type { ConversationMessage, PhaseId, TaskSet, ToolType } from './types';

function buildUnavailableMessage() {
  return 'Live assistant replies are unavailable here. Deploy the app on Vercel with OPENAI_API_KEY configured, or use `vercel dev` for local backend routes.';
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
${toolStyleInstructions}
- Current phase: ${args.phase}.
- Current focus section: ${args.currentSectionLabel}.

Packet context:
Scenario: ${args.taskSet.background.scenario}
Objective: ${args.taskSet.background.objective}
Meeting time: ${args.taskSet.meetingTimeLabel}
Hints: ${args.taskSet.analysisPromptHints.join(' | ')}
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
      ? payload.text.trim()
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
