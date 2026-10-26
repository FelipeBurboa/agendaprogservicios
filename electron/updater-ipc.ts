import { app, BrowserWindow, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";

/**
 * Auto-update wiring, GitHub Releases feed (publish config in package.json).
 *
 * Windows (NSIS, unsigned): full flow -- background download, banner in the
 * renderer, install on click or on next quit. Unsigned-to-unsigned NSIS
 * updates are allowed by electron-updater.
 *
 * macOS (unsigned/ad-hoc): Squirrel.Mac validates the code signature during
 * install, so quitAndInstall would always fail. The mac path is detect-only:
 * the renderer shows a banner whose button opens the .dmg download in the
 * browser.
 */

const RELEASES_LATEST_URL =
  "https://github.com/FelipeBurboa/agendaprogservicios/releases/latest";

/** Delay so the update check never competes with window startup. */
const CHECK_DELAY_MS = 5_000;

function send(channel: string, payload?: unknown): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

export function registerUpdaterIpcHandlers(): void {
  ipcMain.handle("updater:install", () => {
    // Silent + relaunch: the NSIS installer is assisted (oneClick: false), so a
    // non-silent run would walk the user through the setup pages again.
    autoUpdater.quitAndInstall(true, true);
  });

  ipcMain.handle("updater:open-download", (_event, url: string) => {
    // Only ever fed by updater:available payloads built below, but clamp to
    // this repo's releases anyway since it crosses the IPC boundary.
    const target =
      typeof url === "string" &&
      url.startsWith("https://github.com/FelipeBurboa/agendaprogservicios/")
        ? url
        : RELEASES_LATEST_URL;
    void shell.openExternal(target);
  });

  // Dev runs have no packaged feed and electron-updater errors out; the
  // handlers above stay registered so the bridge never rejects.
  if (!app.isPackaged) {
    return;
  }

  const isMac = process.platform === "darwin";

  autoUpdater.autoDownload = !isMac;
  autoUpdater.autoInstallOnAppQuit = !isMac;

  autoUpdater.on("update-available", (info) => {
    if (!isMac) return; // Windows waits for update-downloaded instead.

    const dmg = info.files?.find((file) => file.url.endsWith(".dmg"));
    const downloadUrl = dmg
      ? `https://github.com/FelipeBurboa/agendaprogservicios/releases/download/v${info.version}/${dmg.url}`
      : RELEASES_LATEST_URL;

    send("updater:available", { version: info.version, downloadUrl });
  });

  autoUpdater.on("update-downloaded", (info) => {
    send("updater:downloaded", { version: info.version });
  });

  autoUpdater.on("error", (error) => {
    // Updates must never break the tool: log and move on. The app keeps
    // working on its current version.
    console.error("[updater]", error?.message ?? error);
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch(() => {});
  }, CHECK_DELAY_MS);
}
