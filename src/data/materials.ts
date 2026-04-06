import type { TaskSet } from '../lib/types';

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
      { id: 1, timestamp: '8:08 AM', from: 'Maya Patel', subject: 'Please come to the 11:00 review with a recommendation', body: "I don't want this to be a recap-only meeting. Please come with a clear recommendation on whether Welcome Back Weekend should be expanded. At a minimum, I want one meaningful risk called out and one discussion question for the group." },
      { id: 2, timestamp: '8:19 AM', from: 'Calendar Bot', subject: 'Room change: Welcome Back Weekend pilot review', body: 'The 11:00 a.m. Welcome Back Weekend Pilot Review has been moved from Cedar Room to Harbor Room. The video link is unchanged.' },
      { id: 3, timestamp: '8:31 AM', from: 'Leo Chen', subject: "Let's not imply small-format stores are ready too", body: 'Quick flag before the meeting: this pilot only ran in our standard-format stores. Small-format stores do not have the same front-entry display space, and the right signage version is still not ready. Please do not position this as something every store can pick up immediately.' },
      { id: 4, timestamp: '8:44 AM', from: 'Elena Ruiz', subject: 'Most of the complaints are about the expiration date', body: 'Overall feedback has not been bad, but the customer complaints we saw this week were mostly about one thing: the coupon expiration date was not clear enough. People are not pushing back on the promotion itself. They mostly seem frustrated that the rules were harder to understand than they should have been.' },
      { id: 5, timestamp: '8:57 AM', from: 'Facilities', subject: 'Second-floor locker area maintenance', body: 'The employee locker area on the second floor will be closed for maintenance from 2:00 to 4:00 p.m. today.' },
      { id: 6, timestamp: '9:06 AM', from: 'Owen Brooks', subject: 'Should I model this with the $5 offer or the $8 option?', body: 'I am pulling together the cost view for the meeting. Should I assume we are still talking about the current $5 coupon, or do you expect Maya to ask about a higher-value version? Just want to keep my numbers aligned with the rest of the discussion.', requiredReply: true },
      { id: 7, timestamp: '9:17 AM', from: 'Priya Singh', subject: 'One positive point you may want to use', body: 'One thing worth calling out: the Thursday text + Friday email sequence performed better than email alone. That pattern was especially consistent with members who had previously shopped more than once before going inactive.' },
      { id: 8, timestamp: '9:29 AM', from: 'Marcos Diaz', subject: 'Checkout lines were a little slower in a few pilot stores', body: 'Three of the busier pilot stores mentioned that checkout moved a bit more slowly on Saturday afternoons when cashiers were giving the reminder at the register. It was not a major issue, but I do think it is worth acknowledging as part of the tradeoff.' },
      { id: 9, timestamp: '9:41 AM', from: 'HR Team', subject: 'Reminder: employee photo session this Friday', body: 'Optional employee badge photos will be taken Friday morning in Conference Room B.' },
      { id: 10, timestamp: '9:52 AM', from: 'Nina Romero', subject: 'Customer quote you can use if helpful', body: '“The reminder made me realize we were low on household basics, so I ended up stopping by over the weekend.” Feel free to use that in your brief if you want a concrete customer voice.' },
      { id: 11, timestamp: '10:01 AM', from: 'Print Vendor', subject: 'Small-format store signage would not be ready before June', body: 'If the team decides to extend the program to small-format stores later, the resized entry signage would not be available until the first week of June.' },
      { id: 12, timestamp: '10:09 AM', from: 'IT Service Desk', subject: 'Please restart your laptop tonight', body: 'Security updates finished deploying this morning. Please restart your laptop before you leave for the day.' },
      { id: 13, timestamp: '10:16 AM', from: 'Social Committee', subject: 'Snack survey for next week', body: 'Please submit your snack preferences by Thursday afternoon.' },
      { id: 14, timestamp: '10:24 AM', from: 'Maya Patel', subject: 'Send me draft bullets by 10:55 if you have them', body: 'If you get to a clean set of bullets before the meeting, send them my way by 10:55. If not, just bring the final brief and we will work from that.', requiredReply: true }
    ],
    files: [
      {
        id: 'analysis-summary',
        label: 'Analysis Summary',
        body:
          'Key metrics: return rate 19.4% vs 11.8% control; coupon redemption 12.6% vs 7.1%; basket size $34.20 vs $31.10; complaints 3.8 per 1,000 vs 1.9; extra execution time 16 min vs 7 min; satisfaction 4.2 vs 3.8. Trend notes: text + email outperformed email alone; busy stores saw more line-slowdown; complaints focused on expiration clarity. Known constraints: small-format signage not ready until June, high-volume stores may face line pressure, and the current finance estimate assumes the $5 coupon.'
      },
      {
        id: 'analysis-risks',
        label: 'Known Risks & Constraints',
        body:
          'Risks to consider: unclear expiration language, small-format signage not ready before June, line-speed pressure in high-volume stores, and cost assumptions based on the current $5 coupon instead of a higher-value offer.'
      },
      {
        id: 'meeting-time',
        label: 'Meeting Time Reference',
        body: 'Meeting: Welcome Back Weekend Pilot Review. Time: 11:00–11:30 a.m. Location: Harbor Room. Hard stop for drafting at 11:00 a.m.'
      },
      {
        id: 'urgent-card',
        label: 'Urgent Task Card',
        body: 'This file becomes active only when the urgent task is triggered during analysis.'
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
      { id: 1, timestamp: '8:07 AM', from: 'Maya Patel', subject: 'Please bring a recommendation to the 11:00 review', body: 'I need a clear recommendation at the meeting: is Come Back Soon ready to expand, or not? Please include at least one real risk and one discussion question for the group.' },
      { id: 2, timestamp: '8:18 AM', from: 'Calendar Bot', subject: 'Room change: new-member second-visit pilot review', body: 'The 11:00 a.m. Come Back Soon Pilot Review has been moved from Cedar Room to Harbor Room. The video link is unchanged.' },
      { id: 3, timestamp: '8:30 AM', from: 'Leo Chen', subject: "Let's keep franchise stores out of the first rollout wave", body: 'Quick note before the review: franchise stores have not finished the cashier talking-point training yet. Even if we decide to expand, I would not position franchise stores as part of the first wave.' },
      { id: 4, timestamp: '8:43 AM', from: 'Elena Ruiz', subject: 'Top customer question: can they redeem in a different store?', body: 'The overall reaction has been fine, but the most common question by far has been whether the offer has to be used in the same store as the first purchase. That point needs to be much clearer if we scale this up.' },
      { id: 5, timestamp: '8:55 AM', from: 'Facilities', subject: 'Front desk visitor station closed this afternoon', body: 'The front desk visitor station will be closed from 3:00 to 4:00 p.m. today for maintenance.' },
      { id: 6, timestamp: '9:04 AM', from: 'Owen Brooks', subject: 'Do you want me to include printing and training costs too?', body: 'For the meeting, should I stick to the $3 welcome offer itself, or do you expect us to talk about the full cost picture, including printed reminder cards and training time?', requiredReply: true },
      { id: 7, timestamp: '9:16 AM', from: 'Training Team', subject: 'We can hold two training slots if you want them', body: 'If the team decides to move forward next month, I can reserve two 30-minute virtual training sessions now. If you want me to hold them, let me know before noon.' },
      { id: 8, timestamp: '9:28 AM', from: 'Amira Khan', subject: 'One thing that really helped in our store', body: 'At our location, the message landed much better when cashiers explicitly said, “You can use this if you come back within 30 days.” Customers seemed to understand the offer much more clearly when they heard that out loud.' },
      { id: 9, timestamp: '9:39 AM', from: 'HR Team', subject: 'Employee appreciation signup reminder', body: 'The signup form closes Friday.' },
      { id: 10, timestamp: '9:51 AM', from: 'Nina Romero', subject: 'A customer line you can use in the brief', body: '“The thank-you message made the store feel more personal, so coming back a second time felt easy rather than like a chore.” Use it if you want a short customer quote.' },
      { id: 11, timestamp: '10:00 AM', from: 'Procurement', subject: 'Lead time on reminder cards is about three weeks', body: 'If this expands to more stores, we should order the bag-insert reminder cards quickly. Current lead time is about three weeks.' },
      { id: 12, timestamp: '10:08 AM', from: 'IT Service Desk', subject: 'Please restart your laptop tonight', body: 'Please restart your laptop before leaving today so the latest security patch can finish installing.' },
      { id: 13, timestamp: '10:16 AM', from: 'People Ops', subject: "Next month's snack vote", body: 'Please complete the form by Thursday.' },
      { id: 14, timestamp: '10:24 AM', from: 'Maya Patel', subject: 'Send me draft bullets by 10:55 if you get there', body: 'If you have a clean draft before the meeting, send it over by 10:55. Otherwise, just bring the final version into the room.', requiredReply: true }
    ],
    files: [
      {
        id: 'analysis-summary',
        label: 'Analysis Summary',
        body:
          'Key metrics: second-visit rate 36.2% vs 24.9% control; offer redemption 14.1% vs 8.9%; second-visit basket size $28.70 vs $27.10; customer questions 2.9 per 1,000 vs 1.6; extra execution time 13 min vs 8 min; satisfaction 4.3 vs 3.9. Trend notes: strongest gains came where cashiers clearly explained the 30-day return window; customers wanted clarity on whether they could redeem in another store; printed reminder cards take about three weeks to replenish.'
      },
      {
        id: 'analysis-risks',
        label: 'Known Risks & Constraints',
        body:
          'Risks to consider: franchise stores have not completed cashier talking-point training, printed reminder cards take roughly three weeks to replenish, rule language still leaves room for confusion, and execution quality may vary more in a larger rollout if training is not in place first.'
      },
      {
        id: 'meeting-time',
        label: 'Meeting Time Reference',
        body: 'Meeting: Come Back Soon Pilot Review. Time: 11:00–11:30 a.m. Location: Harbor Room. Hard stop for drafting at 11:00 a.m.'
      },
      {
        id: 'urgent-card',
        label: 'Urgent Task Card',
        body: 'This file becomes active only when the urgent task is triggered during analysis.'
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
