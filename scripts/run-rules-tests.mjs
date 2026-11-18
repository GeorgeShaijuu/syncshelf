import { spawn, spawnSync, execSync } from "child_process";
import fs from "fs";
import path from "path";

const emulatorJar = path.join(
  process.env.USERPROFILE || "",
  ".cache",
  "firebase",
  "emulators",
  "cloud-firestore-emulator-v1.22.0.jar"
);

if (!fs.existsSync(emulatorJar)) {
  console.error("Firestore emulator JAR not found at:", emulatorJar);
  process.exit(1);
}

function findJavaBinary() {
  const candidates = [
    "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot\\bin\\java.exe",
    process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "java.exe") : null,
    "java",
  ].filter(Boolean);

  for (const c of candidates) {
    if (c === "java" || fs.existsSync(c)) {
      return c;
    }
  }
  return "java";
}

const javaBin = findJavaBinary();
console.log(`[Test Runner] Using Java binary: ${javaBin}`);

console.log("[Test Runner] Starting Firestore emulator on 127.0.0.1:8080...");
const emulator = spawn(javaBin, [
  "-Dfile.encoding=UTF-8",
  "-jar",
  emulatorJar,
  "--host",
  "127.0.0.1",
  "--port",
  "8080",
  "--rules",
  "firestore.rules",
], {
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
emulator.stdout.on("data", (d) => {
  const str = d.toString();
  stdout += str;
  process.stdout.write(str);
});
emulator.stderr.on("data", (d) => {
  const str = d.toString();
  stderr += str;
  process.stderr.write(str);
});
emulator.on("error", (err) => {
  stderr += "\nSpawn error: " + err.message;
  console.error("[Test Runner] Spawn error:", err);
});

function killEmulator() {
  if (emulator && emulator.pid) {
    try {
      execSync(`taskkill /PID ${emulator.pid} /T /F`, { stdio: "ignore" });
    } catch {}
  }
}

process.on("exit", killEmulator);
process.on("SIGINT", () => { killEmulator(); process.exit(1); });
process.on("SIGTERM", () => { killEmulator(); process.exit(1); });

// Poll until emulator responds
async function waitForReady(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("http://127.0.0.1:8080/");
      if (res.ok || res.status === 200 || res.status === 404) {
        console.log("[Test Runner] Firestore emulator is ready!");
        return true;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Firestore emulator failed to become ready in time.\nOutput:\n" + stdout + "\n" + stderr);
}

try {
  await waitForReady();

  console.log("[Test Runner] Running Vitest security rules & realtime sync test suites...");
  const vitest = spawnSync("npx", [
    "vitest",
    "run",
    "--no-file-parallelism",
    "tests/firestore-rules-reads.test.ts",
    "tests/firestore-rules-writes.test.ts",
    "tests/realtime-sync.test.ts"
  ], {
    stdio: "inherit",
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    },
    shell: true,
  });

  process.exitCode = vitest.status ?? 0;
} catch (err) {
  console.error("[Test Runner] Error:", err);
  process.exitCode = 1;
} finally {
  console.log("[Test Runner] Stopping Firestore emulator...");
  killEmulator();
}
