/** 接続の診断。値は一切持たず、有無と名前だけ。 */
export type DriveDiag = {
  connectorToken: boolean;
  gateIdentity: boolean;
  cookieNames: string[];
  forwardedHost: string | null;
  host: string | null;
  connectorsHost: string | null;
  authSession: boolean | null;
};

const yn = (v: boolean | null) => (v === null ? "確認できず" : v ? "あり" : "なし");

/** スクリーンショット向けの平文の行。 */
export function formatDriveDiag(d: DriveDiag): string[] {
  return [
    `x-connector-access-token: ${yn(d.connectorToken)}`,
    `x-grok-identity: ${yn(d.gateIdentity)}`,
    `Cookie名: ${d.cookieNames.length ? d.cookieNames.join(", ") : "なし"}`,
    `x-forwarded-host: ${d.forwardedHost ?? "なし"}`,
    `host: ${d.host ?? "なし"}`,
    `コネクタ接続先: ${d.connectorsHost ?? "解決できず"}`,
    `ログインセッション: ${yn(d.authSession)}`,
  ];
}
