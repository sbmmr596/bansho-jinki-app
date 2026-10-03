/** ドライブの失敗を、実際に何が起きたかが分かる日本語にする（純粋関数）。 */

export type DriveFailureKind =
  | "login"
  | "not_connected"
  | "scope_denied"
  | "access_denied"
  | "error";

/** 認証が必要と返ってきた理由を、ゲートが返した文言から推定する。 */
export function describeLoginProblem(detail?: string | null): string {
  const raw = (detail ?? "").toLowerCase();
  if (raw.includes("missing_connector_token") || raw.includes("missing connector token")) {
    return "ログイン情報がこのアプリに届いていません（トークンなし）。Safariなど通常のブラウザで開き直して試してください。";
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
  return willReauth
    ? `${why}もう一度「${again}」を押すと、Googleの許可画面を開き直します。`
    : `${why}少し待ってからもう一度「${again}」を押してください。`;
}
