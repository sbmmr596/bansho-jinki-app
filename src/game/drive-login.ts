import { redirectToLoginIfRequired } from "@/lib/app-data/login.ts";
import {
  loginUrlWithDriveResume,
  markDriveAuthAttempt,
  markDriveResume,
  type DriveResumeAction,
} from "@/game/drive-resume";

/** Send the user to Google, then continue this same Drive action after return. */
export function redirectForDriveLogin(loginUrl: string, action: DriveResumeAction): void {
  markDriveResume(action);
  markDriveAuthAttempt(action);
  redirectToLoginIfRequired({
    ok: false,
    data: null,
    loginRequired: true,
    loginUrl: loginUrlWithDriveResume(loginUrl, action),
  });
}
