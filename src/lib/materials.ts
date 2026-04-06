import { TASK_SETS } from '../data/materials';
import type { Email, EmergencyType, TaskSet, TaskSetId } from './types';

export function getTaskSet(taskSetId: TaskSetId): TaskSet {
  return TASK_SETS[taskSetId];
}

export function getRequiredEmails(taskSetId: TaskSetId): Email[] {
  return TASK_SETS[taskSetId].emails.filter((email) => email.requiredReply);
}

export function buildUrgentCardText(taskSetId: TaskSetId, emergencyType: EmergencyType) {
  const taskSet = TASK_SETS[taskSetId];
  const urgent = taskSet.urgentTasks[emergencyType];
  return `${urgent.title}\n\n${urgent.prompt}\n\nRequired output:\n${urgent.deliverableHint}`;
}
