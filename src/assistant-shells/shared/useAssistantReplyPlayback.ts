import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import manifest from "../../features/avatar/avatarPreviewManifest";
import type { AvatarManifest } from "../../features/avatar/types";
import type { ConversationMessage } from "../../lib/types";
import { getAssistantRevealDurationMs } from "./assistantMessageContent";

export type AssistantReplyPlaybackPhase = "idle" | "queued" | "revealing" | "revealed_waiting";
export type AssistantMessageRenderMode = "static" | "queued" | "revealing";

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

  useLayoutEffect(() => {
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

  const markRevealComplete = useCallback((messageId: string) => {
    if (!activeMessageId || messageId !== activeMessageId) {
      return;
    }

    completedMessageIdsRef.current.add(messageId);
    setPhase("revealed_waiting");
  }, [activeMessageId]);

  const completeSession = useCallback((messageId: string) => {
    if (!activeMessageId || messageId !== activeMessageId) {
      return;
    }

    completedMessageIdsRef.current.add(messageId);
    setActiveMessageId(null);
    setPhase("idle");
    setRevealDurationMs(0);
  }, [activeMessageId]);

  const getMessageRenderMode = useCallback((messageId: string): AssistantMessageRenderMode => {
    if (activeMessageId !== messageId) {
      return "static";
    }

    if (phase === "queued") {
      return "queued";
    }

    if (phase === "revealing") {
      return "revealing";
    }

    return "static";
  }, [activeMessageId, phase]);

  return {
    activeMessageId,
    getMessageRenderMode,
    latestAssistantMessage,
    phase,
    revealDurationMs,
    markRevealComplete,
    completeSession
  };
}
