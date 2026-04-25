import { execa } from "execa";
import { createConnection } from "node:net";
import type { MachineProfile } from "../types.js";

const VERSION_COMMANDS: Record<string, { cmd: string; args: string[]; parse: (output: string) => string | null }> = {
  node: {
    cmd: "node",
    args: ["--version"],
    parse: (out) => out.trim().replace(/^v/, ""),
  },
  npm: {
    cmd: "npm",
    args: ["--version"],
    parse: (out) => out.trim(),
  },
  pnpm: {
    cmd: "pnpm",
    args: ["--version"],
    parse: (out) => out.trim(),
  },
  yarn: {
    cmd: "yarn",
    args: ["--version"],
    parse: (out) => out.trim(),
  },
  bun: {
    cmd: "bun",
    args: ["--version"],
    parse: (out) => out.trim(),
  },
  python: {
    cmd: "python3",
    args: ["--version"],
    parse: (out) => out.replace(/Python\s*/i, "").trim(),
  },
  pip: {
    cmd: "pip3",
    args: ["--version"],
    parse: (out) => out.match(/pip\s+([\d.]+)/)?.[1] || null,
  },
  docker: {
    cmd: "docker",
    args: ["--version"],
    parse: (out) => out.match(/Docker version\s+([\d.]+)/)?.[1] || null,
  },
  "docker-compose": {
    cmd: "docker",
    args: ["compose", "version"],
    parse: (out) => out.match(/v?([\d.]+)/)?.[1] || null,
  },
  git: {
    cmd: "git",
    args: ["--version"],
    parse: (out) => out.match(/git version\s+([\d.]+)/)?.[1] || null,
  },
  go: {
    cmd: "go",
    args: ["version"],
    parse: (out) => out.match(/go([\d.]+)/)?.[1] || null,
  },
  rust: {
    cmd: "rustc",
    args: ["--version"],
    parse: (out) => out.match(/rustc\s+([\d.]+)/)?.[1] || null,
  },
  java: {
    cmd: "java",
    args: ["--version"],
    parse: (out) => out.match(/"?([\d.]+)/)?.[1] || null,
  },
};

export async function getToolVersion(tool: string): Promise<string | null> {
  const config = VERSION_COMMANDS[tool];
  if (!config) return null;

  try {
    const result = await execa(config.cmd, config.args, { timeout: 5000 });
    const output = result.stdout || result.stderr;
    return config.parse(output);
  } catch {
    return null;
  }
}

const SERVICE_PORTS: Record<string, number> = {
  postgres: 5432,
  redis: 6379,
  mysql: 3306,
  mongo: 27017,
  rabbitmq: 5672,
  elasticsearch: 9200,
  minio: 9000,
};

export async function isServiceRunning(service: string): Promise<boolean> {
  const port = SERVICE_PORTS[service];
  if (!port) return false;

  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function profileMachine(): Promise<MachineProfile> {
  // Detect OS
  const platform = process.platform;
  const os: MachineProfile["os"] =
    platform === "darwin" ? "macos" : platform === "win32" ? "windows" : "linux";

  // Detect arch
  const arch: MachineProfile["arch"] = process.arch === "arm64" ? "arm64" : "x64";

  // Check all tool versions in parallel
  const toolNames = Object.keys(VERSION_COMMANDS);
  const versions = await Promise.all(toolNames.map((tool) => getToolVersion(tool)));

  const tools: Record<string, string | null> = {};
  for (let i = 0; i < toolNames.length; i++) {
    tools[toolNames[i]] = versions[i];
  }

  // Check common services in parallel
  const serviceNames = Object.keys(SERVICE_PORTS);
  const serviceStatuses = await Promise.all(
    serviceNames.map((svc) => isServiceRunning(svc))
  );

  const runningServices: Record<string, boolean> = {};
  for (let i = 0; i < serviceNames.length; i++) {
    runningServices[serviceNames[i]] = serviceStatuses[i];
  }

  return { os, arch, tools, runningServices };
}
