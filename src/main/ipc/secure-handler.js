import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * One security boundary for every renderer -> main IPC handler.  The router
 * is dependency-injected so it can be exercised without importing Electron's
 * singleton in unit tests and so the main module remains lifecycle-focused.
 */
export function createSecureIpcRouter({ ipcMain, getMainWindow, rendererFile }) {
  if (!ipcMain || typeof ipcMain.handle !== "function") throw new Error("ipcMain.handle is required");
  const expected = path.resolve(rendererFile);

  function assertSender(event) {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed?.() || event.sender !== mainWindow.webContents)
      throw new Error("IPC sender is not the application renderer.");
    if (event.senderFrame && event.senderFrame.top !== event.senderFrame)
      throw new Error("IPC calls are restricted to the top-level application frame.");
    const senderUrl = event.senderFrame?.url || event.sender.getURL();
    let senderPath;
    try {
      const parsed = new URL(senderUrl);
      if (parsed.protocol !== "file:") throw new Error();
      senderPath = path.resolve(fileURLToPath(parsed));
    } catch {
      throw new Error("IPC sender URL is not trusted.");
    }
    if (process.platform === "win32") {
      if (senderPath.toLowerCase() !== expected.toLowerCase()) throw new Error("IPC sender URL is not trusted.");
    } else if (senderPath !== expected) throw new Error("IPC sender URL is not trusted.");
  }

  function handle(channel, callback) {
    if (typeof channel !== "string" || !channel) throw new Error("IPC channel is required");
    if (typeof callback !== "function") throw new Error(`IPC callback is required for ${channel}`);
    ipcMain.handle(channel, async (event, payload) => {
      assertSender(event);
      return callback(payload, event);
    });
  }

  return Object.freeze({ assertSender, handle });
}

export default createSecureIpcRouter;
