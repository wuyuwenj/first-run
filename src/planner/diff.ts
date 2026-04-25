// T3: Planner — compare repo requirements vs machine profile, generate setup plan

import type { RepoRequirements, MachineProfile, SetupPlan, SetupStep } from "../types.js";
import type { Contradiction } from "../scanner/requirements.js";

export function generatePlan(
  requirements: RepoRequirements,
  machine: MachineProfile,
  contradictions: Contradiction[]
): SetupPlan {
  const steps: SetupStep[] = [];
  let nextId = 1;

  const addStep = (name: string, command: string, why: string, check?: string): void => {
    steps.push({
      id: nextId++,
      name,
      command,
      why,
      check,
      status: "pending",
    });
  };

  const packageManager = requirements.packageManager ?? detectPreferredPackageManager(machine);
  const packageManagerVersion = requirements.packageManagerVersion ?? "latest";

  if (requirements.node && !versionSatisfies(machine.tools.node, requirements.node)) {
    addStep(
      "Install Node.js",
      getInstallCommand("node", requirements.node, machine.os),
      `Project requires Node ${requirements.node}, but this machine has ${machine.tools.node ?? "no Node installation"}.`,
      "node --version"
    );
  }

  if (requirements.python && !versionSatisfies(machine.tools.python, requirements.python)) {
    addStep(
      "Install Python",
      getInstallCommand("python", requirements.python, machine.os),
      `Project requires Python ${requirements.python}, but this machine has ${machine.tools.python ?? "no Python installation"}.`,
      "python --version"
    );
  }

  if (packageManager && !versionSatisfies(machine.tools[packageManager], packageManagerVersion)) {
    addStep(
      `Install ${packageManager}`,
      getInstallCommand(packageManager, packageManagerVersion, machine.os),
      `${packageManager} is required to install project dependencies.`,
      `${packageManager} --version`
    );
  }

  const needsDocker =
    requirements.dockerCompose === true ||
    requirements.dockerfile === true ||
    (requirements.services ?? []).some((service) => service.fromDocker);

  if (needsDocker && machine.tools.docker == null) {
    addStep(
      "Install Docker",
      getInstallCommand("docker", "latest", machine.os),
      "Docker is needed for this repository's containers or docker-compose services.",
      "docker --version"
    );
  }

  if ((requirements.envVars?.length ?? 0) > 0) {
    addStep(
      "Create .env file",
      "cp .env.example .env",
      "Seed local environment variables from the example file.",
      "test -f .env"
    );
  }

  if ((requirements.services?.length ?? 0) > 0) {
    const services = requirements.services ?? [];
    const dockerServices = services.filter((service) => service.fromDocker);
    const localServices = services.filter((service) => !service.fromDocker);

    if (dockerServices.length > 0) {
      addStep(
        "Start Docker services",
        "docker compose up -d",
        `Start containerized services: ${dockerServices.map((service) => service.name).join(", ")}.`,
        "docker compose ps"
      );
    }

    for (const service of localServices) {
      if (machine.runningServices[service.name]) {
        continue;
      }

      const installVersion = service.version ?? "latest";
      if (machine.tools[service.name] == null) {
        addStep(
          `Install ${service.name}`,
          getInstallCommand(service.name, installVersion, machine.os),
          `${service.name} is required by the repository services configuration.`,
          getVersionCheckCommand(service.name)
        );
      }

      addStep(
        `Start ${service.name}`,
        getServiceStartCommand(service.name, machine.os),
        `${service.name} must be running for local development.`,
        getServiceCheckCommand(service)
      );
    }
  }

  if (packageManager) {
    addStep(
      "Install JavaScript dependencies",
      `${packageManager} install`,
      `Install the repository dependencies using ${packageManager}.`
    );
  }

  if (requirements.python) {
    addStep(
      "Install Python dependencies",
      "python -m pip install -e .",
      "Install Python dependencies from the project metadata.",
      "python -m pip --version"
    );
  }

  const scriptSteps = buildScriptSteps(requirements, packageManager);
  for (const scriptStep of scriptSteps) {
    addStep(scriptStep.name, scriptStep.command, scriptStep.why, scriptStep.check);
  }

  const verificationStep = buildVerificationStep(requirements, packageManager);
  if (verificationStep) {
    addStep(verificationStep.name, verificationStep.command, verificationStep.why, verificationStep.check);
  }

  const warnings = contradictions.map((contradiction) => {
    const sources = contradiction.sources.map((source) => `${source.file}=${source.value}`).join(", ");
    return `${contradiction.field}: ${sources}. Recommended: ${contradiction.recommendation}`;
  });

  return { steps, warnings };
}

