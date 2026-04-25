import { readFile, access } from "node:fs/promises";
import { join, basename } from "node:path";
import { glob } from "node:fs/promises";
import type { RepoRequirements, Service, EnvVar } from "../types.js";

async function readFileIfExists(path: string): Promise<string | null> {
  try {
    await access(path);
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

function parsePackageJson(content: string): Partial<RepoRequirements> {
  const pkg = JSON.parse(content);
  const result: Partial<RepoRequirements> = {};

  // Node version from engines
  if (pkg.engines?.node) {
    result.node = pkg.engines.node;
  }

  // Package manager from packageManager field
  if (pkg.packageManager) {
    const match = pkg.packageManager.match(/^(npm|pnpm|yarn|bun)@(.+)$/);
    if (match) {
      result.packageManager = match[1] as RepoRequirements["packageManager"];
      result.packageManagerVersion = match[2];
    }
  }

  // Scripts
  if (pkg.scripts) {
    result.scripts = {};
    for (const key of ["dev", "build", "start", "test", "lint", "db:migrate", "db:push", "db:seed", "postinstall", "prepare"]) {
      if (pkg.scripts[key]) {
        result.scripts[key] = pkg.scripts[key];
      }
    }
  }

  // Detect frameworks from dependencies
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const frameworks: string[] = [];
  const frameworkMap: Record<string, string> = {
    next: "next",
    nuxt: "nuxt",
    react: "react",
    vue: "vue",
    svelte: "svelte",
    "@angular/core": "angular",
    express: "express",
    hono: "hono",
    fastify: "fastify",
    prisma: "prisma",
    drizzle: "drizzle",
    "@drizzle-team/drizzle-orm": "drizzle",
    tailwindcss: "tailwind",
    vite: "vite",
    webpack: "webpack",
    typescript: "typescript",
  };

  for (const [dep, name] of Object.entries(frameworkMap)) {
    if (allDeps[dep]) {
      frameworks.push(name);
    }
  }
  if (frameworks.length > 0) {
    result.frameworks = frameworks;
  }

  return result;
}

function parseDockerCompose(content: string): Service[] {
  const services: Service[] = [];
  // Simple YAML parsing for docker-compose services
  const serviceBlocks = content.match(/^\s{2}(\w[\w-]*):\s*$/gm);
  if (!serviceBlocks) return services;

  const serviceMap: Record<string, { image?: string; ports?: string }> = {};
  const lines = content.split("\n");
  let currentService: string | null = null;

  for (const line of lines) {
    const svcMatch = line.match(/^  ([\w][\w-]*):\s*$/);
    if (svcMatch) {
      currentService = svcMatch[1];
      serviceMap[currentService] = {};
      continue;
    }
    if (currentService && line.match(/^\s{4}image:\s*(.+)/)) {
      serviceMap[currentService].image = line.match(/^\s{4}image:\s*(.+)/)![1].trim();
    }
    if (currentService && line.match(/^\s{6}-\s*["']?(\d+):(\d+)/)) {
      serviceMap[currentService].ports = line.match(/(\d+):(\d+)/)![0];
    }
  }

  const knownServices: Record<string, string> = {
    postgres: "postgres",
    postgresql: "postgres",
    pg: "postgres",
    redis: "redis",
    mysql: "mysql",
    mariadb: "mysql",
    mongo: "mongo",
    mongodb: "mongo",
    rabbitmq: "rabbitmq",
    elasticsearch: "elasticsearch",
    minio: "minio",
  };

  for (const [name, info] of Object.entries(serviceMap)) {
    const lowerName = name.toLowerCase();
    const imageName = info.image?.toLowerCase() || "";

    let serviceName: string | null = null;
    for (const [key, val] of Object.entries(knownServices)) {
      if (lowerName.includes(key) || imageName.includes(key)) {
        serviceName = val;
        break;
      }
    }

    if (serviceName) {
      const versionMatch = info.image?.match(/:(\d+[\d.]*)/);
      const portMatch = info.ports?.match(/(\d+):\d+/);
      services.push({
        name: serviceName,
        version: versionMatch?.[1],
        port: portMatch ? parseInt(portMatch[1]) : undefined,
        fromDocker: true,
      });
    }
  }

  return services;
}

function parseEnvExample(content: string): EnvVar[] {
  const vars: EnvVar[] = [];
  const secretPatterns = /key|secret|token|password|auth|api_key|apikey|credential|private/i;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      const value = match[2].replace(/^["']|["']$/g, "");
      vars.push({
        key,
        example: value || undefined,
        required: !value, // empty value = probably required to fill in
        isSecret: secretPatterns.test(key),
      });
    }
  }

  return vars;
}

function parsePyprojectToml(content: string): Partial<RepoRequirements> {
  const result: Partial<RepoRequirements> = {};

  const pythonMatch = content.match(/requires-python\s*=\s*"([^"]+)"/);
  if (pythonMatch) {
    result.python = pythonMatch[1];
  }

  return result;
}

function parseNodeVersionFile(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;
  // Could be "v20.11.0", "20", "20.11.0", "lts/*"
  const match = trimmed.match(/v?(\d+[\d.]*)/);
  return match ? `>=${match[1]}` : undefined;
}

export async function scanRepo(repoPath: string): Promise<RepoRequirements> {
  const result: RepoRequirements = {};

  // Read all relevant files in parallel
  const [
    packageJsonRaw,
    dockerComposeRaw,
    dockerComposeYamlRaw,
    envExampleRaw,
    dockerfileRaw,
    pyprojectRaw,
    nvmrcRaw,
    nodeVersionRaw,
    toolVersionsRaw,
    pnpmLockRaw,
    yarnLockRaw,
    packageLockRaw,
    bunLockRaw,
  ] = await Promise.all([
    readFileIfExists(join(repoPath, "package.json")),
    readFileIfExists(join(repoPath, "docker-compose.yml")),
    readFileIfExists(join(repoPath, "docker-compose.yaml")),
    readFileIfExists(join(repoPath, ".env.example")),
    readFileIfExists(join(repoPath, "Dockerfile")),
    readFileIfExists(join(repoPath, "pyproject.toml")),
    readFileIfExists(join(repoPath, ".nvmrc")),
    readFileIfExists(join(repoPath, ".node-version")),
    readFileIfExists(join(repoPath, ".tool-versions")),
    readFileIfExists(join(repoPath, "pnpm-lock.yaml")),
    readFileIfExists(join(repoPath, "yarn.lock")),
    readFileIfExists(join(repoPath, "package-lock.json")),
    readFileIfExists(join(repoPath, "bun.lockb")),
  ]);

  // package.json
  if (packageJsonRaw) {
    Object.assign(result, parsePackageJson(packageJsonRaw));
  }

  // Docker compose
  const composeContent = dockerComposeRaw || dockerComposeYamlRaw;
  if (composeContent) {
    result.dockerCompose = true;
    result.services = parseDockerCompose(composeContent);
  }

  // .env.example
  if (envExampleRaw) {
    result.envVars = parseEnvExample(envExampleRaw);
  }

  // Dockerfile
  if (dockerfileRaw) {
    result.dockerfile = true;
    // Extract node version from Dockerfile base image
    if (!result.node) {
      const nodeMatch = dockerfileRaw.match(/FROM\s+node:(\d+[\d.]*)/i);
      if (nodeMatch) {
        result.node = `>=${nodeMatch[1]}`;
      }
    }
  }

  // pyproject.toml
  if (pyprojectRaw) {
    Object.assign(result, parsePyprojectToml(pyprojectRaw));
  }

  // Node version files
  if (!result.node) {
    const versionContent = nvmrcRaw || nodeVersionRaw;
    if (versionContent) {
      result.node = parseNodeVersionFile(versionContent);
    }
  }

  // .tool-versions (asdf)
  if (toolVersionsRaw) {
    const nodeMatch = toolVersionsRaw.match(/^nodejs\s+(.+)$/m);
    if (nodeMatch && !result.node) {
      result.node = `>=${nodeMatch[1].trim()}`;
    }
    const pythonMatch = toolVersionsRaw.match(/^python\s+(.+)$/m);
    if (pythonMatch && !result.python) {
      result.python = `>=${pythonMatch[1].trim()}`;
    }
  }

  // Detect package manager from lockfiles if not set
  if (!result.packageManager) {
    if (pnpmLockRaw !== null) result.packageManager = "pnpm";
    else if (yarnLockRaw !== null) result.packageManager = "yarn";
    else if (bunLockRaw !== null) result.packageManager = "bun";
    else if (packageLockRaw !== null) result.packageManager = "npm";
  }

  return result;
}
