import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ServiceMetadata = {
  service: string;
  version: string;
  environment: string;
};

type PackageMetadata = {
  name?: string;
  version?: string;
};

let cachedPackageMetadata: PackageMetadata | null = null;

function readPackageMetadata(): PackageMetadata {
  if (cachedPackageMetadata) {
    return cachedPackageMetadata;
  }

  try {
    const filePath = fileURLToPath(import.meta.url);
    const packagePath = resolve(dirname(filePath), "../../../package.json");
    const raw = readFileSync(packagePath, "utf8");
    const parsed = JSON.parse(raw) as PackageMetadata;
    cachedPackageMetadata = parsed;
    return parsed;
  } catch {
    cachedPackageMetadata = {};
    return cachedPackageMetadata;
  }
}

export function getServiceMetadata(): ServiceMetadata {
  const packageMetadata = readPackageMetadata();

  return {
    service: process.env.SERVICE_NAME || packageMetadata.name || "api",
    version: process.env.SERVICE_VERSION || packageMetadata.version || "0.0.0",
    environment: process.env.NODE_ENV || "development"
  };
}
