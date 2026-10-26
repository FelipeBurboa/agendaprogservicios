// Renders build/icon.svg to build/icon.png (1024x1024, transparent corners)
// with Electron's own Chromium, so no extra image tooling is needed.
//   npx electron scripts/render-icon.js
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const SIZE = 1024;
const svgPath = path.join(__dirname, "..", "build", "icon.svg");
const pngPath = path.join(__dirname, "..", "build", "icon.png");

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: { offscreen: true },
  });

  const svg = fs.readFileSync(svgPath, "utf8");
  // display:block + overflow:hidden keep inline-SVG baseline gaps from
  // producing scrollbars that would end up in the capture.
  const html = `<!doctype html><html><head><style>html,body{margin:0;overflow:hidden;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  // Give the offscreen compositor a frame to paint before capturing.
  await new Promise((resolve) => setTimeout(resolve, 500));

  let image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  if (image.getSize().width !== SIZE) image = image.resize({ width: SIZE, height: SIZE, quality: "best" });

  fs.writeFileSync(pngPath, image.toPNG());
  // BGRA bitmap: byte 3 is the top-left pixel's alpha, which must be 0 so the
  // tile's rounded corners stay transparent.
  const cornerAlpha = image.toBitmap()[3];
  console.log(`wrote ${pngPath} (${image.getSize().width}x${image.getSize().height}), corner alpha ${cornerAlpha}`);
  app.quit();
});
