import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function ThrowingChild(): null {
  throw new Error("boom");
}

describe("AppErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <AppErrorBoundary>
        <div>Healthy app</div>
      </AppErrorBoundary>
    );

    expect(screen.getByText("Healthy app")).toBeTruthy();
  });

  it("renders a safe fallback when a child throws", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("GitHealth is temporarily unavailable")).toBeTruthy();
    expect(screen.getByText("The application hit an unexpected UI error. Reload the page to try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("reloads the page from the fallback action", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reloadSpy = vi.fn();
    const originalReload = window.location.reload;
    Object.defineProperty(window.location, "reload", {
      configurable: true,
      value: reloadSpy
    });

    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: "Reload page" }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();

    Object.defineProperty(window.location, "reload", {
      configurable: true,
      value: originalReload
    });
  });
});