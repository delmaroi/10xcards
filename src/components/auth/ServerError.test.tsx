// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServerError } from "@/components/auth/ServerError";

// This is how a failed sign-in reaches the user (the endpoint redirects back with
// ?error=…). Rendering nothing for an empty message is the load-bearing part —
// an empty red box on first paint would read as a failure that never happened.

describe("ServerError", () => {
  it("shows the provider's message", () => {
    render(<ServerError message="Invalid login credentials" />);
    expect(screen.getByText("Invalid login credentials")).toBeInTheDocument();
  });

  it("renders nothing when there is no message", () => {
    const { container } = render(<ServerError message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for undefined or an empty string", () => {
    expect(render(<ServerError />).container).toBeEmptyDOMElement();
    expect(render(<ServerError message="" />).container).toBeEmptyDOMElement();
  });
});
