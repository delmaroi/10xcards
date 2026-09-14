// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// The pending state comes from react-dom's useFormStatus, which only reports true
// during a real form submission — stub it so both branches are reachable.
const useFormStatus = vi.fn(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, useFormStatus: () => useFormStatus() };
});

const { SubmitButton } = await import("@/components/auth/SubmitButton");

beforeEach(() => {
  useFormStatus.mockReturnValue({ pending: false });
});

describe("SubmitButton", () => {
  it("shows its label and stays clickable when idle", () => {
    render(
      <SubmitButton pendingText="Signing in..." icon={<span />}>
        Sign in
      </SubmitButton>,
    );
    const button = screen.getByRole("button", { name: /sign in/i });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("swaps to the pending label while the form is submitting", () => {
    useFormStatus.mockReturnValue({ pending: true });
    render(
      <SubmitButton pendingText="Signing in..." icon={<span />}>
        Sign in
      </SubmitButton>,
    );
    expect(screen.getByText("Signing in...")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  it("disables itself while pending, so a form cannot be submitted twice", () => {
    useFormStatus.mockReturnValue({ pending: true });
    render(
      <SubmitButton pendingText="Creating account..." icon={<span />}>
        Create account
      </SubmitButton>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
