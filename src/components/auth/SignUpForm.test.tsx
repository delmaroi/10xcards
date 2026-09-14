// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignUpForm from "@/components/auth/SignUpForm";
import { watchSubmit, type SubmitWatcher } from "@/test/watch-submit";

// Mock i18n to return keys as-is
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && "min" in opts) return `${key}:${String(opts.min)}`;
      if (opts && "count" in opts) return `${key}:${String(opts.count)}`;
      return key;
    },
  }),
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

async function fill(values: { email?: string; password?: string; confirm?: string }) {
  if (values.email) await userEvent.type(screen.getByLabelText("form.email"), values.email);
  if (values.password) await userEvent.type(screen.getByLabelText("form.password"), values.password);
  if (values.confirm) await userEvent.type(screen.getByLabelText("form.confirmPassword"), values.confirm);
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "signup.button" }));

describe("SignUpForm", () => {
  it("posts to the signup endpoint", () => {
    const { container } = render(<SignUpForm locale="en" />);
    expect(container.querySelector("form")).toHaveAttribute("action", "/api/auth/signup");
  });

  it("submits a fully valid registration", async () => {
    render(<SignUpForm locale="en" />);
    await fill({ email: "new@b.com", password: "secret1", confirm: "secret1" });
    await submit();
    expect(watcher.submitted()).toBe(true);
  });

  it("blocks an empty form and flags all three fields", async () => {
    render(<SignUpForm locale="en" />);
    await submit();
    expect(watcher.seen).toHaveBeenCalledWith(true);
    expect(screen.getByText("form.emailRequired")).toBeInTheDocument();
    expect(screen.getByText("form.passwordRequired")).toBeInTheDocument();
    expect(screen.getByText("form.passwordConfirmRequired")).toBeInTheDocument();
  });

  it("blocks a password shorter than six characters", async () => {
    render(<SignUpForm locale="en" />);
    await fill({ email: "new@b.com", password: "abc", confirm: "abc" });
    await submit();
    expect(watcher.submitted()).toBe(false);
    expect(screen.getByText("form.passwordMinLength:6")).toBeInTheDocument();
  });

  it("blocks a mismatched confirmation", async () => {
    render(<SignUpForm locale="en" />);
    await fill({ email: "new@b.com", password: "secret1", confirm: "secret2" });
    await submit();
    expect(watcher.submitted()).toBe(false);
    expect(screen.getByText("form.passwordsDoNotMatch")).toBeInTheDocument();
  });

  it("accepts a password of exactly the minimum length (boundary)", async () => {
    render(<SignUpForm locale="en" />);
    await fill({ email: "new@b.com", password: "abcdef", confirm: "abcdef" });
    await submit();
    expect(watcher.submitted()).toBe(true);
  });

  it("rejects a malformed email", async () => {
    render(<SignUpForm locale="en" />);
    await fill({ email: "nope", password: "secret1", confirm: "secret1" });
    await submit();
    expect(screen.getByText("form.emailInvalid")).toBeInTheDocument();
  });

  it("counts down the characters still needed while typing a short password", async () => {
    render(<SignUpForm locale="en" />);
    await fill({ password: "abcd" });
    expect(screen.getByText("form.charactersNeeded:2")).toBeInTheDocument();
  });

  it("uses the singular when exactly one character is missing", async () => {
    render(<SignUpForm locale="en" />);
    await fill({ password: "abcde" });
    expect(screen.getByText("form.charactersNeeded:1")).toBeInTheDocument();
  });

  it("drops the hint once the password is long enough", async () => {
    render(<SignUpForm locale="en" />);
    await fill({ password: "abcdef" });
    expect(screen.queryByText(/form\.charactersNeeded/)).not.toBeInTheDocument();
  });

  it("toggles each password field independently", async () => {
    render(<SignUpForm locale="en" />);
    const [showPassword, showConfirm] = screen.getAllByRole("button", { name: "form.showPassword" });
    await userEvent.click(showPassword);
    expect(screen.getByLabelText("form.password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("form.confirmPassword")).toHaveAttribute("type", "password");
    await userEvent.click(showConfirm);
    expect(screen.getByLabelText("form.confirmPassword")).toHaveAttribute("type", "text");
  });

  it("submits the confirmation field under its own name", () => {
    render(<SignUpForm locale="en" />);
    expect(screen.getByLabelText("form.confirmPassword")).toHaveAttribute("name", "confirmPassword");
  });

  it("shows the server-side error handed back by the endpoint", () => {
    render(<SignUpForm locale="en" serverError="EMAIL_ALREADY_REGISTERED" />);
    expect(screen.getByText("errors.emailAlreadyRegistered")).toBeInTheDocument();
  });

  it("clears a field's error as soon as the user edits it", async () => {
    render(<SignUpForm locale="en" />);
    await submit();
    await userEvent.type(screen.getByLabelText("form.confirmPassword"), "x");
    expect(screen.queryByText("form.passwordConfirmRequired")).not.toBeInTheDocument();
  });
});
