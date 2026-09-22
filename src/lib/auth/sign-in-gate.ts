import { PREVIEW_BEARER_GATE_GRACE_MS } from "./preview-bearer";

export type SignInGateState = "pending" | "signed_in" | "signed_out";

export type SignInGateInput = {
  isPending: boolean;
  hasUser: boolean;
  /**
   * Live-preview bearer is stored but useSession may not have reflected it yet.
   * Within {@link previewBearerAppliedAt} + grace, stay on pending instead of
   * bouncing to Continue with Google/X.
   */
  hasPreviewBearer?: boolean;
  /** Epoch ms when the bearer was last applied; null if none. */
  previewBearerAppliedAt?: number | null;
  /** Overrideable clock for tests. */
  nowMs?: number;
  /** Overrideable grace window for tests. */
  bearerGraceMs?: number;
};

export function resolveSignInGateState(
  input: SignInGateInput,
): SignInGateState {
  if (input.isPending) return "pending";
  if (input.hasUser) return "signed_in";
  const appliedAt = input.previewBearerAppliedAt;
  const grace = input.bearerGraceMs ?? PREVIEW_BEARER_GATE_GRACE_MS;
  const now = input.nowMs ?? Date.now();
  if (
    input.hasPreviewBearer &&
    appliedAt != null &&
    now - appliedAt < grace
  ) {
    return "pending";
  }
  return "signed_out";
}
