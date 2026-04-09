import { Fragment, memo, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const DEFAULT_REVEAL_CHARACTERS_PER_SECOND = 48;
const MIN_REVEAL_DURATION_MS = 900;

type MessageBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[]; start: number };

type StructuredTextUnit = {
  segments: string[];
};

type PreparedMessageBlock =
  | { type: "paragraph"; lines: StructuredTextUnit[] }
  | { type: "unordered-list"; items: StructuredTextUnit[] }
  | { type: "ordered-list"; items: StructuredTextUnit[]; start: number };

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

function prepareMessageBlocks(text: string): PreparedMessageBlock[] {
  return parseMessageText(text).map((block) => {
    if (block.type === "paragraph") {
      return {
        type: "paragraph",
        lines: block.lines.map((line) => ({ segments: splitTextForReveal(line) }))
      };
    }

    if (block.type === "unordered-list") {
      return {
        type: "unordered-list",
        items: block.items.map((item) => ({ segments: splitTextForReveal(item) }))
      };
    }

    return {
      type: "ordered-list",
      start: block.start,
      items: block.items.map((item) => ({ segments: splitTextForReveal(item) }))
    };
  });
}

function getPreparedMessageSegmentCount(blocks: PreparedMessageBlock[]) {
  return blocks.reduce((total, block) => {
    if (block.type === "paragraph") {
      return total + block.lines.reduce((lineTotal, line) => lineTotal + line.segments.length, 0);
    }

    return total + block.items.reduce((itemTotal, item) => itemTotal + item.segments.length, 0);
  }, 0);
}

function renderVisibleUnits(units: StructuredTextUnit[], remainingVisibleCount: number) {
  if (remainingVisibleCount <= 0) {
    return { nextRemainingVisibleCount: remainingVisibleCount, visibleTexts: [] as string[] };
  }

  const visibleTexts: string[] = [];
  let nextRemainingVisibleCount = remainingVisibleCount;

  for (const unit of units) {
    if (nextRemainingVisibleCount <= 0) {
      break;
    }

    const visibleSegments = Math.min(unit.segments.length, nextRemainingVisibleCount);
    if (visibleSegments <= 0) {
      break;
    }

    visibleTexts.push(unit.segments.slice(0, visibleSegments).join(""));
    nextRemainingVisibleCount -= visibleSegments;

    if (visibleSegments < unit.segments.length) {
      break;
    }
  }

  return {
    nextRemainingVisibleCount,
    visibleTexts
  };
}

function renderStructuredMessage(blocks: PreparedMessageBlock[], className: string, visibleCount?: number) {
  const nodes: ReactNode[] = [];
  let remainingVisibleCount = visibleCount ?? Number.POSITIVE_INFINITY;

  for (const [blockIndex, block] of blocks.entries()) {
    if (remainingVisibleCount <= 0) {
      break;
    }

    if (block.type === "paragraph") {
      const { nextRemainingVisibleCount, visibleTexts } = renderVisibleUnits(block.lines, remainingVisibleCount);
      remainingVisibleCount = nextRemainingVisibleCount;

      if (visibleTexts.length === 0) {
        continue;
      }

      nodes.push(
        <p key={blockIndex}>
          {visibleTexts.map((line, lineIndex) => (
            <Fragment key={`${blockIndex}-${lineIndex}`}>
              {line}
              {lineIndex < visibleTexts.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      );
      continue;
    }

    const { nextRemainingVisibleCount, visibleTexts } = renderVisibleUnits(block.items, remainingVisibleCount);
    remainingVisibleCount = nextRemainingVisibleCount;

    if (visibleTexts.length === 0) {
      continue;
    }

    if (block.type === "unordered-list") {
      nodes.push(
        <ul key={blockIndex}>
          {visibleTexts.map((item, itemIndex) => (
            <li key={itemIndex}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }

    nodes.push(
      <ol key={blockIndex} start={block.start}>
        {visibleTexts.map((item, itemIndex) => (
          <li key={itemIndex}>{item}</li>
        ))}
      </ol>
    );
  }

  if (nodes.length === 0) {
    return null;
  }

  return <div className={className}>{nodes}</div>;
}

export function getAssistantRevealDurationMs(text: string, maxDurationMs: number) {
  const segmentCount = getPreparedMessageSegmentCount(prepareMessageBlocks(text));
  if (segmentCount === 0) {
    return 0;
  }

  const rawDurationMs = (segmentCount / DEFAULT_REVEAL_CHARACTERS_PER_SECOND) * 1000;
  const boundedDurationMs = Math.min(maxDurationMs, Math.max(MIN_REVEAL_DURATION_MS, rawDurationMs));
  return Math.max(0, boundedDurationMs);
}

export const AnimatedAssistantText = memo(function AnimatedAssistantText({
  animate,
  className = "messageTextStructured",
  durationMs,
  onRevealComplete,
  onRevealStep,
  text
}: {
  animate: boolean;
  className?: string;
  durationMs: number;
  onRevealComplete?: () => void;
  onRevealStep?: () => void;
  text: string;
}) {
  const preparedBlocks = useMemo(() => prepareMessageBlocks(text), [text]);
  const totalVisibleSegments = useMemo(() => getPreparedMessageSegmentCount(preparedBlocks), [preparedBlocks]);
  const [visibleCount, setVisibleCount] = useState(animate ? 0 : totalVisibleSegments);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const visibleCountRef = useRef(visibleCount);
  const revealCompletedRef = useRef(false);

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  useEffect(() => {
    revealCompletedRef.current = false;
  }, [animate, totalVisibleSegments]);

  useLayoutEffect(() => {
    if (animate && visibleCount > 0) {
      onRevealStep?.();
    }
  }, [animate, onRevealStep, visibleCount]);

  useEffect(() => {
    if (!animate || revealCompletedRef.current || visibleCount < totalVisibleSegments) {
      return;
    }

    revealCompletedRef.current = true;
    onRevealComplete?.();
  }, [animate, onRevealComplete, totalVisibleSegments, visibleCount]);

  useEffect(() => {
    if (!animate) {
      visibleCountRef.current = totalVisibleSegments;
      setVisibleCount(totalVisibleSegments);
      return;
    }

    if (totalVisibleSegments === 0) {
      visibleCountRef.current = 0;
      setVisibleCount(0);
      return;
    }

    if (durationMs <= 0) {
      visibleCountRef.current = totalVisibleSegments;
      setVisibleCount(totalVisibleSegments);
      return;
    }

    visibleCountRef.current = 0;
    setVisibleCount(0);
    startedAtRef.current = null;
    const msPerSegment = durationMs / totalVisibleSegments;

    const revealNextFrame = (now: number) => {
      if (startedAtRef.current === null) {
        startedAtRef.current = now;
      }

      const elapsed = now - startedAtRef.current;
      const nextCount = Math.min(totalVisibleSegments, Math.floor(elapsed / msPerSegment) + 1);

      if (nextCount !== visibleCountRef.current) {
        visibleCountRef.current = nextCount;
        setVisibleCount(nextCount);
      }

      if (nextCount < totalVisibleSegments) {
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
  }, [animate, durationMs, totalVisibleSegments]);

  return renderStructuredMessage(preparedBlocks, className, visibleCount);
});

export const FormattedAssistantText = memo(function FormattedAssistantText({
  className = "messageTextStructured",
  text
}: {
  className?: string;
  text: string;
}) {
  const preparedBlocks = useMemo(() => prepareMessageBlocks(text), [text]);
  return renderStructuredMessage(preparedBlocks, className);
});
