import { getRequiredEmails, getTaskSet, materialContentToPlainText } from './materials';
import type { AnalysisBrief, RoundState, StageValidationResult, ToolType } from './types';

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasMeaningfulSentence(text: string, minWords = 8) {
  return wordCount(text) >= minWords && /[a-zA-Z]/.test(text) && !/^(test|asdf|ok|done|n\/a|na)$/i.test(text.trim());
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function dedupeCount(items: string[]) {
  const set = new Set(items.map((item) => normalize(item)).filter(Boolean));
  return set.size;
}

function buildRuleFailure(summary: string, issues: string[]): StageValidationResult {
  return { passed: false, mode: 'rules', summary, issues };
}

function buildSuccess(mode: StageValidationResult['mode'], summary: string): StageValidationResult {
  return { passed: true, mode, summary, issues: [] };
}

async function requestAiValidation(stageLabel: string, requirements: string, submission: string, tool: ToolType) {
  try {
    const response = await fetch('/api/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requirements,
        stageLabel,
        submission,
        tool
      })
    });

    if (!response.ok) {
      return null;
    }

    const parsed = await response.json() as { pass: boolean; issues: string[]; summary: string };
    if (typeof parsed.pass !== 'boolean' || !Array.isArray(parsed.issues) || typeof parsed.summary !== 'string') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function validateReplies(round: RoundState): Promise<StageValidationResult> {
  const required = getRequiredEmails(round.taskSetId);
  const issues: string[] = [];

  for (const requiredEmail of required) {
    const reply = round.replies.find((item) => item.emailId === requiredEmail.id);
    if (!reply) {
      issues.push(`Missing reply card for Email ${requiredEmail.id}.`);
      continue;
    }

    if (!reply.to.trim()) issues.push(`Reply to Email ${requiredEmail.id} is missing the To field.`);
    if (!reply.subject.trim()) issues.push(`Reply to Email ${requiredEmail.id} is missing the Subject field.`);
    if (!hasMeaningfulSentence(reply.body, 12)) {
      issues.push(`Reply to Email ${requiredEmail.id} needs at least one or two complete grounded sentences.`);
    }
  }

  if (issues.length) {
    return buildRuleFailure('Finish both required email replies before continuing.', issues);
  }

  const submission = required
    .map((email) => {
      const reply = round.replies.find((item) => item.emailId === email.id)!;
      return `Original email ${email.id} from ${email.from}: ${email.subject}\nOriginal body: ${materialContentToPlainText(email.body)}\n\nDraft reply:\nTo: ${reply.to}\nSubject: ${reply.subject}\nBody: ${reply.body}`;
    })
    .join('\n\n---\n\n');

  const ai = await requestAiValidation(
    'Required email replies',
    'Two grounded replies to the designated emails. They should answer the ask in each original email and look like plausible short work emails.',
    submission,
    round.tool
  );

  if (!ai) return buildSuccess('fallback', 'Both required replies are present and pass baseline checks.');
  if (!ai.pass) {
    return { passed: false, mode: 'rules+ai', summary: ai.summary || 'Please revise before continuing.', issues: ai.issues.slice(0, 3) };
  }
  return buildSuccess('rules+ai', ai.summary || 'Required replies look adequate.');
}

export async function validateTaskBreakdown(round: RoundState): Promise<StageValidationResult> {
  const items = round.taskBreakdown.map((item) => item.trim()).filter(Boolean);
  const issues: string[] = [];

  if (items.length < 3) {
    issues.push('List at least three tasks that must be completed before the meeting.');
  }

  round.taskBreakdown.forEach((item, index) => {
    if (item.trim() && !hasMeaningfulSentence(item, 6)) {
      issues.push(`Task ${index + 1} is too short or too vague.`);
    }
  });

  if (dedupeCount(items) < Math.min(items.length, 3)) {
    issues.push('The task list contains repeated or near-duplicate items.');
  }

  const genericOnly = items.filter((item) => /^(prepare|check|review|analyze|write|reply)$/i.test(item.trim())).length;
  if (genericOnly > 0) {
    issues.push('Make each task concrete. Avoid one-word or generic entries.');
  }

  if (issues.length) {
    return buildRuleFailure('Your pre-meeting task breakdown needs revision.', issues);
  }

  const taskSet = getTaskSet(round.taskSetId);
  const ai = await requestAiValidation(
    'Pre-meeting task breakdown',
    `The list should contain three concise but concrete actions that should be completed before the 11:00 meeting for ${taskSet.shortTitle}. Accept short action items if they are specific, actionable, and grounded in the packet. Fail only if items are mostly generic, repeated, not clearly pre-meeting actions, or not grounded in the packet.`,
    items.map((item, index) => `${index + 1}. ${item}`).join('\n'),
    round.tool
  );

  if (!ai) return buildSuccess('fallback', 'Task breakdown passes baseline checks.');
  if (!ai.pass) {
    return { passed: false, mode: 'rules+ai', summary: ai.summary || 'Refine the task breakdown before continuing.', issues: ai.issues.slice(0, 4) };
  }
  return buildSuccess('rules+ai', ai.summary || 'Task breakdown is sufficiently concrete.');
}

