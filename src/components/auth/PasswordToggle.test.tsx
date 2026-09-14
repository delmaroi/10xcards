// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordToggle } from "@/components/auth/PasswordToggle";

// react-i18next returns the key as-is when no backend is configured
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The toggle is icon-only, so its accessible name is the ONLY thing telling a
// screen-reader user what it does — and it must describe the action, not the state.

describe("PasswordToggle", () => {
  it('offers "Show password" while the password is hidden', () => {
    render(<PasswordToggle visible={false} onToggle={() => undefined} />);
    expect(screen.getByRole("button", { name: "form.showPassword" })).toBeInTheDocument();
  });

  it('offers "Hide password" once the password is visible', () => {
    render(<PasswordToggle visible onToggle={() => undefined} />);
    expect(screen.getByRole("button", { name: "form.hidePassword" })).toBeInTheDocument();
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(<PasswordToggle visible={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("is type=button so it cannot submit the surrounding form", () => {
    render(<PasswordToggle visible={false} onToggle={() => undefined} />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
