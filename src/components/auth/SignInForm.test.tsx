// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignInForm from "@/components/auth/SignInForm";
import { watchSubmit, type SubmitWatcher } from "@/test/watch-submit";

// Mock i18n to return keys as-is — avoids async init issues in tests
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/I18nProvider", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));

let watcher: SubmitWatcher;

beforeEach(() => {
  watcher = watchSubmit();
});

afterEach(() => {
  watcher.stop();
});

describe("SignInForm", () => {
  it("posts to the sign-in endpoint", () => {
    const { container } = render(<SignInForm locale="en" />);
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "/api/auth/signin");
    expect(form).toHaveAttribute("method", "POST");
  });

  it("submits when both fields are filled in", async () => {
    render(<SignInForm locale="en" />);
    await userEvent.type(screen.getByLabelText("form.email"), "a@b.com");
    await userEvent.type(screen.getByLabelText("form.password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "signin.button" }));
    expect(watcher.submitted()).toBe(true);
  });

  it("blocks the post and flags both fields when the form is empty", async () => {
    render(<SignInForm locale="en" />);
    await userEvent.click(screen.getByRole("button", { name: "signin.button" }));
    expect(watcher.seen).toHaveBeenCalledWith(true);
    expect(screen.getByText("form.emailRequired")).toBeInTheDocument();
    expect(screen.getByText("form.passwordRequired")).toBeInTheDocument();
  });

  it("rejects a malformed email", async () => {
    render(<SignInForm locale="en" />);
    await userEvent.type(screen.getByLabelText("form.email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("form.password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "signin.button" }));
    expect(watcher.seen).toHaveBeenCalledWith(true);
    expect(screen.getByText("form.emailInvalid")).toBeInTheDocument();
  });

  it("clears a field's error as soon as the user edits it", async () => {
    render(<SignInForm locale="en" />);
    await userEvent.click(screen.getByRole("button", { name: "signin.button" }));
    expect(screen.getByText("form.emailRequired")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("form.email"), "a");
    expect(screen.queryByText("form.emailRequired")).not.toBeInTheDocument();
  });

  it("reveals and re-hides the password", async () => {
    render(<SignInForm locale="en" />);
    expect(screen.getByLabelText("form.password")).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "form.showPassword" }));
    expect(screen.getByLabelText("form.password")).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "form.hidePassword" }));
    expect(screen.getByLabelText("form.password")).toHaveAttribute("type", "password");
  });

  it("shows the server-side error handed back by the endpoint", () => {
    render(<SignInForm locale="en" serverError="INVALID_CREDENTIALS" />);
    // getErrorI18nKey maps the code to an i18n key, then t() returns the key
    expect(screen.getByText("errors.invalidCredentials")).toBeInTheDocument();
  });

  it("carries novalidate so our messages replace the browser's", () => {
    const { container } = render(<SignInForm locale="en" />);
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
  });
});
