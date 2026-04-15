import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AvatarMediaPlayer } from '../../features/avatar/AvatarMediaPlayer';
import { usePreloadedAvatarAssets, useStableAvatarRenderModel } from '../../features/avatar/avatarMedia';
import { useAvatarController } from '../../features/avatar/useAvatarController';
import { useAvatarReplyCoordinator } from './useAvatarReplyCoordinator';
import {
  AnimatedAssistantText as SharedAnimatedAssistantText,
  FormattedAssistantText as SharedFormattedAssistantText
} from '../shared/assistantMessageContent';
import {
  getExplainRevealBudgetMs,
  useAssistantReplyPlayback,
  type AssistantMessageRenderMode
} from '../shared/useAssistantReplyPlayback';
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

const BUBBLE_TAIL_LAYOUT_SPACE = 18;
const BUBBLE_TAIL_SEAM_OVERLAP = 1;
const BUBBLE_TAIL_ROOT_MAX_DISTANCE_FROM_BOTTOM = 28;
const BUBBLE_TAIL_ROOT_LOWER_MAX_DISTANCE_FROM_BOTTOM = 12;
// Retained crop of the original demo after removing the top control strip.
const STAGE_WIDTH = 980;
const STAGE_HEIGHT = 456;
const EXPLAIN_SETTLE_BUFFER_MS = 350;

function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
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
  assistantRenderMode,
  isLatestAssistantBubble,
  isLatestUserBubble,
  message,
  revealDurationMs,
  onRevealComplete,
  onRevealStep
}: {
  assistantRenderMode: AssistantMessageRenderMode;
  isLatestAssistantBubble: boolean;
  isLatestUserBubble: boolean;
  message: DisplayMessage;
  revealDurationMs: number;
  onRevealComplete: (messageId: string) => void;
  onRevealStep: () => void;
}) {
  const bubbleSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [bubbleSize, setBubbleSize] = useState<BubbleSize | null>(null);
  const shouldAnimateAssistant = assistantRenderMode === 'revealing';
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
            {assistantRenderMode === 'revealing' ? (
              <SharedAnimatedAssistantText
                text={message.text}
                animate
                className="messageTextStructured"
                durationMs={revealDurationMs}
                onRevealStep={onRevealStep}
                onRevealComplete={() => onRevealComplete(message.id)}
              />
            ) : (
              <SharedFormattedAssistantText text={message.text} />
            )}
          </div>
          {message.role === 'assistant' && assistantRenderMode !== 'revealing' ? (
            <div className="avatarChirp" aria-hidden="true">chew~</div>
          ) : null}
          <div className="bubbleMeta">{formatClock(message.createdAt)}</div>
        </div>
      </div>
    </div>
  );
});

const MessageList = memo(function MessageList({
  assistantRenderModeForMessage,
  messages,
  onAssistantRevealComplete,
  revealDurationMs
}: {
  assistantRenderModeForMessage: (messageId: string) => AssistantMessageRenderMode;
  messages: DisplayMessage[];
  onAssistantRevealComplete: (messageId: string) => void;
  revealDurationMs: number;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const visibleMessages = useMemo(
    () => messages.filter((message) => !(message.role === 'assistant' && assistantRenderModeForMessage(message.id) === 'queued')),
    [assistantRenderModeForMessage, messages]
  );
  const lastMessageId = visibleMessages[visibleMessages.length - 1]?.id;
  const latestAssistantId = useMemo(
    () => [...visibleMessages].reverse().find((message) => message.role === 'assistant')?.id ?? null,
    [visibleMessages]
  );
  const latestUserId = useMemo(
    () => [...visibleMessages].reverse().find((message) => message.role === 'user')?.id ?? null,
    [visibleMessages]
  );

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
        {visibleMessages.map((message) => {
          const assistantRenderMode = message.role === 'assistant'
            ? assistantRenderModeForMessage(message.id)
            : 'static';
          return (
            <MessageBubble
              key={message.id}
              assistantRenderMode={assistantRenderMode}
              isLatestAssistantBubble={message.id === latestAssistantId}
              isLatestUserBubble={message.id === latestUserId}
              message={message}
              revealDurationMs={revealDurationMs}
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
  const { controller, runtime, manifest } = useAvatarController();
  const { outerRef, scale } = useScaledStage(STAGE_WIDTH, STAGE_HEIGHT);
  const displayMessages = useMemo<DisplayMessage[]>(() => messages.map((message) => ({ ...message, role: mapMessageRole(message.role) })), [messages]);
  const conversationKey = useMemo(() => messages[0]?.id ?? 'empty-conversation', [messages]);
  const visibleRenderModel = useStableAvatarRenderModel(runtime.renderModel);
  const defaultExplainBudgetMs = useMemo(() => getExplainRevealBudgetMs(manifest), [manifest]);
  const explainRevealBudgetMs =
    runtime.currentState === 'speaking_explain' &&
    runtime.playbackKind === 'loop' &&
    !runtime.isTransitioning &&
    runtime.currentLoopAsset
      ? runtime.currentLoopAsset.durationMs
      : defaultExplainBudgetMs;
  const avatarRevealBudgetMs = explainRevealBudgetMs > EXPLAIN_SETTLE_BUFFER_MS
    ? explainRevealBudgetMs - EXPLAIN_SETTLE_BUFFER_MS
    : explainRevealBudgetMs;
  const replyPlayback = useAssistantReplyPlayback({
    conversationKey,
    messages
  });
  const { activeMessageId, completeActive, getMessageRenderMode, markRevealComplete, phase, revealDurationMs, startReveal } = replyPlayback;
  const hasInput = input.trim().length > 0;

  usePreloadedAvatarAssets(manifest);
  useAvatarReplyCoordinator({
    activeMessageId,
    avatarRevealBudgetMs,
    beginReveal: startReveal,
    completeActive,
    controller,
    hasInput,
    isLoading,
    phase,
    runtime
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading || disabled) return;

    setInput('');
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
              assistantRenderModeForMessage={getMessageRenderMode}
              messages={displayMessages}
              onAssistantRevealComplete={markRevealComplete}
              revealDurationMs={revealDurationMs}
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
                <textarea
                  className="input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={disabled ? 'Messaging is unavailable right now' : 'Message Momo...'}
                  rows={3}
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
