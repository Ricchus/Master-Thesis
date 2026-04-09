import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AvatarMediaPlayer } from '../../features/avatar/AvatarMediaPlayer';
import { usePreloadedAvatarAssets, useStableAvatarRenderModel } from '../../features/avatar/avatarMedia';
import { useAvatarController } from '../../features/avatar/useAvatarController';
import type { ConversationMessage } from '../../lib/types';
import './avatar-demo-shell.css';

type Props = {
  messages: ConversationMessage[];
  isLoading: boolean;
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
};

type MessageRole = 'assistant' | 'user' | 'system-error';

type DisplayMessage = {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: number;
};

type MessageBlock =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[]; start: number };

type BubbleSize = {
  height: number;
  width: number;
};

type BubbleTailMetrics = {
  bottomJoinX: number;
  bottomY: number;
  joinControlX: number;
  rootReturnY: number;
  rootUpperY: number;
  rootX: number;
  tipLowerControlX: number;
  tipLowerControlY: number;
  tipUpperControlX: number;
  tipUpperControlY: number;
  tipX: number;
  tipY: number;
  topOffset: number;
  viewHeight: number;
  viewWidth: number;
};

const ASSISTANT_REVEAL_CHARACTERS_PER_SECOND = 48;
const BUBBLE_TAIL_LAYOUT_SPACE = 18;
const BUBBLE_TAIL_SEAM_OVERLAP = 1;
const BUBBLE_TAIL_ROOT_MAX_DISTANCE_FROM_BOTTOM = 28;
const BUBBLE_TAIL_ROOT_LOWER_MAX_DISTANCE_FROM_BOTTOM = 12;
// Retained crop of the original demo after removing the top control strip.
const STAGE_WIDTH = 980;
const STAGE_HEIGHT = 456;

function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function splitTextForReveal(text: string) {
  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: new (
      locales?: string | string[],
      options?: { granularity: 'grapheme' }
    ) => { segment(input: string): Iterable<{ segment: string }> };
  }).Segmenter;

  if (Segmenter) {
    return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment);
  }

  return Array.from(text);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createBubbleTailMetrics(bubbleWidth: number, bubbleHeight: number): BubbleTailMetrics {
  const width = Math.max(bubbleWidth, 1);
  const height = Math.max(bubbleHeight, 1);
  const tailWidth = clampNumber(Math.min(width * 0.075, height * 0.16), 12, 16);
  const tailDrop = clampNumber(height * 0.1, 6, 10);
  const bodyLeftX = tailWidth;
  const overlapWidth = clampNumber(width * 0.09, width * 0.04, width * 0.12);
  const bottomJoinX = bodyLeftX + overlapWidth;
  const rootUpperY = Math.max(height * 0.74, height - BUBBLE_TAIL_ROOT_MAX_DISTANCE_FROM_BOTTOM);
  const rootLowerY = Math.max(height * 0.9, height - BUBBLE_TAIL_ROOT_LOWER_MAX_DISTANCE_FROM_BOTTOM);
  const tipX = bodyLeftX - tailWidth * 0.92;
  const tipY = height;
  const bottomJoinControlX = bodyLeftX + clampNumber(width * 0.05, 6, 12);
  const tipUpperControlX = tipX + tailWidth * 0.26;
  const tipUpperControlY = tipY + tailDrop * 0.12;
  const tipLowerControlX = tipX + tailWidth * 0.16;
  const tipLowerControlY = tipY - tailDrop * 0.16;
  const rootReturnY = rootUpperY + (rootLowerY - rootUpperY) * 0.72;
  const translateX = BUBBLE_TAIL_LAYOUT_SPACE - bodyLeftX + BUBBLE_TAIL_SEAM_OVERLAP;
  const translateY = -rootUpperY;

  return {
    bottomJoinX: bottomJoinX + translateX,
    bottomY: height + translateY,
    joinControlX: bottomJoinControlX + translateX,
    rootReturnY: rootReturnY + translateY,
    rootUpperY: 0,
    rootX: bodyLeftX + translateX,
    tipLowerControlX: tipLowerControlX + translateX,
    tipLowerControlY: tipLowerControlY + translateY,
    tipUpperControlX: tipUpperControlX + translateX,
    tipUpperControlY: tipUpperControlY + translateY,
    tipX: tipX + translateX,
    tipY: tipY + translateY,
    topOffset: rootUpperY,
    viewHeight: tipY - rootUpperY,
    viewWidth: BUBBLE_TAIL_LAYOUT_SPACE + overlapWidth + BUBBLE_TAIL_SEAM_OVERLAP
  };
}