function analysisRules(analysis: AnalysisBrief) {
  const issues: string[] = [];
  if (!hasMeaningfulSentence(analysis.keyFindings, 10)) issues.push('Add at least one concrete key finding.');
  if (wordCount(analysis.evidence) < 14) issues.push('Evidence should include at least two concrete points or trends.');
  if (!hasMeaningfulSentence(analysis.recommendation, 8)) issues.push('Add a recommendation that is specific enough to act on.');
  if (!hasMeaningfulSentence(analysis.risk, 6)) issues.push('Add at least one substantive risk or uncertainty.');
  if (!hasMeaningfulSentence(analysis.questions, 6)) issues.push('Add at least one meeting discussion question.');
  return issues;
}

export async function validateAnalysis(round: RoundState): Promise<StageValidationResult> {
  const issues = analysisRules(round.analysis);
  if (issues.length) {
    return buildRuleFailure('The analysis brief is incomplete.', issues);
  }

  const taskSet = getTaskSet(round.taskSetId);
  const submission = `Scenario: ${taskSet.shortTitle}\nKey findings: ${round.analysis.keyFindings}\nEvidence: ${round.analysis.evidence}\nRecommendation: ${round.analysis.recommendation}\nRisk: ${round.analysis.risk}\nQuestions: ${round.analysis.questions}`;
  const ai = await requestAiValidation(
    'Analysis brief',
    'The brief should contain grounded findings, at least two evidence points, a recommendation, one risk or uncertainty, and one or two discussion questions. Only fail if the user is clearly off-task, too thin, or obviously padding.',
    submission,
    round.tool
  );

  if (!ai) return buildSuccess('fallback', 'Analysis brief passes baseline checks.');
  if (!ai.pass) {
    return { passed: false, mode: 'rules+ai', summary: ai.summary || 'Please strengthen the analysis brief.', issues: ai.issues.slice(0, 3) };
  }
  return buildSuccess('rules+ai', ai.summary || 'Analysis brief looks adequate.');
}

export async function validateUrgent(round: RoundState): Promise<StageValidationResult> {
  const issues: string[] = [];
  let submission = '';
  let requirements = '';

  if (round.emergencyType === 'A') {
    if (!hasMeaningfulSentence(round.urgentA.customerReply, 8)) issues.push('Add a short but complete customer reply.');
    round.urgentA.actionSteps.slice(0, 2).forEach((step, index) => {
      if (!hasMeaningfulSentence(step, 4)) issues.push(`Next step ${index + 1} needs a concrete action.`);
    });
    submission = `Customer reply: ${round.urgentA.customerReply}\nNext step 1: ${round.urgentA.actionSteps[0]}\nNext step 2: ${round.urgentA.actionSteps[1]}`;
    requirements = 'Provide a short customer reply plus two concrete internal next steps. Accept concise answers if they are grounded and actionable.';
  } else {
    if (!hasMeaningfulSentence(round.urgentB.addOnNote, 8)) issues.push('Add a short add-on note.');
    round.urgentB.bullets.slice(0, 2).forEach((bullet, index) => {
      if (!hasMeaningfulSentence(bullet, 4)) issues.push(`Guardrail or condition ${index + 1} needs a concrete, grounded point.`);
    });
    submission = `Add-on note: ${round.urgentB.addOnNote}\nPoint 1: ${round.urgentB.bullets[0]}\nPoint 2: ${round.urgentB.bullets[1]}`;
    requirements = 'Provide a short add-on note plus two grounded guardrails or conditions. Accept concise bullets if they are packet-grounded and actionable.';
  }

  if (issues.length) {
    return buildRuleFailure('The urgent task output is incomplete.', issues);
  }

  const ai = await requestAiValidation(
    'Urgent task output',
    `${requirements} Only fail if the response is clearly off-task, too thin, or padded.`,
    submission,
    round.tool
  );

  if (!ai) return buildSuccess('fallback', 'Urgent task passes baseline checks.');
  if (!ai.pass) {
    return { passed: false, mode: 'rules+ai', summary: ai.summary || 'Please revise the urgent-task output.', issues: ai.issues.slice(0, 3) };
  }
  return buildSuccess('rules+ai', ai.summary || 'Urgent task output looks adequate.');
}
