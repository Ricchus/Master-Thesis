type Props = {
  participantId: string;
  copyState: 'idle' | 'copied';
  onCopy: () => Promise<void>;
  onContinue: () => void;
};

export function IntroScreen({ participantId, copyState, onCopy, onContinue }: Props) {
  return (
    <div className="screenShell">
      <section className="introCard">
        <div className="screenEyebrow">Office Workflow Simulation</div>
        <h1>Welcome</h1>
        <p>
          In this study, you will work through a fictional office scenario at Harbor Lane Retail. Your job is to help
          prepare for an 11:00 review by working with emails, files, and time-limited writing tasks.
        </p>

        <section className="introSection">
          <h2 className="introSectionTitle">What you will do</h2>
          <ul className="introChecklist">
            <li>Read packet materials in the Inbox and Files panels.</li>
            <li>Draft required email replies.</li>
            <li>List the most important pre-meeting tasks.</li>
            <li>Complete a short analysis brief.</li>
            <li>Stay ready for possible changes or additional work during the workflow.</li>
          </ul>
        </section>

        <section className="introSection">
          <h2 className="introSectionTitle">How the interface works</h2>
          <ul className="introChecklist">
            <li>Use the left side to review emails and files.</li>
            <li>Use the upper-right workspace to complete the current task.</li>
            <li>Use the lower-right assistant for grounded support while you work.</li>
          </ul>
        </section>

        <div className="introIdPanel">
          <div>
            <span className="label">Participant ID</span>
            <strong>{participantId}</strong>
            <p className="introIdHelp">Your participant ID stays the same for both rounds and for every external survey.</p>
          </div>
          <button type="button" onClick={onCopy}>
            {copyState === 'copied' ? 'Copied' : 'Copy ID'}
          </button>
        </div>

        <section className="introSection">
          <h2 className="introSectionTitle">Key rules</h2>
          <ul className="introChecklist">
            <li>You will complete two rounds using two different assistant interfaces.</li>
            <li>Each round is time-limited and ends when the meeting starts.</li>
            <li>External EMA surveys will open during the workflow. Return here after each one.</li>
            <li>Use only the information provided inside the interface.</li>
            <li>The workflow may change while you are working, so keep track of the current task and instructions.</li>
          </ul>
        </section>

        <div className="screenActions">
          <button type="button" className="primary" onClick={onContinue}>
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
