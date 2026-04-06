import { STATE_BEHAVIOR } from "./avatarConfig";
import { LoopScheduler } from "./loopScheduler";
import { RoutePlanner } from "./routePlanner";
import type {
  AnchorState,
  AvatarManifest,
  AvatarRenderModel,
  AvatarRuntime,
  ClipAsset,
  PlayDirection,
  TransitionLeg
} from "./types";

type StateRequestOptions = {
  shouldHold?: boolean;
};

type CreateAvatarControllerArgs = {
  manifest: AvatarManifest;
  onRuntimeChange: (runtime: AvatarRuntime) => void;
};

export type AvatarController = ReturnType<typeof createAvatarController>;

function withPlaybackToken(src: string, token: number) {
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}playback=${token}`;
}

function makeRenderModel(
  asset: ClipAsset,
  direction: PlayDirection,
  playbackKind: "loop" | "transition",
  token: number
): AvatarRenderModel {
  const sourcePath = direction === "reverse" && asset.reverseSrc ? asset.reverseSrc : asset.src;
  return {
    mediaKind: "img",
    src: withPlaybackToken(sourcePath, token),
    key: `${asset.id}-${direction}-${token}`,
    assetId: asset.id,
    playbackKind,
    playDirection: direction
  };
}

export function createAvatarController({ manifest, onRuntimeChange }: CreateAvatarControllerArgs) {
  const loopScheduler = new LoopScheduler(manifest);
  const routePlanner = new RoutePlanner(manifest);

  const runtime: AvatarRuntime = {
    currentState: "idle_neutral",
    targetState: "idle_neutral",
    isTransitioning: false,
    playbackKind: "idle",
    playDirection: "forward",
    currentLoopAsset: null,
    currentTransitionAsset: null,
    pendingState: null,
    renderModel: null,
    recentLoopsByState: {},
    autoSettleTo: null,
    remainingLoopsBeforeAutoSettle: null,
    lastRouteDescription: "初始待机"
  };

  let playbackToken = 0;
  let timer: number | null = null;

  function emit() {
    onRuntimeChange({ ...runtime, recentLoopsByState: { ...runtime.recentLoopsByState } });
  }

  function stopTimer() {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function setTimer(ms: number, cb: () => void) {
    stopTimer();
    timer = window.setTimeout(cb, ms);
  }

  function applyLoopBehavior(state: AnchorState, options?: StateRequestOptions) {
    const behavior = STATE_BEHAVIOR[state];
    const shouldHold = options?.shouldHold ?? false;
    runtime.autoSettleTo = shouldHold ? null : behavior.autoSettleTo;
    runtime.remainingLoopsBeforeAutoSettle = shouldHold ? null : behavior.loopsBeforeAutoSettle;
  }

  function enterLoop(state: AnchorState, options?: StateRequestOptions) {
    runtime.currentState = state;
    runtime.targetState = state;
    runtime.isTransitioning = false;
    runtime.currentTransitionAsset = null;
    runtime.playbackKind = "loop";
    runtime.playDirection = "forward";
    applyLoopBehavior(state, options);

    const recentIds = runtime.recentLoopsByState[state] ?? [];
    const asset = loopScheduler.pickNext(state, recentIds);
    const shouldReuseCurrentLoop =
      state === "idle_neutral" &&
      runtime.playbackKind === "loop" &&
      runtime.currentLoopAsset?.id === asset.id &&
      runtime.renderModel !== null;
    runtime.currentLoopAsset = asset;
    if (!shouldReuseCurrentLoop) {
      playbackToken += 1;
      runtime.renderModel = makeRenderModel(asset, "forward", "loop", playbackToken);
    }
    loopScheduler.recordPlayed(runtime.recentLoopsByState, state, asset.id);

    emit();

    setTimer(asset.durationMs, () => {
      if (runtime.currentState !== state || runtime.isTransitioning) return;

      if (
        runtime.autoSettleTo &&
        runtime.remainingLoopsBeforeAutoSettle !== null &&
        runtime.remainingLoopsBeforeAutoSettle <= 1
      ) {
        requestState(runtime.autoSettleTo);
        return;
      }

      if (runtime.remainingLoopsBeforeAutoSettle !== null) {
        runtime.remainingLoopsBeforeAutoSettle -= 1;
      }

      enterLoop(state, options);
    });
  }

  function finishAfterTransitions(finalTarget: AnchorState, options?: StateRequestOptions) {
    runtime.isTransitioning = false;
    runtime.currentState = finalTarget;
    runtime.targetState = finalTarget;
    runtime.currentTransitionAsset = null;

    if (runtime.pendingState && runtime.pendingState !== finalTarget) {
      const pending = runtime.pendingState;
      runtime.pendingState = null;
      requestState(pending, options);
      return;
    }

    enterLoop(finalTarget, options);
  }

  function playTransitionLegs(legs: TransitionLeg[], finalTarget: AnchorState, options?: StateRequestOptions) {
    const [first, ...rest] = legs;
    if (!first) {
      finishAfterTransitions(finalTarget, options);
      return;
    }

    runtime.isTransitioning = true;
    runtime.playbackKind = "transition";
    runtime.playDirection = first.direction;
    runtime.currentTransitionAsset = first.asset;
    runtime.currentLoopAsset = null;
    playbackToken += 1;
    runtime.renderModel = makeRenderModel(first.asset, first.direction, "transition", playbackToken);
    emit();

    setTimer(first.asset.durationMs, () => {
      if (rest.length > 0) {
        playTransitionLegs(rest, finalTarget, options);
      } else {
        finishAfterTransitions(finalTarget, options);
      }
    });
  }

  function requestState(nextState: AnchorState, options?: StateRequestOptions) {
    if (runtime.isTransitioning) {
      if (runtime.pendingState === nextState) {
        return;
      }
      runtime.pendingState = nextState;
      emit();
      return;
    }

    if (runtime.currentState === nextState) {
      runtime.lastRouteDescription = `保持 ${nextState}`;
      runtime.targetState = nextState;

      if (runtime.playbackKind === "loop" && runtime.currentLoopAsset) {
        applyLoopBehavior(nextState, options);
        emit();
        return;
      }

      stopTimer();
      enterLoop(nextState, options);
      return;
    }

    stopTimer();

    const plan = routePlanner.plan(runtime.currentState, nextState);
    if (plan.kind === "same_state") {
      runtime.lastRouteDescription = `保持 ${nextState}`;
      enterLoop(nextState, options);
      return;
    }

    if (plan.kind === "direct_switch") {
      runtime.lastRouteDescription = `${runtime.currentState} -> ${nextState}（无合适过渡，直接切 loop）`;
      enterLoop(nextState, options);
      return;
    }

    runtime.lastRouteDescription = plan.legs
      .map((leg) => `${leg.from} -> ${leg.to}${leg.direction === "reverse" ? "（倒放）" : ""}`)
      .join(" -> ");
    playTransitionLegs(plan.legs, nextState, options);
  }

  function boot() {
    requestState("warm_friendly", { shouldHold: false });
  }

  function reset() {
    stopTimer();
    runtime.currentState = "idle_neutral";
    runtime.targetState = "idle_neutral";
    runtime.isTransitioning = false;
    runtime.playbackKind = "idle";
    runtime.playDirection = "forward";
    runtime.currentLoopAsset = null;
    runtime.currentTransitionAsset = null;
    runtime.pendingState = null;
    runtime.renderModel = null;
    runtime.autoSettleTo = null;
    runtime.remainingLoopsBeforeAutoSettle = null;
    runtime.lastRouteDescription = "重置到初始待机";
    emit();
    enterLoop("idle_neutral");
  }

  function dispose() {
    stopTimer();
  }

  return {
    runtime,
    requestState,
    boot,
    reset,
    dispose
  };
}
