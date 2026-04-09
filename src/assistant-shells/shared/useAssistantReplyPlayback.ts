import { useEffect, useMemo, useRef, useState } from "react";
import manifest from "../../features/avatar/avatarPreviewManifest";
import type { AvatarManifest } from "../../features/avatar/types";
import type { ConversationMessage } from "../../lib/types";
import { getAssistantRevealDurationMs } from "./assistantMessageContent";

export type AssistantReplyPlaybackPhase = "idle" | "queued" | "revealing" | "revealed";

function getLatestAssistantMessage(messages: ConversationMessage[]) {
  return [...messages].reverse().find((message) => message.role === "assistant") ?? null;
}

export function getExplainRevealBudgetMs(sourceManifest: AvatarManifest = manifest) {
  const speakingAssets = sourceManifest.loops.speaking_explain ?? [];
  if (speakingAssets.length === 0) {
    return 5000;
  }

  return Math.min(...speakingAssets.map((asset) => asset.durationMs));
}

export function useAssistantReplyPlayback({
  canStartReveal,
  isLoading,
  maxRevealDurationMs,
  messages
}: {
  canStartReveal: boolean;
  isLoading: boolean;
  maxRevealDurationMs: number;
  messages: ConversationMessage[];
}) {
  const latestAssistantMessage = useMemo(() => getLatestAssistantMessage(messages), [messages]);
  const completedMessageIdsRef = useRef<Set<string>>(new Set());
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [phase, setPhase] = useState<AssistantReplyPlaybackPhase>("idle");
  const [revealDurationMs, setRevealDurationMs] = useState(0);

  useEffect(() => {
    if (!latestAssistantMessage) {
      return;
    }

    if (latestAssistantMessage.id === activeMessageId || completedMessageIdsRef.current.has(latestAssistantMessage.id)) {
      return;
    }

    setActiveMessageId(latestAssistantMessage.id);
    setPhase("queued");
    setRevealDurationMs(0);
  }, [activeMessageId, latestAssistantMessage]);

  useEffect(() => {
    if (!activeMessageId || phase !== "queued" || isLoading || !canStartReveal) {
      return;
    }

    const activeMessage = messages.find((message) => message.id === activeMessageId && message.role === "assistant");
    const nextDurationMs = getAssistantRevealDurationMs(activeMessage?.text ?? "", maxRevealDurationMs);
    setRevealDurationMs(nextDurationMs);
    setPhase("revealing");
  }, [activeMessageId, canStartReveal, isLoading, maxRevealDurationMs, messages, phase]);

  function markRevealComplete(messageId: string) {
    if (!activeMessageId || messageId !== activeMessageId) {
      return;
    }

    completedMessageIdsRef.current.add(messageId);
    setPhase("revealed");
  }

  function completeSession(messageId: string) {
    if (!activeMessageId || messageId !== activeMessageId) {
      return;
    }

    setActiveMessageId(null);
    setPhase("idle");
    setRevealDurationMs(0);
  }

  function isAnimatingMessage(messageId: string) {
    return activeMessageId === messageId && phase === "revealing";
  }

  return {
    activeMessageId,
    latestAssistantMessage,
    phase,
    revealDurationMs,
    isAnimatingMessage,
    markRevealComplete,
    completeSession
  };
}
