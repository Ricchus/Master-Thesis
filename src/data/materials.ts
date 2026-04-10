import type { MaterialBlock, MaterialInline, TaskSet } from '../lib/types';

const text = (value: string): MaterialInline => ({ type: 'text', text: value });
const strong = (value: string): MaterialInline => ({ type: 'strong', text: value });

function inline(parts: Array<MaterialInline | string>) {
  return parts.map((part) => (typeof part === 'string' ? text(part) : part));
}

function paragraph(...parts: Array<MaterialInline | string>): MaterialBlock {
  return { type: 'paragraph', content: inline(parts) };
}

function paragraphText(value: string): MaterialBlock {
  return paragraph(value);
}

function bullets(...items: Array<Array<MaterialInline | string> | string>): MaterialBlock {
  return {
    type: 'bullets',
    items: items.map((item) => (Array.isArray(item) ? inline(item) : [text(item)]))
  };
}

function table(columns: string[], rows: string[][]): MaterialBlock {
  return { type: 'table', columns, rows };
}

function note(title: string | undefined, ...parts: Array<MaterialInline | string>): MaterialBlock {
  return { type: 'note', title, content: inline(parts) };
}

export const TASK_SETS: Record<'A' | 'B', TaskSet> = {
  A: {
    id: 'A',
    title: 'Task Set A — Welcome Back Weekend',
    shortTitle: 'Welcome Back Weekend',
    background: {
      company: 'Harbor Lane Retail is a fictional chain retailer focused on household basics, snacks, cleaning supplies, and seasonal items.',
      scenario:
        'The pilot under review is Welcome Back Weekend, aimed at dormant members who have not purchased in 60–120 days. Leadership must decide whether to expand, narrow, or revise the rollout.',
      role: 'You are the Program Associate supporting Maya Patel, Director of Customer and Store Operations.',
      objective: 'Arrive at the 11:00 review with a clear recommendation, one meaningful risk, and discussion-ready questions.'
    },
    meetingTimeLabel: '11:00–11:30 a.m. • Harbor Room • hard stop at 11:00',
    emails: [
      {
        id: 1,
        timestamp: '8:08 AM',
        from: 'Maya Patel',
        subject: 'Please come to the 11:00 review with a recommendation',
        body: [
          paragraph(
            "I don't want this to be a recap-only meeting. Please come with a ",
            strong('clear recommendation'),
            ' on whether Welcome Back Weekend should be expanded.'
          ),
          paragraph(
            'At a minimum, I want ',
            strong('one meaningful risk'),
            ' called out and ',
            strong('one discussion question'),
            ' for the group.'
          )
        ]
      },
      {
        id: 2,
        timestamp: '8:19 AM',
        from: 'Calendar Bot',
        subject: 'Room change: Welcome Back Weekend pilot review',
        body: [
          paragraph(
            'The ',
            strong('11:00 a.m.'),
            ' Welcome Back Weekend Pilot Review has been moved from ',
            strong('Cedar Room'),
            ' to ',
            strong('Harbor Room'),
            '. The video link is unchanged.'
          )
        ]
      },
      {
        id: 3,
        timestamp: '8:31 AM',
        from: 'Leo Chen',
        subject: "Let's not imply small-format stores are ready too",
        body: [
          paragraph(
            'Quick flag before the meeting: this pilot only ran in our ',
            strong('standard-format stores'),
            '.'
          ),
          paragraph(
            strong('Small-format stores'),
            ' do not have the same front-entry display space, and the right signage version is ',
            strong('still not ready'),
            '. Please do not position this as something every store can pick up immediately.'
          )
        ]
      },
      {
        id: 4,
        timestamp: '8:44 AM',
        from: 'Elena Ruiz',
        subject: 'Most of the complaints are about the expiration date',
        body: [
          paragraph(
            'Overall feedback has not been bad, but the customer complaints we saw this week were mostly about ',
            strong('the coupon expiration date not being clear enough'),
            '.'
          ),
          paragraph('People are not pushing back on the promotion itself. They mostly seem frustrated that the rules were harder to understand than they should have been.')
        ]
      },
      { id: 5, timestamp: '8:57 AM', from: 'Facilities', subject: 'Second-floor locker area maintenance', body: [paragraphText('The employee locker area on the second floor will be closed for maintenance from 2:00 to 4:00 p.m. today.')] },
      {
        id: 6,
        timestamp: '9:06 AM',
        from: 'Owen Brooks',
        subject: 'Should I model this with the $5 offer or the $8 option?',
        body: [
          paragraph('I am pulling together the cost view for the meeting.'),
          paragraph(
            'Should I assume we are still talking about the current ',
            strong('$5 coupon'),
            ', or do you expect Maya to ask about a ',
            strong('higher-value $8 option'),
            '? Just want to keep my numbers aligned with the rest of the discussion.'
          )
        ],
        requiredReply: true
      },
      {
        id: 7,
        timestamp: '9:17 AM',
        from: 'Priya Singh',
        subject: 'One positive point you may want to use',
        body: [
          paragraph(
            'One thing worth calling out: the ',
            strong('Thursday text + Friday email sequence'),
            ' performed better than email alone.'
          ),
          paragraph('That pattern was especially consistent with members who had previously shopped more than once before going inactive.')
        ]
      },
      {
        id: 8,
        timestamp: '9:29 AM',
        from: 'Marcos Diaz',
        subject: 'Checkout lines were a little slower in a few pilot stores',
        body: [
          paragraph(
            'Three of the busier pilot stores mentioned that ',
            strong('checkout moved a bit more slowly'),
            ' on Saturday afternoons when cashiers were giving the reminder at the register.'
          ),
          paragraph('It was not a major issue, but I do think it is worth acknowledging as part of the tradeoff.')
        ]
      },
      { id: 9, timestamp: '9:41 AM', from: 'HR Team', subject: 'Reminder: employee photo session this Friday', body: [paragraphText('Optional employee badge photos will be taken Friday morning in Conference Room B.')] },
      { id: 10, timestamp: '9:52 AM', from: 'Nina Romero', subject: 'Customer quote you can use if helpful', body: [paragraphText('“The reminder made me realize we were low on household basics, so I ended up stopping by over the weekend.” Feel free to use that in your brief if you want a concrete customer voice.')] },
      {
        id: 11,
        timestamp: '10:01 AM',
        from: 'Print Vendor',
        subject: 'Small-format store signage would not be ready before June',
        body: [
          paragraph(
            'If the team decides to extend the program to small-format stores later, the resized entry signage would not be available until ',
            strong('the first week of June'),
            '.'
          )
        ]
      },
      { id: 12, timestamp: '10:09 AM', from: 'IT Service Desk', subject: 'Please restart your laptop tonight', body: [paragraphText('Security updates finished deploying this morning. Please restart your laptop before you leave for the day.')] },
      { id: 13, timestamp: '10:16 AM', from: 'Social Committee', subject: 'Snack survey for next week', body: [paragraphText('Please submit your snack preferences by Thursday afternoon.')] },
      {
        id: 14,
        timestamp: '10:24 AM',
        from: 'Maya Patel',
        subject: 'Send me draft bullets by 10:55 if you have them',
        body: [
          paragraph(
            'If you get to a clean set of ',
            strong('draft bullets'),
            ' before the meeting, send them my way by ',
            strong('10:55'),
            '.'
          ),
          paragraph('If not, just bring the final brief and we will work from that.')
        ],
        requiredReply: true
      }
    ],
    files: [
      {
        id: 'analysis-summary',
        label: 'Analysis Summary',
        body: [
          note('Decision snapshot', 'Pilot results look positive overall, but expansion still carries execution and clarity tradeoffs that should be made explicit in the room.'),
          table(
            ['Metric', 'Pilot vs control', 'Interpretation'],
            [
              ['Return rate', '19.4% vs 11.8%', 'Meaningfully stronger return behavior'],
              ['Coupon redemption', '12.6% vs 7.1%', 'Offer was used more often in pilot stores'],
              ['Basket size', '$34.20 vs $31.10', 'Slightly higher spend per visit'],
              ['Complaints', '3.8 per 1,000 vs 1.9', 'Complaints increased and need explanation'],
              ['Extra execution time', '16 min vs 7 min', 'Store execution cost is materially higher'],
              ['Satisfaction', '4.2 vs 3.8', 'Customer satisfaction still improved overall']
            ]
          ),
          bullets(
            [strong('Trend notes: '), 'Text + email outperformed email alone.'],
            [strong('Trend notes: '), 'Busy stores saw more line-slowdown at checkout.'],
            [strong('Trend notes: '), 'Complaints focused on expiration-date clarity, not the promotion itself.']
          ),
          bullets(
            [strong('Constraint: '), 'Small-format signage is not ready until June.'],
            [strong('Constraint: '), 'High-volume stores may see line pressure if reminder delivery stays manual.'],
            [strong('Constraint: '), 'Current finance estimate assumes the $5 coupon rather than a higher-value option.']
          )
        ]
      },
      {
        id: 'analysis-risks',
        label: 'Known Risks & Constraints',
        body: [
          note('Use at least one of these in the meeting brief', 'These are the main downside points leadership will expect you to acknowledge.'),
          bullets(
            [strong('Rule clarity risk: '), 'Expiration language is still unclear enough to trigger customer complaints.'],
            [strong('Rollout scope risk: '), 'Small-format stores are not operationally ready before June.'],
            [strong('Execution risk: '), 'Busy stores may see checkout slowdown when the reminder is delivered at the register.'],
            [strong('Financial alignment risk: '), 'Cost assumptions change if the team discusses a value above the current $5 coupon.']
          )
        ]
      },
      {
        id: 'meeting-time',
        label: 'Meeting Time Reference',
        body: [
          note('Meeting logistics', 'Welcome Back Weekend Pilot Review'),
          bullets(
            [strong('Time: '), '11:00–11:30 a.m.'],
            [strong('Location: '), 'Harbor Room'],
            [strong('Hard stop for drafting: '), '11:00 a.m.'],
            [strong('Optional pre-read send: '), 'Send Maya draft bullets by 10:55 if ready.']
          )
        ]
      },
      {
        id: 'urgent-card',
        label: 'Urgent Task Card',
        body: [
          note('Availability', 'This file becomes active only when the urgent task is triggered during analysis.')
        ]
      }
    ],
    urgentTasks: {
      A: {
        title: 'Type A — Escalated Customer Complaint',
        prompt:
          'A customer, Lisa Morgan, says she showed the campaign email at the store over the weekend, but the associate told her the offer had already expired. She believes the expiration date was not clearly stated and wants a prompt explanation and resolution.',
        deliverableHint: 'Draft a short customer reply and a three-step internal action plan for the next 24 hours.'
      },
      B: {
        title: 'Type B — Last-Minute Meeting Add-On',
        prompt:
          'Maya sends: “I need a very short options note for the room. Please compare three rollout paths so we can align quickly.” Compare: all standard-format stores in May; a subset of standard-format stores while revising language; or waiting until after June to align rule language and small-format signage.',
        deliverableHint: 'Write a short decision-options note plus three option bullets with a likely benefit and risk.'
      }
    },
    analysisPromptHints: [
      'Ground the recommendation in the packet only.',
      'Acknowledge expiration-rule clarity and store-execution tradeoffs.',
      'Bring at least one substantive risk into the brief.'
    ]
  },
  B: {
    id: 'B',
    title: 'Task Set B — Come Back Soon',
    shortTitle: 'Come Back Soon',
    background: {
      company: 'Harbor Lane Retail is again the fictional retailer in this scenario.',
      scenario:
        'The pilot under review is Come Back Soon, aimed at encouraging a second visit within 30 days of a member’s first purchase. Leadership must decide whether to expand next month and under what conditions.',
      role: 'You are the Program Associate supporting Maya Patel.',
      objective: 'Clear the inbox, prepare decision materials, and walk Maya into the 11:00 review with a clear position.'
    },
    meetingTimeLabel: '11:00–11:30 a.m. • Harbor Room • hard stop at 11:00',
    emails: [
      {
        id: 1,
        timestamp: '8:07 AM',
        from: 'Maya Patel',
        subject: 'Please bring a recommendation to the 11:00 review',
        body: [
          paragraph(
            'I need a ',
            strong('clear recommendation'),
            ' at the meeting: is Come Back Soon ready to expand, or not?'
          ),
          paragraph(
            'Please include at least ',
            strong('one real risk'),
            ' and ',
            strong('one discussion question'),
            ' for the group.'
          )
        ]
      },
      {
        id: 2,
        timestamp: '8:18 AM',
        from: 'Calendar Bot',
        subject: 'Room change: new-member second-visit pilot review',
        body: [
          paragraph(
            'The ',
            strong('11:00 a.m.'),
            ' Come Back Soon Pilot Review has been moved from ',
            strong('Cedar Room'),
            ' to ',
            strong('Harbor Room'),
            '. The video link is unchanged.'
          )
        ]
      },
      {
        id: 3,
        timestamp: '8:30 AM',
        from: 'Leo Chen',
        subject: "Let's keep franchise stores out of the first rollout wave",
        body: [
          paragraph(
            'Quick note before the review: ',
            strong('franchise stores'),
            ' have not finished the cashier talking-point training yet.'
          ),
          paragraph('Even if we decide to expand, I would not position franchise stores as part of the first wave.')
        ]
      },
      {
        id: 4,
        timestamp: '8:43 AM',
        from: 'Elena Ruiz',
        subject: 'Top customer question: can they redeem in a different store?',
        body: [
          paragraph(
            'The overall reaction has been fine, but the most common question by far has been whether the offer has to be used in ',
            strong('the same store as the first purchase'),
            '.'
          ),
          paragraph('That point needs to be much clearer if we scale this up.')
        ]
      },
      { id: 5, timestamp: '8:55 AM', from: 'Facilities', subject: 'Front desk visitor station closed this afternoon', body: [paragraphText('The front desk visitor station will be closed from 3:00 to 4:00 p.m. today for maintenance.')] },
      {
        id: 6,
        timestamp: '9:04 AM',
        from: 'Owen Brooks',
        subject: 'Do you want me to include printing and training costs too?',
        body: [
          paragraph('For the meeting, should I stick to the $3 welcome offer itself, or do you expect us to talk about the full cost picture?'),
          paragraph(
            'Specifically, should I include ',
            strong('printed reminder cards'),
            ' and ',
            strong('training time'),
            ' as part of the discussion?'
          )
        ],
        requiredReply: true
      },
      {
        id: 7,
        timestamp: '9:16 AM',
        from: 'Training Team',
        subject: 'We can hold two training slots if you want them',
        body: [
          paragraph(
            'If the team decides to move forward next month, I can reserve ',
            strong('two 30-minute virtual training sessions'),
            ' now.'
          ),
          paragraph('If you want me to hold them, let me know before noon.')
        ]
      },
      {
        id: 8,
        timestamp: '9:28 AM',
        from: 'Amira Khan',
        subject: 'One thing that really helped in our store',
        body: [
          paragraph(
            'At our location, the message landed much better when cashiers explicitly said, ',
            strong('“You can use this if you come back within 30 days.”'),
            ''
          ),
          paragraph('Customers seemed to understand the offer much more clearly when they heard that out loud.')
        ]
      },
      { id: 9, timestamp: '9:39 AM', from: 'HR Team', subject: 'Employee appreciation signup reminder', body: [paragraphText('The signup form closes Friday.')] },
      { id: 10, timestamp: '9:51 AM', from: 'Nina Romero', subject: 'A customer line you can use in the brief', body: [paragraphText('“The thank-you message made the store feel more personal, so coming back a second time felt easy rather than like a chore.” Use it if you want a short customer quote.')] },
      {
        id: 11,
        timestamp: '10:00 AM',
        from: 'Procurement',
        subject: 'Lead time on reminder cards is about three weeks',
        body: [
          paragraph(
            'If this expands to more stores, we should order the bag-insert reminder cards quickly. Current lead time is about ',
            strong('three weeks'),
            '.'
          )
        ]
      },
      { id: 12, timestamp: '10:08 AM', from: 'IT Service Desk', subject: 'Please restart your laptop tonight', body: [paragraphText('Please restart your laptop before leaving today so the latest security patch can finish installing.')] },
      { id: 13, timestamp: '10:16 AM', from: 'People Ops', subject: "Next month's snack vote", body: [paragraphText('Please complete the form by Thursday.')] },
      {
        id: 14,
        timestamp: '10:24 AM',
        from: 'Maya Patel',
        subject: 'Send me draft bullets by 10:55 if you get there',
        body: [
          paragraph(
            'If you have a clean draft before the meeting, send it over by ',
            strong('10:55'),
            '.'
          ),
          paragraph('Otherwise, just bring the final version into the room.')
        ],
        requiredReply: true
      }
    ],
    files: [
      {
        id: 'analysis-summary',
        label: 'Analysis Summary',
        body: [
          note('Decision snapshot', 'The pilot appears effective, but recommendation quality depends on whether leadership is comfortable expanding before training, reminder-card supply, and rule clarity are fully tightened.'),
          table(
            ['Metric', 'Pilot vs control', 'Interpretation'],
            [
              ['Second-visit rate', '36.2% vs 24.9%', 'Strong lift in repeat visits'],
              ['Offer redemption', '14.1% vs 8.9%', 'Offer engagement improved'],
              ['Second-visit basket size', '$28.70 vs $27.10', 'Spend improved modestly'],
              ['Customer questions', '2.9 per 1,000 vs 1.6', 'More customer confusion to manage'],
              ['Extra execution time', '13 min vs 8 min', 'Operational burden increased'],
              ['Satisfaction', '4.3 vs 3.9', 'Customer sentiment improved overall']
            ]
          ),
          bullets(
            [strong('Trend notes: '), 'Stores performed best when cashiers clearly explained the 30-day return window.'],
            [strong('Trend notes: '), 'Customers mainly wanted clarity on whether they could redeem in another store.'],
            [strong('Trend notes: '), 'Printed reminder cards would take about three weeks to replenish.']
          ),
          bullets(
            [strong('Constraint: '), 'Franchise stores have not completed talking-point training.'],
            [strong('Constraint: '), 'Rule language still leaves room for customer confusion.'],
            [strong('Constraint: '), 'Execution quality may vary if rollout expands before training is in place.']
          )
        ]
      },
      {
        id: 'analysis-risks',
        label: 'Known Risks & Constraints',
        body: [
          note('Use at least one of these in the meeting brief', 'These are the main downsides leadership will expect you to acknowledge if you recommend expansion.'),
          bullets(
            [strong('Readiness risk: '), 'Franchise stores have not completed cashier talking-point training.'],
            [strong('Supply risk: '), 'Printed reminder cards take roughly three weeks to replenish.'],
            [strong('Clarity risk: '), 'Rule language still leaves room for confusion about redemption conditions.'],
            [strong('Execution risk: '), 'Larger rollout quality may slip if training and materials are not in place first.']
          )
        ]
      },
      {
        id: 'meeting-time',
        label: 'Meeting Time Reference',
        body: [
          note('Meeting logistics', 'Come Back Soon Pilot Review'),
          bullets(
            [strong('Time: '), '11:00–11:30 a.m.'],
            [strong('Location: '), 'Harbor Room'],
            [strong('Hard stop for drafting: '), '11:00 a.m.'],
            [strong('Optional pre-read send: '), 'Send Maya draft bullets by 10:55 if ready.']
          )
        ]
      },
      {
        id: 'urgent-card',
        label: 'Urgent Task Card',
        body: [
          note('Availability', 'This file becomes active only when the urgent task is triggered during analysis.')
        ]
      }
    ],
    urgentTasks: {
      A: {
        title: 'Type A — Escalated Customer Complaint',
        prompt:
          'Customer Service forwards an urgent note. Daniel Park says he received the Come Back Soon email after his first purchase, but when he tried to use the offer in a different store today, he was told it did not apply. He believes the rules were not stated clearly and wants an explanation.',
        deliverableHint: 'Draft a short customer reply and a three-step internal action plan for the next 24 hours.'
      },
      B: {
        title: 'Type B — Last-Minute Meeting Add-On',
        prompt:
          'Maya sends: “Please add a short rollout guardrails note. If we expand next month, I want to be very clear on what has to be true first.”',
        deliverableHint: 'Write a short rollout-guardrails note plus three guardrails or prerequisites with brief reasons.'
      }
    },
    analysisPromptHints: [
      'Keep the recommendation tied to second-visit behavior within 30 days.',
      'Acknowledge franchise-readiness, training, and rule-clarity constraints.',
      'Use concrete numbers instead of only narrative summaries.'
    ]
  }
};
