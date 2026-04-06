import type { AnchorState } from "./types";

export const ANCHOR_STATES: AnchorState[] = [
  "idle_neutral",
  "warm_friendly",
  "listening_attentive",
  "thinking_process",
  "speaking_explain",
  "positive_happy",
  "empathy_concern"
];

export const HIGH_PRIORITY_TRANSITIONS = [
  "tr_idle_neutral_to_warm_friendly",
  "tr_idle_neutral_to_listening_attentive",
  "tr_warm_friendly_to_listening_attentive",
  "tr_listening_attentive_to_thinking_process",
  "tr_thinking_process_to_speaking_explain",
  "tr_speaking_explain_to_positive_happy",
  "tr_listening_attentive_to_empathy_concern",
  "tr_warm_friendly_to_speaking_explain",
  "tr_idle_neutral_to_speaking_explain",
  "tr_idle_neutral_to_empathy_concern"
] as const;

export const STATE_LABELS: Record<AnchorState, string> = {
  idle_neutral: "待机",
  warm_friendly: "温和友好",
  listening_attentive: "专注倾听",
  thinking_process: "思考中",
  speaking_explain: "讲解中",
  positive_happy: "开心认可",
  empathy_concern: "共情关心"
};

export const STATE_BEHAVIOR: Record<
  AnchorState,
  {
    autoSettleTo: AnchorState | null;
    loopsBeforeAutoSettle: number | null;
  }
> = {
  idle_neutral: { autoSettleTo: null, loopsBeforeAutoSettle: null },
  warm_friendly: { autoSettleTo: "idle_neutral", loopsBeforeAutoSettle: 1 },
  listening_attentive: { autoSettleTo: null, loopsBeforeAutoSettle: null },
  thinking_process: { autoSettleTo: null, loopsBeforeAutoSettle: null },
  speaking_explain: { autoSettleTo: "idle_neutral", loopsBeforeAutoSettle: 1 },
  positive_happy: { autoSettleTo: "idle_neutral", loopsBeforeAutoSettle: 1 },
  empathy_concern: { autoSettleTo: "idle_neutral", loopsBeforeAutoSettle: 1 }
};

export function getSemanticMidCandidates(target: AnchorState): AnchorState[] {
  switch (target) {
    case "listening_attentive":
      return ["warm_friendly", "idle_neutral"];
    case "thinking_process":
      return ["listening_attentive", "idle_neutral"];
    case "speaking_explain":
      return ["warm_friendly", "idle_neutral"];
    case "positive_happy":
      return ["speaking_explain", "warm_friendly", "idle_neutral"];
    case "empathy_concern":
      return ["listening_attentive", "warm_friendly", "idle_neutral"];
    case "warm_friendly":
      return ["idle_neutral", "speaking_explain"];
    case "idle_neutral":
    default:
      return ["warm_friendly", "speaking_explain"];
  }
}
