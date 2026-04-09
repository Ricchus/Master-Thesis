import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const DEFAULT_REVEAL_CHARACTERS_PER_SECOND = 48;
const MIN_REVEAL_DURATION_MS = 900;

type MessageBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[]; start: number };

function splitTextForReveal(text: string) {
  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: new (
      locales?: string | string[],
      options?: { granularity: "grapheme" }
    ) => { segment(input: string): Iterable<{ segment: string }> };
  }).Segmenter;

  if (Segmenter) {
    return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(text), (part) => part.segment);
  }

  return Array.from(text);
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
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const sourceLines = normalized.split("\n");
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

      blocks.push({ type: "ordered-list", items, start });
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

      blocks.push({ type: "unordered-list", items });
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

    blocks.push({ type: "paragraph", lines });
  }

  return blocks;
}

export function getAssistantRevealDurationMs(text: string, maxDurationMs: number) {
  const segmentCount = splitTextForReveal(text).length;
  if (segmentCount === 0) {
    return 0;
  }

  const rawDurationMs = (segmentCount / DEFAULT_REVEAL_CHARACTERS_PER_SECOND) * 1000;
  const boundedDurationMs = Math.min(maxDurationMs, Math.max(MIN_REVEAL_DURATION_MS, rawDurationMs));
  return Math.max(0, boundedDurationMs);
}

export const AnimatedAssistantText = memo(function AnimatedAssistantText({
  animate,
  durationMs,
  onRevealComplete,
  onRevealStep,
  text
}: {
  animate: boolean;
  durationMs: number;
  onRevealComplete?: () => void;
  onRevealStep?: () => void;
  text: string;
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

    if (durationMs <= 0) {
      visibleCountRef.current = segments.length;
      setVisibleCount(segments.length);
      return;
    }

    visibleCountRef.current = 0;
    setVisibleCount(0);
    startedAtRef.current = null;
    const msPerSegment = durationMs / segments.length;

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
  }, [animate, durationMs, segments]);

  return <>{segments.slice(0, visibleCount).join("")}</>;
});

export const FormattedAssistantText = memo(function FormattedAssistantText({
  className = "messageTextStructured",
  text
}: {
  className?: string;
  text: string;
}) {
  const blocks = useMemo(() => parseMessageText(text), [text]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "unordered-list") {
          return (
            <ul key={blockIndex}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
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
