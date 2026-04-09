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

function isRuntimeReadyForCommand(runtime: AvatarRuntime, command: AvatarCommand) {
  if (runtime.currentState !== command.state || runtime.playbackKind !== "loop" || runtime.isTransitioning) {
    return false;
  }

  if (!command.shouldHold) {
    return true;
  }

  return runtime.renderModel?.loopMode === "repeat";
}

function isSameCommandStillInFlight(runtime: AvatarRuntime, command: AvatarCommand) {
  if (runtime.pendingState === command.state || runtime.targetState === command.state) {
    return true;
  }

  if (runtime.currentState !== command.state) {
    return false;
  }

  return runtime.isTransitioning;
}

export function useAvatarReplyCoordinator({
  activeMessageId,
  avatarRevealBudgetMs,
  beginReveal,
  completeActive,
  controller,
  hasInput,
  isLoading,
  phase,
  runtime
}: {
  activeMessageId: string | null;
  avatarRevealBudgetMs: number;
  beginReveal: (maxRevealDurationMs: number) => void;
  completeActive: (messageId: string) => void;
  controller: AvatarController;
  hasInput: boolean;
  isLoading: boolean;
  phase: AssistantReplyPlaybackPhase;
  runtime: AvatarRuntime;
}) {
  const lastIssuedCommandRef = useRef<string | null>(null);
  const [startupPhase, setStartupPhase] = useState<"pending" | "requested" | "awaiting_settle" | "done">("pending");
  const speakingLoopReady = isLoopReadyForState(runtime, "speaking_explain");
  const warmLoopReady = isLoopReadyForState(runtime, "warm_friendly");
  const startupSettled =
    startupPhase === "awaiting_settle" &&
    runtime.currentState !== "warm_friendly" &&
    runtime.playbackKind === "loop" &&
    !runtime.isTransitioning;
  const isReplySessionOpen = Boolean(activeMessageId) && (
    phase === "awaiting_start" ||
    phase === "revealing" ||
    phase === "awaiting_settle"
  );
  const shouldDriveSpeaking = Boolean(activeMessageId) && (
    phase === "awaiting_start" ||
    phase === "revealing"
  );
  const shouldSkipStartupWarm = isLoading || hasInput || isReplySessionOpen;

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

    if (shouldDriveSpeaking && activeMessageId) {
      return { key: `speaking:${activeMessageId}`, state: "speaking_explain", shouldHold: false };
    }

    if (hasInput) {
      return { key: "listening", state: "listening_attentive", shouldHold: true };
    }

    if (startupPhase === "requested") {
      return { key: "startup-warm", state: "warm_friendly", shouldHold: false };
    }

    return { key: "idle", state: "idle_neutral", shouldHold: true };
  }, [activeMessageId, hasInput, isLoading, shouldDriveSpeaking, startupPhase]);
  const settleCommandReady =
    phase === "awaiting_settle" &&
    desiredAvatarCommand.state !== "speaking_explain" &&
    isRuntimeReadyForCommand(runtime, desiredAvatarCommand);

  useEffect(() => {
    if (!activeMessageId || phase !== "awaiting_start" || speakingLoopReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      beginReveal(avatarRevealBudgetMs);
    }, START_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeMessageId, avatarRevealBudgetMs, beginReveal, phase, speakingLoopReady]);

  useEffect(() => {
    if (!activeMessageId || phase !== "awaiting_start" || !speakingLoopReady) {
      return;
    }

    beginReveal(avatarRevealBudgetMs);
  }, [activeMessageId, avatarRevealBudgetMs, beginReveal, phase, speakingLoopReady]);

  useEffect(() => {
    if (!activeMessageId || phase !== "awaiting_settle") {
      return;
    }

    if (settleCommandReady) {
      completeActive(activeMessageId);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      completeActive(activeMessageId);
    }, SETTLE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeMessageId, completeActive, phase, settleCommandReady]);

  useEffect(() => {
    const commandReady = isRuntimeReadyForCommand(runtime, desiredAvatarCommand);
    if (commandReady) {
      lastIssuedCommandRef.current = desiredAvatarCommand.key;
      return;
    }

    if (startupPhase === "awaiting_settle" && desiredAvatarCommand.state === "idle_neutral") {
      return;
    }

    if (lastIssuedCommandRef.current === desiredAvatarCommand.key && isSameCommandStillInFlight(runtime, desiredAvatarCommand)) {
      return;
    }

    lastIssuedCommandRef.current = desiredAvatarCommand.key;
    controller.requestState(desiredAvatarCommand.state, {
      shouldHold: desiredAvatarCommand.shouldHold,
      isActiveTrigger: true
    });
  }, [controller, desiredAvatarCommand, runtime, startupPhase]);
}
