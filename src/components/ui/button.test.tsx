// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonVariants } from "@/components/ui/button";

describe("Button", () => {
  it("renders a real button element by default", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" }).tagName).toBe("BUTTON");
  });

  it("forwards clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Click me
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders the child element instead of a button when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/deck">Go to deck</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Go to deck" })).toHaveAttribute("href", "/deck");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps caller classes alongside the variant classes", () => {
    render(<Button className="w-full">Click me</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });

  it("exposes distinct classes per variant and size", () => {
    expect(buttonVariants({ variant: "destructive" })).not.toBe(buttonVariants({ variant: "default" }));
    expect(buttonVariants({ size: "sm" })).not.toBe(buttonVariants({ size: "lg" }));
  });
});
