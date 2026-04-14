import type { MaterialBlock } from './types';

export const CONSENT_FORM_TITLE = 'Consent Form';
export const CONSENT_STUDY_TITLE = 'Simulated Office Workflow Study (ChatGPT-style vs. Avatar Assistant)';

export const CONSENT_CONTENT: MaterialBlock[] = [
  {
    type: 'paragraph',
    content: [
      { type: 'strong', text: 'Modality: ' },
      { type: 'text', text: 'Remote (Prolific; on-screen e-consent)' },
    ],
  },
  {
    type: 'paragraph',
    content: [
      { type: 'strong', text: 'Principal Investigator: ' },
      { type: 'text', text: 'Noah Posner (noah.posner@design.gatech.edu)' },
    ],
  },
  {
    type: 'paragraph',
    content: [
      { type: 'strong', text: 'Student Researcher / Contact: ' },
      { type: 'text', text: 'Lyujiang Chen (LCHEN764@gatech.edu; 404-433-3099)' },
    ],
  },
  {
    type: 'paragraph',
    content: [
      { type: 'strong', text: 'Study Location: ' },
      { type: 'text', text: 'Online/remote via Prolific on your own desktop or laptop computer' },
    ],
  },
  {
    type: 'paragraph',
    content: [
      { type: 'strong', text: 'Estimated Duration: ' },
      { type: 'text', text: 'Approximately 45 minutes' },
    ],
  },
  {
    type: 'paragraph',
    content: [
      { type: 'strong', text: 'Compensation: ' },
      { type: 'text', text: 'Compensation is provided through Prolific as stated in the Prolific study listing.' },
    ],
  },
  {
    type: 'paragraph',
    content: [
      { type: 'strong', text: 'Data Collected: ' },
      { type: 'text', text: 'Qualtrics EMA responses only (plus non-identifying embedded fields).' },
    ],
  },
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'You are being asked to be a volunteer in a research study. The purpose of this study is to compare two assistant interface conditions, a ChatGPT-style text assistant interface and an Avatar-style assistant interface, in a time-limited simulation of common office work, and to understand how the interface condition relates to momentary stress.',
      },
    ],
  },
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'If you agree to participate, you will use a web-based program with a fictional retail-company scenario. You will complete two rounds of a time-limited office workflow, such as reading fictional emails and documents and completing writing and planning activities, under a fixed deadline and with an urgent interruption. Momentary stress will be measured using Ecological Momentary Assessment (EMA) surveys delivered in Qualtrics at four timepoints per round. EMA is a short, self-administered on-screen questionnaire.',
      },
    ],
  },
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'Data collection: The research team collects only EMA survey responses via Qualtrics, along with non-identifying embedded fields needed to interpret the EMA responses, such as coded participant ID, interface condition, round, and EMA timepoint. The web-based task program does not transmit or store your task text entries in a research database; task text remains within your browser session. The program may store progress locally in your browser to support refresh recovery.',
      },
    ],
  },
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'Your responses will be kept confidential to the extent permitted by law. You will be assigned a coded study ID. For Prolific participation, your Prolific ID is used only for compensation and is stored separately from the Qualtrics EMA dataset. Study data, meaning Qualtrics EMA responses, will be stored on secure, access-controlled Georgia Tech systems and accessed only by the approved study team. Where feasible, IP address recording in Qualtrics will be disabled; if any platform logs IP addresses by default, IP addresses will not be exported to the research dataset or used for analysis.',
      },
    ],
  },
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'For remote participation, we recommend completing the study on a private device and closing the browser after finishing.',
      },
    ],
  },
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'The risks involved are no greater than those involved in daily activities. Potential discomfort may include brief stress or frustration due to time pressure. You may stop participation at any time without penalty.',
      },
    ],
  },
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'We will comply with any applicable laws and regulations regarding confidentiality. To make sure that this research is being carried out in the proper way, the Georgia Institute of Technology IRB may review study records. The Office of Human Research Protections may also look at study records.',
      },
    ],
  },
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'If you have any questions about the study, you may contact Lyujiang Chen at telephone 404-433-3099 or email LCHEN764@gatech.edu, or Noah Posner at noah.posner@design.gatech.edu. If you have any questions about your rights as a research subject, you may contact the Georgia Institute of Technology Office of Research Integrity Assurance at IRB@gatech.edu.',
      },
    ],
  },
  {
    type: 'paragraph',
    content: [{ type: 'text', text: 'Thank you for participating in this study.' }],
  },
  {
    type: 'note',
    title: 'Participant Consent',
    content: [
      {
        type: 'text',
        text: 'To participate remotely, please indicate your consent electronically by selecting “Agree” on this page. If you do not agree, close the browser window and do not continue.',
      },
    ],
  },
];
