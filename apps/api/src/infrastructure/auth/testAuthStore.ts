import { createPgMemAuthStore } from "./postgresAuthStore.js";
import { setAuthStoreForTests } from "./authStore.js";

export function createTestAuthStore() {
  return createPgMemAuthStore();
}

export async function resetAuthStoreForTests(): Promise<void> {
  const store = createTestAuthStore();
  await store.initialize();
  setAuthStoreForTests(store);
}