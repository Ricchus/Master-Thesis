import { getErrorMessage, getOpenAIClient, getOpenAIModel, parseJsonBody, sendMethodNotAllowed } from './_openai.js';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pass: { type: 'boolean' },
    issues: {
      type: 'array',
      items: { type: 'string' }
    },
    summary: { type: 'string' }
  },
  required: ['pass', 'issues', 'summary']
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendMethodNotAllowed(response);
  }

  const body = parseJsonBody(request.body);
  if (
    !body ||
    typeof body.stageLabel !== 'string' ||
    typeof body.requirements !== 'string' ||
    typeof body.submission !== 'string' ||
    typeof body.tool !== 'string'
  ) {
    return response.status(400).json({ error: 'Invalid validation payload.' });
  }

  try {
    const openai = getOpenAIClient();
    const completion = await openai.responses.create({
      model: getOpenAIModel(),
      instructions: `You are validating whether a participant submission in a local office-work simulation is adequate to continue.
Rules:
- Be stricter for task breakdown adequacy than for other stages.
- For replies, analysis, and urgent tasks, only fail if the user is clearly off-task, too thin, or obviously padding.
- For task breakdown, fail if tasks are generic, not clearly pre-meeting actions, or not grounded in the packet.
- Do not grade writing quality beyond adequacy.
- Return strict JSON only.
- Tool label is ${body.tool}.`,
      input: `Stage: ${body.stageLabel}\nRequirements: ${body.requirements}\nSubmission:\n${body.submission}`,
      text: {
        format: {
          type: 'json_schema',
          name: 'stage_validation',
          schema,
          strict: true
        }
      }
    });

    const raw = completion.output_text?.trim();
    if (!raw) {
      return response.status(502).json({ error: 'OpenAI returned an empty validation payload.' });
    }

    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.pass !== 'boolean' ||
      !Array.isArray(parsed?.issues) ||
      typeof parsed?.summary !== 'string'
    ) {
      return response.status(502).json({ error: 'OpenAI returned an invalid validation payload.' });
    }

    return response.status(200).json(parsed);
  } catch (error) {
    const message = getErrorMessage(error, 'OpenAI validation request failed.');
    const status = message.includes('OPENAI_API_KEY') ? 503 : 500;
    return response.status(status).json({ error: message });
  }
}
