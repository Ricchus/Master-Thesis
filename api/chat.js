import { getErrorMessage, getOpenAIClient, getOpenAIModel, parseJsonBody, sendMethodNotAllowed } from './_openai.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendMethodNotAllowed(response);
  }

  const body = parseJsonBody(request.body);
  if (!body || typeof body.instructions !== 'string' || typeof body.input !== 'string') {
    return response.status(400).json({ error: 'Invalid chat payload.' });
  }

  try {
    const openai = getOpenAIClient();
    const completion = await openai.responses.create({
      model: getOpenAIModel(),
      instructions: body.instructions,
      input: body.input
    });

    return response.status(200).json({
      text: completion.output_text?.trim() || 'I could not produce a reply just now. Please try again.'
    });
  } catch (error) {
    const message = getErrorMessage(error, 'OpenAI chat request failed.');
    const status = message.includes('OPENAI_API_KEY') ? 503 : 500;
    return response.status(status).json({ error: message });
  }
}
