import { getAuthStore } from "../auth/authStore.js";
import { getDatabaseConfig } from "../persistence/databaseConfig.js";
import { getGitHubConfig } from "../github/config.js";
import { getGitHubScoreCacheConfig } from "./githubScoreCacheConfig.js";
import { getApiProtectionConfig } from "../security/apiProtectionConfig.js";

export type StartupValidationStatus = "pending" | "ok" | "error";

let startupValidationStatus: StartupValidationStatus = "pending";

export function getStartupValidationStatus(): StartupValidationStatus {
  return startupValidationStatus;
}

export function resetStartupValidationStatusForTests(): void {
  startupValidationStatus = "pending";
}

export function validateStartupConfiguration(): void {
  try {
    const rawPort = process.env.PORT;
    if (typeof rawPort === "string") {
      const parsedPort = Number(rawPort);
      if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
        throw new Error("Invalid PORT value. Expected an integer between 1 and 65535.");
      }
    }

    // Validate GitHub configuration format deterministically at startup.
    getGitHubConfig();

    // Validate GitHub score cache configuration format deterministically at startup.
    getGitHubScoreCacheConfig();

    // Validate API protection configuration deterministically at startup.
    getApiProtectionConfig();

    if (process.env.NODE_ENV !== "test") {
      getDatabaseConfig();
    }

    startupValidationStatus = "ok";
  } catch (error) {
    startupValidationStatus = "error";
    throw error;
  }
}

export async function initializePersistentInfrastructure(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  try {
    const authStore = getAuthStore();
    await authStore.initialize();
  } catch {
    throw new Error(
      "PostgreSQL startup check failed. Verify DATABASE_URL, DATABASE_SSL_MODE, network access, and database permissions."
    );
  }
}