export function getInstallCommand(
  tool: string,
  version: string,
  os: "macos" | "linux" | "windows"
): string {
  const normalizedTool = tool.toLowerCase();
  const normalizedVersion = normalizeRequestedVersion(version);

  if (normalizedTool === "npm") {
    return getInstallCommand("node", version, os);
  }

  if (normalizedTool === "pnpm" || normalizedTool === "yarn") {
    const target = normalizedVersion === "latest" ? normalizedTool : `${normalizedTool}@${normalizedVersion}`;
    return `corepack enable && corepack prepare ${target} --activate`;
  }

  if (normalizedTool === "bun") {
    if (os === "windows") {
      return "powershell -c \"irm bun.sh/install.ps1 | iex\"";
    }

    return "curl -fsSL https://bun.sh/install | bash";
  }

  if (normalizedTool === "docker") {
    if (os === "macos") {
      return "brew install --cask docker";
    }

    if (os === "linux") {
      return "sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin";
    }

    return "winget install Docker.DockerDesktop";
  }

  if (normalizedTool === "docker-compose") {
    if (os === "macos") {
      return "brew install docker-compose";
    }

    if (os === "linux") {
      return "sudo apt-get update && sudo apt-get install -y docker-compose-plugin";
    }

    return "winget install Docker.DockerDesktop";
  }

  if (normalizedTool === "node") {
    if (os === "macos") {
      return normalizedVersion === "latest"
        ? "brew install node"
        : `brew install node@${majorVersion(normalizedVersion)}`;
    }

    if (os === "linux") {
      return "sudo apt-get update && sudo apt-get install -y nodejs npm";
    }

    return "winget install OpenJS.NodeJS";
  }

  if (normalizedTool === "python" || normalizedTool === "pip") {
    if (os === "macos") {
      return normalizedVersion === "latest"
        ? "brew install python"
        : `brew install python@${majorMinorVersion(normalizedVersion)}`;
    }

    if (os === "linux") {
      return "sudo apt-get update && sudo apt-get install -y python3 python3-pip";
    }

    return "winget install Python.Python.3";
  }

  if (normalizedTool === "postgres" || normalizedTool === "postgresql") {
    if (os === "macos") {
      return "brew install postgresql";
    }

    if (os === "linux") {
      return "sudo apt-get update && sudo apt-get install -y postgresql";
    }

    return "winget install PostgreSQL.PostgreSQL";
  }

  if (normalizedTool === "redis") {
    if (os === "macos") {
      return "brew install redis";
    }

    if (os === "linux") {
      return "sudo apt-get update && sudo apt-get install -y redis-server";
    }

    return "winget install Memurai.MemuraiDeveloper";
  }

  if (normalizedTool === "mysql") {
    if (os === "macos") {
      return "brew install mysql";
    }

    if (os === "linux") {
      return "sudo apt-get update && sudo apt-get install -y mysql-server";
    }

    return "winget install Oracle.MySQL";
  }

  if (os === "macos") {
    return "brew install " + normalizedTool;
  }

  if (os === "linux") {
    return `sudo apt-get update && sudo apt-get install -y ${normalizedTool}`;
  }

  return `winget install ${normalizedTool}`;
}

function detectPreferredPackageManager(machine: MachineProfile): RepoRequirements["packageManager"] {
  const order: RepoRequirements["packageManager"][] = ["pnpm", "yarn", "bun", "npm"];

  for (const candidate of order) {
    if (candidate && machine.tools[candidate]) {
      return candidate;
    }
  }

  return "npm";
}

function buildScriptSteps(
  requirements: RepoRequirements,
  packageManager: RepoRequirements["packageManager"]
): Array<Pick<SetupStep, "name" | "command" | "why" | "check">> {
  if (!packageManager || !requirements.scripts) {
    return [];
  }

  const scripts = requirements.scripts;
  const candidates = [
    { key: "db:generate", name: "Generate database client", why: "Generate database client artifacts used by the app." },
    { key: "prisma:generate", name: "Generate Prisma client", why: "Generate Prisma client artifacts used by the app." },
    { key: "generate", name: "Run code generation", why: "Generate project artifacts before running the app." },
    { key: "db:migrate", name: "Run database migrations", why: "Apply schema changes required by the app." },
    { key: "migrate", name: "Run migrations", why: "Apply required database migrations." },
    { key: "migrate:dev", name: "Run development migrations", why: "Apply development database migrations." },
    { key: "prisma:migrate", name: "Run Prisma migrations", why: "Apply Prisma-managed database migrations." },
    { key: "build", name: "Build the project", why: "Verify the repository compiles successfully." },
  ];

  const steps: Array<Pick<SetupStep, "name" | "command" | "why" | "check">> = [];

  for (const candidate of candidates) {
    if (!(candidate.key in scripts)) {
      continue;
    }

    steps.push({
      name: candidate.name,
      command: getRunScriptCommand(packageManager, candidate.key),
      why: candidate.why,
    });
  }

  return steps;
}

