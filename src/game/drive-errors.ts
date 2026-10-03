/** ドライブの失敗を、実際に何が起きたかが分かる日本語にする（純粋関数）。 */

export type DriveFailureKind =
  | "login"
  | "not_connected"
  | "scope_denied"
  | "access_denied"
  | "error";

/** ゲートからドライブ用トークンが届いていない（Safari等の問題ではなく、アプリ側が受け取れていない）。 */
export function isMissingTokenDetail(detail?: string | null): boolean {
  const raw = (detail ?? "").toLowerCase();
  return raw.includes("missing_connector_token") || raw.includes("missing connector token");
}

/** 認証が必要と返ってきた理由を、ゲートが返した文言から推定する。 */
export function describeLoginProblem(detail?: string | null): string {
  const raw = (detail ?? "").toLowerCase();
  if (isMissingTokenDetail(detail)) {
    return "このアプリにGrokからドライブのアクセスが届いていません（トークンなし）。ブラウザの問題ではありません。「JSONを読む」とダウンロードは使えます。";
  }
  if (raw.includes("scope") || raw.includes("insufficient")) {
    return "Googleドライブの読み取り権限が足りません。許可画面でドライブにチェックを入れてください。";
  }
  if (raw.includes("expired") || raw.includes("invalid_grant") || raw.includes("revoked")) {
    return "Googleの許可が切れています。もう一度許可してください。";
  }
  return "Googleの許可がまだこのアプリに反映されていません。";
}

export function driveFailureMessage(kind: DriveFailureKind, detail?: string | null): string {
  switch (kind) {
    case "login":
      return describeLoginProblem(detail);
    case "not_connected":
      return "Googleドライブが接続されていません。Grokの設定でGoogleドライブを接続してください。";
    case "scope_denied":
      return "このアプリにはドライブを読む許可が付いていません（権限の範囲外）。";
    case "access_denied":
      return "このドライブ（または万象陣記フォルダ）への権限がありません。";
    default: {
      const d = (detail ?? "").trim();
      return d ? `ドライブを読めなかった（${d.slice(0, 120)}）。` : "ドライブを読めなかった。";
    }
  }
}

/** 許可のあと続かなかったときの文言。理由＋次の操作。 */
export function stalledMessage(
  again: string,
  detail: string | null | undefined,
  willReauth: boolean,
): string {
  const why = describeLoginProblem(detail);
  // トークンなしは、許可を取り直しても直らない。説明だけ返す。
  if (isMissingTokenDetail(detail)) return why;
  return willReauth
    ? `${why}もう一度「${again}」を押すと、Googleの許可画面を開き直します。`
    : `${why}少し待ってからもう一度「${again}」を押してください。`;
}

/** ドライブ失敗の最小形（DriveCatalogResult の失敗側）。 */
export type DriveFailureLike = {
  ok: false;
  kind: DriveFailureKind;
  message: string;
  loginRequired?: boolean;
  detail?: string;
};

/** 許可直後の反映待ちとして再試行してよい失敗か（トークンなしは待っても直らない）。 */
export function isRetryableLogin(r: { ok: boolean; loginRequired?: boolean; detail?: string }): boolean {
  return !r.ok && !!r.loginRequired && !isMissingTokenDetail(r.detail);
}

/** ステータス行に添える、ごく短い失敗理由。 */
export function shortDriveReason(f: DriveFailureLike): string {
  if (isMissingTokenDetail(f.detail)) return "Grokからドライブのアクセスが届いていない";
  if (f.loginRequired || f.kind === "login") return "ドライブの許可が未反映";
  switch (f.kind) {
    case "not_connected":
      return "ドライブ未接続";
    case "scope_denied":
      return "権限の範囲外";
    case "access_denied":
      return "フォルダの権限なし";
    default: {
      const d = (f.detail ?? "").trim();
      return d ? d.slice(0, 60) : "ドライブに書けなかった";
    }
  }
}
