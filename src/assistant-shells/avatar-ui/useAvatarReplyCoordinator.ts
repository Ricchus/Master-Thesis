import { useEffect, useMemo, useRef, useState } from "react";
import type { AvatarController } from "../../features/avatar/avatarController";
import type { AnchorState, AvatarRuntime } from "../../features/avatar/types";
import type { AssistantReplyPlaybackPhase } from "../shared/useAssistantReplyPlayback";

const START_TIMEOUT_MS = 650;
const SETTLE_TIMEOUT_MS = 450;

type AvatarCommand = {
  key: string;
  shouldHold: boolean;
  state: "idle_neutral" | "warm_friendly" | "listening_attentive" | "speaking_explain" | "thinking_process";
};

function isLoopReadyForState(runtime: AvatarRuntime, state: AnchorState) {
  return runtime.currentState === state && runtime.playbackKind === "loop" && !runtime.isTransitioning;
}

function isCommandInFlight(runtime: AvatarRuntime, state: AnchorState) {
  return (
    runtime.currentState === state ||
    runtime.targetState === state ||
    runtime.pendingState === state
  );
}

export function useAvatarReplyCoordinator({
  activeMessageId,
  beginReveal,
  completeActive,
  controller,
  explainRevealBudgetMs,
  hasInput,
  isLoading,
  phase,
  runtime
}: {
  activeMessageId: string | null;
  beginReveal: (maxRevealDurationMs: number) => void;
  completeActive: (messageId: string) => void;
  controller: AvatarController;
  explainRevealBudgetMs: number;
  hasInput: boolean;
  isLoading: boolean;
  phase: AssistantReplyPlaybackPhase;
  runtime: AvatarRuntime;
}) {
  const lastIssuedCommandRef = useRef<string | null>(null);
  const [startupPhase, setStartupPhase] = useState<"pending" | "requested" | "awaiting_settle" | "done">("pending");
  const speakingLoopReady = isLoopReadyForState(runtime, "speaking_explain");
  const settledOutOfExplain =
    runtime.currentState !== "speaking_explain" &&
    runtime.playbackKind === "loop" &&
    !runtime.isTransitioning;
  const warmLoopReady = isLoopReadyForState(runtime, "warm_friendly");
  const startupSettled =
    startupPhase === "awaiting_settle" &&
    runtime.currentState !== "warm_friendly" &&
    runtime.playbackKind === "loop" &&
    !runtime.isTransitioning;
  const hasActiveReplySession = Boolean(activeMessageId) && (
    phase === "awaiting_start" ||
    phase === "revealing" ||
    phase === "awaiting_settle"
  );
  const shouldSkipStartupWarm = isLoading || hasInput || hasActiveReplySession;

  useEffect(() => {
    if (startupPhase === "done") {
      return;
    }

    if (shouldSkipStartupWarm) {
      setStartupPhase("done");
      return;
    }

    if (startupPhase === "pending") {
      setStartupPhase("requested");
      return;
    }

    if (startupPhase === "requested" && warmLoopReady) {
      setStartupPhase("awaiting_settle");
      return;
    }

    if (startupSettled) {
      setStartupPhase("done");
    }
  }, [shouldSkipStartupWarm, startupPhase, startupSettled, warmLoopReady]);

  const desiredAvatarCommand = useMemo<AvatarCommand>(() => {
    if (isLoading) {
      return { key: "thinking", state: "thinking_process", shouldHold: true };
    }

    if (hasActiveReplySession && activeMessageId) {
      return { key: `speaking:${activeMessageId}`, state: "speaking_explain", shouldHold: false };
    }

    if (hasInput) {
      return { key: "listening", state: "listening_attentive", shouldHold: true };
    }

    if (startupPhase === "requested") {
      return { key: "startup-warm", state: "warm_friendly", shouldHold: false };
    }

    return { key: "idle", state: "idle_neutral", shouldHold: true };
  }, [activeMessageId, hasActiveReplySession, hasInput, isLoading, startupPhase]);

  useEffect(() => {
    if (!activeMessageId || phase !== "awaiting_start" || speakingLoopReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      beginReveal(explainRevealBudgetMs);
    }, START_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeMessageId, beginReveal, explainRevealBudgetMs, phase, speakingLoopReady]);

  useEffect(() => {
    if (!activeMessageId || phase !== "awaiting_start" || !speakingLoopReady) {
      return;
    }

    beginReveal(explainRevealBudgetMs);
  }, [activeMessageId, beginReveal, explainRevealBudgetMs, phase, speakingLoopReady]);

  useEffect(() => {
    if (!activeMessageId || phase !== "awaiting_settle") {
      return;
    }

    if (settledOutOfExplain) {
      completeActive(activeMessageId);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      completeActive(activeMessageId);
    }, SETTLE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeMessageId, completeActive, phase, settledOutOfExplain]);

  useEffect(() => {
    const commandReady = isLoopReadyForState(runtime, desiredAvatarCommand.state);
    if (commandReady) {
      lastIssuedCommandRef.current = desiredAvatarCommand.key;
      return;
    }

    if (startupPhase === "awaiting_settle" && desiredAvatarCommand.state === "idle_neutral") {
      return;
    }

    if (lastIssuedCommandRef.current === desiredAvatarCommand.key && isCommandInFlight(runtime, desiredAvatarCommand.state)) {
      return;
    }

    lastIssuedCommandRef.current = desiredAvatarCommand.key;
    controller.requestState(desiredAvatarCommand.state, {
      shouldHold: desiredAvatarCommand.shouldHold,
      isActiveTrigger: true
    });
  }, [controller, desiredAvatarCommand, runtime, startupPhase]);
}
