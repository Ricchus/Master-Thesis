import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type GuideTargetId =
  | 'participant-id'
  | 'background-dropdown'
  | 'meeting-countdown'
  | 'timeline'
  | 'materials-nav'
  | 'materials-reader'
  | 'workspace-panel'
  | 'assistant-panel'
  | 'continue-button';

export type GuideStep = {
  title: string;
  description: string;
  target: GuideTargetId;
  placement?: 'top' | 'right' | 'bottom' | 'left';
};

export const GUIDE_STEPS: GuideStep[] = [
  {
    target: 'participant-id',
    placement: 'bottom',
    title: 'Keep this ID for the full study',
    description: 'Your participant ID stays the same across both rounds. Copy and paste it into every external survey.'
  },
  {
    target: 'background-dropdown',
    placement: 'bottom',
    title: 'Open Background for scenario context',
    description: 'Use this menu to review the company, role, and objective. Keep your work grounded in these materials only.'
  },
  {
    target: 'meeting-countdown',
    placement: 'left',
    title: 'Watch the meeting countdown',
    description: 'This timer shows how much drafting time remains. When it reaches zero, editing is locked.'
  },
  {
    target: 'timeline',
    placement: 'bottom',
    title: 'Follow the workflow timeline',
    description: 'This bar shows where you are in the process. It updates as you move through surveys, drafting stages, and the meeting cutoff.'
  },
  {
    target: 'materials-nav',
    placement: 'right',
    title: 'Use the materials controls on the left',
    description: 'Switch between Inbox and Files here. Meeting Time, analysis documents, and the Urgent Task card are all part of this materials area.'
  },
  {
    target: 'materials-reader',
    placement: 'right',
    title: 'Read packet content in the viewer',
    description: 'Selected emails and files open in this reader. Review the packet here before you draft anything.'
  },
  {
    target: 'workspace-panel',
    placement: 'left',
    title: 'Complete the active deliverable here',
    description: 'The upper-right workspace changes with the current stage. You will draft replies, task breakdowns, analysis, and urgent-task outputs in this area.'
  },
  {
    target: 'assistant-panel',
    placement: 'left',
    title: 'Use the assistant as support',
    description: 'The lower-right assistant can help summarize the packet and suggest grounded wording. It should support your work, not replace the packet itself.'
  },
  {
    target: 'continue-button',
    placement: 'bottom',
    title: 'Advance with the section action button',
    description: 'Use the stage action button to validate or continue when your work is ready. If a submission is too thin or off-task, the app will ask you to revise.'
  }
];

type Props = {
  stepIndex: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
};

type Box = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTargetBox(step: GuideStep): Box | null {
  const target = document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`);
  if (!target) return null;

  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  const rect = target.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height
  };
}

function getCardPosition(target: Box | null, placement: GuideStep['placement'], cardWidth: number, cardHeight: number) {
  if (!target) {
    return {
      left: Math.max((window.innerWidth - cardWidth) / 2, 20),
      top: Math.max((window.innerHeight - cardHeight) / 2, 20)
    };
  }

  const gap = 18;
  let left = target.left;
  let top = target.top;

  if (placement === 'top') {
    left = target.left + target.width / 2 - cardWidth / 2;
    top = target.top - cardHeight - gap;
  } else if (placement === 'left') {
    left = target.left - cardWidth - gap;
    top = target.top + target.height / 2 - cardHeight / 2;
  } else if (placement === 'right') {
    left = target.left + target.width + gap;
    top = target.top + target.height / 2 - cardHeight / 2;
  } else {
    left = target.left + target.width / 2 - cardWidth / 2;
    top = target.top + target.height + gap;
  }

  return {
    left: clamp(left, 16, window.innerWidth - cardWidth - 16),
    top: clamp(top, 16, window.innerHeight - cardHeight - 16)
  };
}

export function GuideOverlay({ stepIndex, onBack, onNext, onSkip, onFinish }: Props) {
  const step = GUIDE_STEPS[stepIndex];
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [targetBox, setTargetBox] = useState<Box | null>(null);
  const [cardBox, setCardBox] = useState({ top: 24, left: 24 });

  useEffect(() => {
    function updateTarget() {
      window.requestAnimationFrame(() => {
        setTargetBox(getTargetBox(step));
      });
    }

    updateTarget();
    const timeout = window.setTimeout(updateTarget, 160);
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [step]);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCardBox(getCardPosition(targetBox, step.placement, rect.width, rect.height));
  }, [step, targetBox]);

  const highlightStyle = targetBox
    ? {
        top: Math.max(targetBox.top - 10, 8),
        left: Math.max(targetBox.left - 10, 8),
        width: Math.min(targetBox.width + 20, window.innerWidth - 16),
        height: Math.min(targetBox.height + 20, window.innerHeight - 16),
      }
    : undefined;

  return (
    <div className="guideLayer" role="dialog" aria-modal="true" aria-label="Interface guide">
      <div className="guideBlocker" />
      {highlightStyle ? <div className="guideSpotlight" style={highlightStyle} /> : <div className="guideFallback" />}
      <div className="guideCard" ref={cardRef} style={cardBox}>
        <div className="guideStepMeta">
          Step {stepIndex + 1} of {GUIDE_STEPS.length}
        </div>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <div className="guideActions">
          <button type="button" onClick={onSkip}>
            Skip guide
          </button>
          <button type="button" onClick={onBack} disabled={stepIndex === 0}>
            Back
          </button>
          {stepIndex === GUIDE_STEPS.length - 1 ? (
            <button type="button" className="primary" onClick={onFinish}>
              Finish guide
            </button>
          ) : (
            <button type="button" className="primary" onClick={onNext}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