function matchUnorderedListItem(line: string) {
  return line.match(/^\s*[-*•]\s+(.+)$/)?.[1]?.trim() ?? null;
}

function matchOrderedListItem(line: string) {
  const match = line.match(/^\s*(\d+)\.\s+(.+)$/);
  if (!match) {
    return null;
  }

  return {
    text: match[2].trim(),
    value: Number(match[1])
  };
}

function parseMessageText(text: string): MessageBlock[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const sourceLines = normalized.split('\n');
  const blocks: MessageBlock[] = [];
  let index = 0;

  while (index < sourceLines.length) {
    const currentLine = sourceLines[index].trim();

    if (!currentLine) {
      index += 1;
      continue;
    }

    const orderedMatch = matchOrderedListItem(currentLine);
    if (orderedMatch) {
      const items = [orderedMatch.text];
      const start = orderedMatch.value;
      index += 1;

      while (index < sourceLines.length) {
        const nextLine = sourceLines[index].trim();
        if (!nextLine) {
          let nextIndex = index + 1;
          while (nextIndex < sourceLines.length && !sourceLines[nextIndex].trim()) {
            nextIndex += 1;
          }

          if (nextIndex >= sourceLines.length) {
            index = nextIndex;
            break;
          }

          const nextOrderedMatch = matchOrderedListItem(sourceLines[nextIndex].trim());
          if (!nextOrderedMatch) {
            index = nextIndex;
            break;
          }

          items.push(nextOrderedMatch.text);
          index = nextIndex + 1;
          continue;
        }

        const nextOrderedMatch = matchOrderedListItem(nextLine);
        if (!nextOrderedMatch) {
          break;
        }

        items.push(nextOrderedMatch.text);
        index += 1;
      }

      blocks.push({ type: 'ordered-list', items, start });
      continue;
    }

    const unorderedMatch = matchUnorderedListItem(currentLine);
    if (unorderedMatch) {
      const items = [unorderedMatch];
      index += 1;

      while (index < sourceLines.length) {
        const nextLine = sourceLines[index].trim();
        if (!nextLine) {
          let nextIndex = index + 1;
          while (nextIndex < sourceLines.length && !sourceLines[nextIndex].trim()) {
            nextIndex += 1;
          }

          if (nextIndex >= sourceLines.length) {
            index = nextIndex;
            break;
          }

          const nextUnorderedMatch = matchUnorderedListItem(sourceLines[nextIndex].trim());
          if (!nextUnorderedMatch) {
            index = nextIndex;
            break;
          }

          items.push(nextUnorderedMatch);
          index = nextIndex + 1;
          continue;
        }

        const nextUnorderedMatch = matchUnorderedListItem(nextLine);
        if (!nextUnorderedMatch) {
          break;
        }

        items.push(nextUnorderedMatch);
        index += 1;
      }

      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    const lines = [currentLine];
    index += 1;

    while (index < sourceLines.length) {
      const nextLine = sourceLines[index].trim();
      if (!nextLine || matchOrderedListItem(nextLine) || matchUnorderedListItem(nextLine)) {
        break;
      }

      lines.push(nextLine);
      index += 1;
    }

    blocks.push({ type: 'paragraph', lines });
  }

  return blocks;
}

function useScaledStage(stageWidth: number, stageHeight: number) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const node = outerRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      if (!width || !height) {
        return;
      }
      const nextScale = Math.min(width / stageWidth, height / stageHeight);
      setScale(Number.isFinite(nextScale) ? nextScale : 1);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [stageHeight, stageWidth]);

  return { outerRef, scale };
}

