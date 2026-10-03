import { shortDriveReason, type DriveFailureLike } from "@/game/drive-errors";

type SaveOk = { ok: true; status?: string; message?: string };

export type ExportOutcome =
  | { via: "drive"; message: string }
  | { via: "local"; message: string }
  | { via: "failed"; message: string };

export const LOCAL_SAVED_MESSAGE = "端末にダウンロードした（chars.json）。";

/** ドライブ書き出しが失敗したときの、端末ダウンロード後のステータス文。 */
export function localFallbackMessage(reason: string): string {
  return `ドライブに書けなかったため、端末にダウンロードした（chars.json）。理由：${reason}。`;
}

/**
 * 「JSONを書き出す」: まずドライブ。失敗（要ログイン・トークンなし・その他すべて）なら
 * 自動で端末ダウンロードに切り替える。どちらでも行き止まりにしない。
 */
export async function exportWithFallback(deps: {
  saveDrive: () => Promise<SaveOk | DriveFailureLike>;
  download: () => void;
}): Promise<ExportOutcome> {
  let reason: string;
  try {
    const result = await deps.saveDrive();
    if (result.ok) {
      const msg = (result as SaveOk).status === "saved" ? (result as SaveOk).message : undefined;
      return { via: "drive", message: msg || "ドライブに書き出した。" };
    }
    reason = shortDriveReason(result);
  } catch {
    reason = "ドライブに届かなかった";
  }
  try {
    deps.download();
  } catch {
    return {
      via: "failed",
      message: `ドライブに書けず（${reason}）、ダウンロードも失敗した。もう一度「ダウンロード」を押してね。`,
    };
  }
  return { via: "local", message: localFallbackMessage(reason) };
}
