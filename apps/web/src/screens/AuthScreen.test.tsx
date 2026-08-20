import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen";

afterEach(() => {
  cleanup();
});

describe("AuthScreen", () => {
  it("renders only the GitHub OAuth login flow", () => {
    render(
      <AuthScreen
        isLoading={false}
        onContinueWithGitHub={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Continue with GitHub" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign up" })).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("renders backend errors without showing legacy auth requirements", () => {
    const errorMessage = "GitHub OAuth temporarily unavailable.";

    render(
      <AuthScreen
        isLoading={false}
        error={errorMessage}
        onContinueWithGitHub={vi.fn()}
      />
    );

    expect(screen.getByText(errorMessage)).toBeTruthy();
    expect(screen.queryByText("Authentication session is required to start GitHub connection.")).toBeNull();
  });

  it("triggers continue with github action", () => {
    const onContinueWithGitHub = vi.fn();

    render(
      <AuthScreen
        isLoading={false}
        onContinueWithGitHub={onContinueWithGitHub}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    expect(onContinueWithGitHub).toHaveBeenCalledTimes(1);
  });

  it("shows redirect loading state while OAuth start is in progress", () => {
    render(
      <AuthScreen
        isLoading
        onContinueWithGitHub={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: "Continue with GitHub" });
    expect(button.textContent).toBe("Redirecting to GitHub...");
    expect(button.getAttribute("aria-disabled") === "true" || button.hasAttribute("disabled")).toBe(true);
  });
});