import { CONSENT_CONTENT, CONSENT_FORM_TITLE, CONSENT_STUDY_TITLE } from '../lib/consent';
import { MaterialContent } from './materials/MaterialContent';

type Props = {
  onAgree: () => void;
};

export function ConsentScreen({ onAgree }: Props) {
  return (
    <div className="screenShell">
      <section className="introCard consentCard">
        <div className="screenEyebrow">Office Workflow Simulation</div>
        <h1>{CONSENT_FORM_TITLE}</h1>
        <p>{CONSENT_STUDY_TITLE}</p>

        <div className="consentBody">
          <MaterialContent content={CONSENT_CONTENT} />
        </div>

        <p className="consentFooterNote">
          If you do not wish to participate, do not continue and notify the researcher.
        </p>

        <div className="screenActions">
          <button type="button" className="primary" onClick={onAgree}>
            Agree
          </button>
        </div>
      </section>
    </div>
  );
}
