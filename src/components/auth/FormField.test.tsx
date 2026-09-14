// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormField } from "@/components/auth/FormField";

const base = {
  id: "email",
  label: "Email",
  value: "",
  onChange: () => undefined,
  icon: <span data-testid="icon" />,
};

describe("FormField", () => {
  it("associates the label with the input so it is reachable by name", () => {
    render(<FormField {...base} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("submits under the field id when no explicit name is given", () => {
    render(<FormField {...base} />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("name", "email");
  });

  it("prefers an explicit name over the id", () => {
    render(<FormField {...base} id="confirmPassword" label="Confirm" name="confirmPassword" />);
    expect(screen.getByLabelText("Confirm")).toHaveAttribute("name", "confirmPassword");
  });

  it("reports each keystroke to onChange", async () => {
    const onChange = vi.fn();
    render(<FormField {...base} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Email"), "ab");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("shows the validation error", () => {
    render(<FormField {...base} error="Email is required" />);
    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });

  it("hides the hint while an error is showing — one message at a time", () => {
    render(<FormField {...base} error="Email is required" hint={<span>3 more characters needed</span>} />);
    expect(screen.queryByText("3 more characters needed")).not.toBeInTheDocument();
  });

  it("shows the hint when there is no error", () => {
    render(<FormField {...base} hint={<span>3 more characters needed</span>} />);
    expect(screen.getByText("3 more characters needed")).toBeInTheDocument();
  });

  it("defaults to a text input and honours an explicit type", () => {
    const { rerender } = render(<FormField {...base} />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "text");
    rerender(<FormField {...base} type="password" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "password");
  });

  it("renders the trailing slot (used for the password toggle)", () => {
    render(<FormField {...base} endContent={<button type="button">toggle</button>} />);
    expect(screen.getByRole("button", { name: "toggle" })).toBeInTheDocument();
  });
});
