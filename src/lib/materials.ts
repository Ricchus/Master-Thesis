import { TASK_SETS } from '../data/materials';
import type { Email, EmergencyType, MaterialBlock, MaterialInline, TaskSet, TaskSetId } from './types';

export function getTaskSet(taskSetId: TaskSetId): TaskSet {
  return TASK_SETS[taskSetId];
}

export function getRequiredEmails(taskSetId: TaskSetId): Email[] {
  return TASK_SETS[taskSetId].emails.filter((email) => email.requiredReply);
}

function materialInlineTextToPlain(inline: MaterialInline) {
  return inline.text;
}

export function materialContentToPlainText(content: MaterialBlock[]) {
  return content
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
          return block.content.map(materialInlineTextToPlain).join('');
        case 'bullets':
          return block.items
            .map((item) => `- ${item.map(materialInlineTextToPlain).join('')}`)
            .join('\n');
        case 'table': {
          const header = block.columns.join(' | ');
          const divider = block.columns.map(() => '---').join(' | ');
          const rows = block.rows.map((row) => row.join(' | ')).join('\n');
          return [header, divider, rows].filter(Boolean).join('\n');
        }
        case 'note':
          return [block.title, block.content.map(materialInlineTextToPlain).join('')].filter(Boolean).join('\n');
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

export function buildEmailClipboardText(email: Email) {
  const parts = [
    `Email ${email.id}`,
    `From: ${email.from}`,
    `Subject: ${email.subject}`,
    `Time: ${email.timestamp}`
  ];

  if (email.requiredReply) {
    parts.push('Required reply: Yes');
  }

  parts.push('', materialContentToPlainText(email.body));
  return parts.join('\n');
}

export function buildUrgentCardContent(taskSetId: TaskSetId, emergencyType: EmergencyType): MaterialBlock[] {
  const taskSet = TASK_SETS[taskSetId];
  const urgent = taskSet.urgentTasks[emergencyType];
  return [
    {
      type: 'note',
      title: urgent.title,
      content: [{ type: 'text', text: urgent.prompt }]
    },
    {
      type: 'bullets',
      items: [
        [{ type: 'strong', text: 'Required output: ' }, { type: 'text', text: urgent.deliverableHint }]
      ]
    }
  ];
}