const AnimatedAssistantText = memo(function AnimatedAssistantText({
  text,
  animate,
  onRevealStep,
  onRevealComplete
}: {
  text: string;
  animate: boolean;
  onRevealStep?: () => void;
  onRevealComplete?: () => void;
}) {
  const segments = useMemo(() => splitTextForReveal(text), [text]);
  const [visibleCount, setVisibleCount] = useState(animate ? 0 : segments.length);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const visibleCountRef = useRef(visibleCount);
  const revealCompletedRef = useRef(false);

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  useEffect(() => {
    revealCompletedRef.current = false;
  }, [animate, segments]);

  useLayoutEffect(() => {
    if (animate && visibleCount > 0) {
      onRevealStep?.();
    }
  }, [animate, onRevealStep, visibleCount]);

  useEffect(() => {
    if (!animate || revealCompletedRef.current || visibleCount < segments.length) {
      return;
    }

    revealCompletedRef.current = true;
    onRevealComplete?.();
  }, [animate, onRevealComplete, segments.length, visibleCount]);

  useEffect(() => {
    if (!animate) {
      visibleCountRef.current = segments.length;
      setVisibleCount(segments.length);
      return;
    }

    if (segments.length === 0) {
      visibleCountRef.current = 0;
      setVisibleCount(0);
      return;
    }

    visibleCountRef.current = 0;
    setVisibleCount(0);
    startedAtRef.current = null;
    const msPerSegment = 1000 / ASSISTANT_REVEAL_CHARACTERS_PER_SECOND;

    const revealNextFrame = (now: number) => {
      if (startedAtRef.current === null) {
        startedAtRef.current = now;
      }

      const elapsed = now - startedAtRef.current;
      const nextCount = Math.min(segments.length, Math.floor(elapsed / msPerSegment) + 1);

      if (nextCount !== visibleCountRef.current) {
        visibleCountRef.current = nextCount;
        setVisibleCount(nextCount);
      }

      if (nextCount < segments.length) {
        frameRef.current = window.requestAnimationFrame(revealNextFrame);
      }
    };

    frameRef.current = window.requestAnimationFrame(revealNextFrame);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      startedAtRef.current = null;
    };
  }, [animate, segments]);

  return <>{segments.slice(0, visibleCount).join('')}</>;
});

