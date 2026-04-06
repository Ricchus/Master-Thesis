import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-4.1-mini';

let client = null;

export function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function getOpenAIModel() {
  const configuredModel = process.env.OPENAI_MODEL?.trim();
  return configuredModel || DEFAULT_MODEL;
}

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable.');
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}

export function parseJsonBody(body) {
  if (!body) {
    return null;
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }

  if (typeof body === 'object') {
    return body;
  }

  return null;
}

export function sendMethodNotAllowed(response) {
  response.setHeader('Allow', 'POST');
  return response.status(405).json({ error: 'Method not allowed.' });
}
