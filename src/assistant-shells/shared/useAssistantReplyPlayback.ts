import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import manifest from "../../features/avatar/avatarPreviewManifest";
import type { AvatarManifest } from "../../features/avatar/types";
import type { ConversationMessage } from "../../lib/types";
import { getAssistantRevealDurationMs } from "./assistantMessageContent";

export type AssistantReplyPlaybackPhase = "idle" | "awaiting_start" | "revealing" | "awaiting_settle";
export type AssistantMessageRenderMode = "static" | "queued" | "revealing";

function getAssistantMessages(messages: ConversationMessage[]) {
  return messages.filter((message) => message.role === "assistant");
}

export function getExplainRevealBudgetMs(sourceManifest: AvatarManifest = manifest) {
  const speakingAssets = sourceManifest.loops.speaking_explain ?? [];
  if (speakingAssets.length === 0) {
    return 5000;
  }

  return Math.min(...speakingAssets.map((asset) => asset.durationMs));
}

export function useAssistantReplyPlayback({
  conversationKey,
  messages
}: {
  conversationKey: string;
  messages: ConversationMessage[];
}) {
  const assistantMessages = useMemo(() => getAssistantMessages(messages), [messages]);
  const [queuedMessageIds, setQueuedMessageIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<AssistantReplyPlaybackPhase>("idle");
  const [revealDurationMs, setRevealDurationMs] = useState(0);
  const initializedConversationKeyRef = useRef<string | null>(null);
  const seenAssistantIdsRef = useRef<Set<string>>(new Set());

  const activeMessageId = queuedMessageIds[0] ?? null;
  const activeMessage = useMemo(
    () => assistantMessages.find((message) => message.id === activeMessageId) ?? null,
    [activeMessageId, assistantMessages]
  );

  useLayoutEffect(() => {
    const seedSeenIds = new Set(assistantMessages.map((message) => message.id));
    if (initializedConversationKeyRef.current !== conversationKey) {
      initializedConversationKeyRef.current = conversationKey;
      seenAssistantIdsRef.current = seedSeenIds;
      setQueuedMessageIds([]);
      setPhase("idle");
      setRevealDurationMs(0);
      return;
    }

    const nextQueuedIds: string[] = [];
    for (const message of assistantMessages) {
      if (seenAssistantIdsRef.current.has(message.id)) {
        continue;
      }

      seenAssistantIdsRef.current.add(message.id);
      nextQueuedIds.push(message.id);
    }

    if (nextQueuedIds.length > 0) {
      setQueuedMessageIds((current) => [...current, ...nextQueuedIds]);
    }
  }, [assistantMessages, conversationKey]);

  useEffect(() => {
    if (!activeMessageId) {
      if (phase !== "idle") {
        setPhase("idle");
        setRevealDurationMs(0);
      }
      return;
    }

    if (phase === "idle") {
      setPhase("awaiting_start");
    }
  }, [activeMessageId, phase]);

  const startReveal = useCallback((maxRevealDurationMs: number) => {
    if (!activeMessageId || phase !== "awaiting_start") {
      return;
    }

    const nextDurationMs = getAssistantRevealDurationMs(activeMessage?.text ?? "", maxRevealDurationMs);
    setRevealDurationMs(nextDurationMs);
    setPhase("revealing");
  }, [activeMessage, activeMessageId, phase]);

  const markRevealComplete = useCallback((messageId: string) => {
    if (!activeMessageId || messageId !== activeMessageId || phase !== "revealing") {
      return;
    }

    setPhase("awaiting_settle");
  }, [activeMessageId, phase]);

  const completeActive = useCallback((messageId: string) => {
    if (!activeMessageId || messageId !== activeMessageId) {
      return;
    }

    setQueuedMessageIds((current) => current.filter((id) => id !== messageId));
    setRevealDurationMs(0);
    setPhase(queuedMessageIds.length > 1 ? "awaiting_start" : "idle");
  }, [activeMessageId, queuedMessageIds.length]);

  const queuedMessageIdsSet = useMemo(() => new Set(queuedMessageIds), [queuedMessageIds]);

  const getMessageRenderMode = useCallback((messageId: string): AssistantMessageRenderMode => {
    if (!queuedMessageIdsSet.has(messageId)) {
      return "static";
    }

    if (activeMessageId === messageId) {
      if (phase === "revealing") {
        return "revealing";
      }

      if (phase === "awaiting_start") {
        return "queued";
      }

      return "static";
    }

    return "queued";
  }, [activeMessageId, phase, queuedMessageIdsSet]);

  return {
    activeMessageId,
    activeMessageText: activeMessage?.text ?? "",
    completeActive,
    getMessageRenderMode,
    markRevealComplete,
    phase,
    revealDurationMs,
    startReveal
  };
}
