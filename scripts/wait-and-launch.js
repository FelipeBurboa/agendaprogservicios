// Wait for Vite dev server then launch Electron
const http = require("http");
const { execSync } = require("child_process");

function check() {
  http
    .get("http://localhost:5173", (res) => {
      res.resume();
      console.log("Vite ready, launching Electron...");
      execSync("npx electron .", { stdio: "inherit", cwd: process.cwd() });
    })
    .on("error", () => {
      setTimeout(check, 500);
    });
}

check();