function buildVerificationStep(
  requirements: RepoRequirements,
  packageManager: RepoRequirements["packageManager"]
): Pick<SetupStep, "name" | "command" | "why" | "check"> | null {
  if (requirements.services?.some((service) => service.port != null)) {
    const ports = requirements.services
      .filter((service) => service.port != null)
      .map((service) => service.port)
      .join(" ");

    return {
      name: "Verify service ports",
      command: `for port in ${ports}; do lsof -iTCP:$port -sTCP:LISTEN; done`,
      why: "Confirm required local services are listening on their expected ports.",
    };
  }

  if (packageManager && requirements.scripts?.build) {
    return {
      name: "Verify build",
      command: getRunScriptCommand(packageManager, "build"),
      why: "Run a final build to verify the repository is ready.",
    };
  }

  if (packageManager && requirements.scripts?.dev) {
    return {
      name: "Start the dev server",
      command: getRunScriptCommand(packageManager, "dev"),
      why: "Start the development server as a final verification step.",
    };
  }

  return null;
}

function getRunScriptCommand(packageManager: NonNullable<RepoRequirements["packageManager"]>, script: string): string {
  if (packageManager === "yarn") {
    return `yarn ${script}`;
  }

  if (packageManager === "bun") {
    return `bun run ${script}`;
  }

  return `${packageManager} run ${script}`;
}

function getServiceStartCommand(service: string, os: MachineProfile["os"]): string {
  if (os === "macos") {
    return `brew services start ${service}`;
  }

  if (os === "linux") {
    const linuxService = service === "postgres" ? "postgresql" : service;
    return `sudo systemctl start ${linuxService}`;
  }

  return `net start ${service}`;
}

function getServiceCheckCommand(service: NonNullable<RepoRequirements["services"]>[number]): string {
  if (service.port != null) {
    return `lsof -iTCP:${service.port} -sTCP:LISTEN`;
  }

  if (service.fromDocker) {
    return "docker compose ps";
  }

  const normalizedService = service.name === "postgres" ? "postgresql" : service.name;
  return `${normalizedService} --version`;
}

function getVersionCheckCommand(tool: string): string {
  if (tool === "postgres") {
    return "psql --version";
  }

  return `${tool} --version`;
}

function versionSatisfies(installedVersion: string | null | undefined, requiredVersion: string | null | undefined): boolean {
  if (!requiredVersion) {
    return true;
  }

  if (!installedVersion) {
    return false;
  }

  const installed = parseVersion(installedVersion);
  const required = parseVersion(requiredVersion);

  if (required.length === 0 || installed.length === 0) {
    return installedVersion.includes(requiredVersion);
  }

  if (requiredVersion.includes(">=")) {
    return compareVersions(installed, required) >= 0;
  }

  if (requiredVersion.includes("<=")) {
    return compareVersions(installed, required) <= 0;
  }

  if (requiredVersion.includes(">")) {
    return compareVersions(installed, required) > 0;
  }

  if (requiredVersion.includes("<")) {
    return compareVersions(installed, required) < 0;
  }

  if (requiredVersion.startsWith("^") || requiredVersion.startsWith("~")) {
    return installed[0] === required[0];
  }

  return compareVersions(installed, required) >= 0;
}

function compareVersions(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

function parseVersion(value: string): number[] {
  const matches = value.match(/\d+/g);
  return matches ? matches.map((match) => Number.parseInt(match, 10)) : [];
}

function normalizeRequestedVersion(value: string): string {
  const matches = value.match(/\d+(?:\.\d+)*/);
  return matches?.[0] ?? "latest";
}

function majorVersion(value: string): string {
  return normalizeRequestedVersion(value).split(".")[0] ?? value;
}

function majorMinorVersion(value: string): string {
  const parts = normalizeRequestedVersion(value).split(".");
  return parts.slice(0, 2).join(".") || value;
}