const FormattedMessageText = memo(function FormattedMessageText({ text }: { text: string }) {
  const blocks = useMemo(() => parseMessageText(text), [text]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="messageTextStructured">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'unordered-list') {
          return (
            <ul key={blockIndex}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ordered-list') {
          return (
            <ol key={blockIndex} start={block.start}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={blockIndex}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={`${blockIndex}-${lineIndex}`}>
                {line}
                {lineIndex < block.lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
});

const BubbleTail = memo(function BubbleTail({ bubbleHeight, bubbleWidth, side }: {
  bubbleHeight: number;
  bubbleWidth: number;
  side: 'assistant' | 'user';
}) {
  const metrics = useMemo(() => createBubbleTailMetrics(bubbleWidth, bubbleHeight), [bubbleHeight, bubbleWidth]);
  const path = useMemo(
    () => [
      `M ${metrics.bottomJoinX} ${metrics.bottomY}`,
      `C ${metrics.joinControlX} ${metrics.bottomY} ${metrics.tipUpperControlX} ${metrics.tipUpperControlY} ${metrics.tipX} ${metrics.tipY}`,
      `C ${metrics.tipLowerControlX} ${metrics.tipLowerControlY} ${metrics.rootX} ${metrics.rootReturnY} ${metrics.rootX} ${metrics.rootUpperY}`,
      `L ${metrics.rootX} ${metrics.bottomY}`,
      `L ${metrics.bottomJoinX} ${metrics.bottomY}`,
      'Z'
    ].join(' '),
    [metrics]
  );
  const style = useMemo(
    () => ({
      height: `${metrics.viewHeight}px`,
      top: `${metrics.topOffset}px`,
      width: `${metrics.viewWidth}px`
    }),
    [metrics]
  );

  return (
    <svg className={`bubbleTail ${side}`} viewBox={`0 0 ${metrics.viewWidth} ${metrics.viewHeight}`} style={style} aria-hidden="true" focusable="false">
      <g transform={side === 'user' ? `translate(${metrics.viewWidth} 0) scale(-1 1)` : undefined}>
        <path d={path} fill="var(--bubble-tail-fill)" />
      </g>
    </svg>
  );
});

const BubbleOutline = memo(function BubbleOutline({ bubbleHeight, bubbleWidth, side }: {
  bubbleHeight: number;
  bubbleWidth: number;
  side: 'assistant' | 'user';
}) {
  const metrics = useMemo(() => createBubbleTailMetrics(bubbleWidth, bubbleHeight), [bubbleHeight, bubbleWidth]);
  const path = useMemo(
    () => [
      `M ${metrics.bottomJoinX} ${metrics.bottomY}`,
      `C ${metrics.joinControlX} ${metrics.bottomY} ${metrics.tipUpperControlX} ${metrics.tipUpperControlY} ${metrics.tipX} ${metrics.tipY}`,
      `C ${metrics.tipLowerControlX} ${metrics.tipLowerControlY} ${metrics.rootX} ${metrics.rootReturnY} ${metrics.rootX} ${metrics.rootUpperY}`
    ].join(' '),
    [metrics]
  );
  const style = useMemo(
    () => ({
      height: `${metrics.viewHeight}px`,
      top: `${metrics.topOffset}px`,
      width: `${metrics.viewWidth}px`
    }),
    [metrics]
  );

  return (
    <svg className={`bubbleOutline ${side}`} viewBox={`0 0 ${metrics.viewWidth} ${metrics.viewHeight}`} style={style} aria-hidden="true" focusable="false">
      <path
        d={path}
        fill="none"
        stroke="var(--bubble-border-color)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={side === 'user' ? `translate(${metrics.viewWidth} 0) scale(-1 1)` : undefined}
      />
    </svg>
  );
});

const MessageBubble = memo(function MessageBubble({
  isLatestAssistantBubble,
  isLatestUserBubble,
  message,
  shouldAnimateAssistant,
  onRevealComplete,
  onRevealStep
}: {
  isLatestAssistantBubble: boolean;
  isLatestUserBubble: boolean;
  message: DisplayMessage;
  shouldAnimateAssistant: boolean;
  onRevealComplete: (messageId: string) => void;
  onRevealStep: () => void;
}) {
  const bubbleSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [bubbleSize, setBubbleSize] = useState<BubbleSize | null>(null);
  const tailSide = isLatestAssistantBubble && message.role === 'assistant'
    ? 'assistant'
    : isLatestUserBubble && message.role === 'user'
      ? 'user'
      : null;

  useLayoutEffect(() => {
    if (!tailSide) {
      setBubbleSize(null);
      return;
    }

    const bubble = bubbleSurfaceRef.current;
    if (!bubble) {
      return;
    }

    const measure = () => {
      const nextRect = {
        height: bubble.offsetHeight,
        width: bubble.offsetWidth
      };
      setBubbleSize((current) =>
        current && Math.abs(current.height - nextRect.height) < 0.5 && Math.abs(current.width - nextRect.width) < 0.5
          ? current
          : { height: nextRect.height, width: nextRect.width }
      );
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(bubble);
    return () => observer.disconnect();
  }, [message.id, message.role, message.text, tailSide]);

  return (
    <div className={`msgRow ${message.role}`}>
      <div className={`bubble ${message.role} ${tailSide ? 'tailed' : 'plain'}`}>
        {tailSide && bubbleSize ? <BubbleTail bubbleHeight={bubbleSize.height} bubbleWidth={bubbleSize.width} side={tailSide} /> : null}
        {tailSide && bubbleSize ? <BubbleOutline bubbleHeight={bubbleSize.height} bubbleWidth={bubbleSize.width} side={tailSide} /> : null}
        <div className={`bubbleSurface ${message.role} ${tailSide ? 'tailed' : 'plain'}`} ref={bubbleSurfaceRef}>
          <div className={`bubbleBody ${shouldAnimateAssistant ? 'revealing' : ''}`}>
            {shouldAnimateAssistant ? (
              <AnimatedAssistantText
                text={message.text}
                animate
                onRevealStep={onRevealStep}
                onRevealComplete={() => onRevealComplete(message.id)}
              />
            ) : (
              <FormattedMessageText text={message.text} />
            )}
          </div>
          <div className="bubbleMeta">{formatClock(message.createdAt)}</div>
        </div>
      </div>
    </div>
  );
});

const MessageList = memo(function MessageList({
  messages,
  onAssistantRevealComplete,
  revealedAssistantId
}: {
  messages: DisplayMessage[];
  onAssistantRevealComplete: (messageId: string) => void;
  revealedAssistantId: string | null;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const lastMessageId = messages[messages.length - 1]?.id;
  const latestAssistantId = useMemo(() => [...messages].reverse().find((message) => message.role === 'assistant')?.id ?? null, [messages]);
  const latestUserId = useMemo(() => [...messages].reverse().find((message) => message.role === 'user')?.id ?? null, [messages]);

  function scrollToBottom() {
    const list = listRef.current;
    if (!list) {
      return;
    }

    bottomAnchorRef.current?.scrollIntoView({ block: 'end' });
    list.scrollTop = list.scrollHeight;
  }

  useLayoutEffect(() => {
    scrollToBottom();
  }, [lastMessageId]);

  function handleRevealComplete(messageId: string) {
    onAssistantRevealComplete(messageId);
    scrollToBottom();
  }

  return (
    <div className="msgList" ref={listRef}>
      <div>
        {messages.map((message) => {
          const shouldAnimateAssistant = message.role === 'assistant' && message.id === lastMessageId && message.id !== revealedAssistantId;
          return (
            <MessageBubble
              key={message.id}
              isLatestAssistantBubble={message.id === latestAssistantId}
              isLatestUserBubble={message.id === latestUserId}
              message={message}
              shouldAnimateAssistant={shouldAnimateAssistant}
              onRevealStep={scrollToBottom}
              onRevealComplete={handleRevealComplete}
            />
          );
        })}
        <div ref={bottomAnchorRef} />
      </div>
    </div>
  );
});

function mapMessageRole(role: ConversationMessage['role']): MessageRole {
  return role === 'system' ? 'system-error' : role;
}

export function AvatarAssistantShell({ messages, isLoading, onSend, disabled }: Props) {
  const [input, setInput] = useState('');
  const [revealedAssistantId, setRevealedAssistantId] = useState<string | null>(null);
  const { controller, runtime, manifest } = useAvatarController();
  const { outerRef, scale } = useScaledStage(STAGE_WIDTH, STAGE_HEIGHT);
  const displayMessages = useMemo<DisplayMessage[]>(() => messages.map((message) => ({ ...message, role: mapMessageRole(message.role) })), [messages]);
  const latestAssistantId = useMemo(
    () => [...displayMessages].reverse().find((message) => message.role === 'assistant')?.id ?? null,
    [displayMessages]
  );
  const visibleRenderModel = useStableAvatarRenderModel(runtime.renderModel);

  usePreloadedAvatarAssets(manifest);

  useEffect(() => {
    if (isLoading) {
      controller.requestState('thinking_process', { shouldHold: true, isActiveTrigger: true });
      return;
    }

    if (latestAssistantId && latestAssistantId !== revealedAssistantId) {
      controller.requestState('speaking_explain', { shouldHold: false, isActiveTrigger: true });
      return;
    }

    if (input.trim()) {
      controller.requestState('listening_attentive', { shouldHold: true, isActiveTrigger: true });
      return;
    }

    controller.requestState('idle_neutral', { shouldHold: true, isActiveTrigger: true });
  }, [controller, input, isLoading, latestAssistantId]);

  function handleAssistantRevealComplete(messageId: string) {
    setRevealedAssistantId((current) => (current === messageId ? current : messageId));

    if (messageId === latestAssistantId) {
      controller.requestState('positive_happy', { shouldHold: false, isActiveTrigger: true });
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading || disabled) return;

    setInput('');
    controller.requestState('thinking_process', { shouldHold: true, isActiveTrigger: true });
    await onSend(text);
  }

  return (
    <div className="avatarTaskShellRoot">
      <div className="avatarTaskShellViewport" ref={outerRef}>
        <div
          className="avatarTaskShellStage"
          style={{
            width: `${STAGE_WIDTH}px`,
            height: `${STAGE_HEIGHT}px`,
            transform: `translate(-50%, -50%) scale(${scale})`
          }}
        >
          <section className="chatShell avatarTaskShell">
            <MessageList
              messages={displayMessages}
              onAssistantRevealComplete={handleAssistantRevealComplete}
              revealedAssistantId={revealedAssistantId}
            />

            <div className="footerBar">
              <div className="avatarDock">
                {isLoading && (
                  <div className="avatarThoughtBubble" role="status" aria-live="polite" aria-label="Thinking…">
                    <span className="thinkingDots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                )}
                <div className="avatarStage">
                  <div className="avatarClip">
                    <AvatarMediaPlayer
                      renderModel={visibleRenderModel}
                      avatarAlt="Momo"
                      avatarFallback="Momo is getting ready…"
                    />
                  </div>
                </div>
              </div>

              <form className="composer" onSubmit={handleSubmit}>
                <input
                  className="input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={disabled ? 'Messaging is unavailable right now' : 'Message Momo...'}
                  disabled={disabled}
                />
                <button className="btn" type="submit" disabled={isLoading || !input.trim() || disabled}>
                  {isLoading ? 'Thinking...' : 'Send'}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
