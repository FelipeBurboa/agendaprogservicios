import { app, BrowserWindow, Menu } from "electron";
import * as path from "path";
import { registerIpcHandlers } from "./ipc-handlers";
import { registerImporterIpcHandlers } from "./importer-ipc";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 880,
    minWidth: 560,
    minHeight: 720,
    resizable: true,
    maximizable: true,
    fullscreenable: false,
    title: "VentaPlay - AgendaPro",
    backgroundColor: "#0E0B16",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);

  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "..", "..", "dist-renderer", "index.html"),
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  registerImporterIpcHandlers();
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

