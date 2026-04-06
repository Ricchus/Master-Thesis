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
          This study is a time-limited office workflow simulation. You will complete two rounds using two different
          assistant interfaces.
        </p>

        <div className="introIdPanel">
          <div>
            <span className="label">Participant ID</span>
            <strong>{participantId}</strong>
          </div>
          <button type="button" onClick={onCopy}>
            {copyState === 'copied' ? 'Copied' : 'Copy ID'}
          </button>
        </div>

        <ul className="introChecklist">
          <li>Your participant ID stays the same for both rounds and for every external survey.</li>
          <li>You will have 15 minutes to complete the work before the meeting starts.</li>
          <li>External EMA surveys will open during the workflow, and you should return here after each one.</li>
          <li>An urgent task may appear while you are working on the analysis brief.</li>
          <li>When the meeting starts, editing locks immediately.</li>
          <li>Use only the materials provided inside the interface to complete the task.</li>
        </ul>

        <div className="screenActions">
          <button type="button" className="primary" onClick={onContinue}>
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
