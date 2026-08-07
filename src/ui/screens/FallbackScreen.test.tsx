// The one screen both route boundaries mount. What is worth pinning is not the
// layout but the three things that made it exist: the copy comes from the
// message catalogue rather than the component, the way back to the game is
// always wired, and the error mode gains a retry WITHOUT ever printing the
// error — a loader failure carries server detail the visitor must not see.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { m } from "../../paraglide/messages.js";
import { FallbackScreen } from "./FallbackScreen.tsx";

// the two callsites of __root.tsx, mirrored: same messages, and the retry is
// what tells them apart
const notFound = (onBack: () => void) => (
  <FallbackScreen
    title={m.fallback_not_found_title()}
    body={m.fallback_not_found_body()}
    onBack={onBack}
  />
);
const failed = (onBack: () => void, onRetry: () => void) => (
  <FallbackScreen
    title={m.fallback_error_title()}
    body={m.fallback_error_body()}
    onBack={onBack}
    onRetry={onRetry}
  />
);

const back = () => screen.getByRole("button", { name: m.fallback_back() });
const retry = () => screen.queryByRole("button", { name: m.fallback_retry() });

describe("FallbackScreen", () => {
  it("prints the 404 copy from the messages, with the way back wired", () => {
    const onBack = vi.fn();
    render(notFound(onBack));

    expect(screen.getByRole("heading").textContent).toBe(
      m.fallback_not_found_title(),
    );
    expect(screen.getByText(m.fallback_not_found_body())).toBeDefined();

    fireEvent.click(back());
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("offers no retry on a 404 — there is nothing to reload", () => {
    render(notFound(vi.fn()));
    expect(retry()).toBeNull();
  });

  it("prints the error copy and wires both the retry and the way back", () => {
    const onBack = vi.fn();
    const onRetry = vi.fn();
    render(failed(onBack, onRetry));

    expect(screen.getByRole("heading").textContent).toBe(
      m.fallback_error_title(),
    );
    expect(screen.getByText(m.fallback_error_body())).toBeDefined();

    fireEvent.click(retry()!);
    expect(onRetry).toHaveBeenCalledOnce();

    fireEvent.click(back());
    expect(onBack).toHaveBeenCalledOnce();
  });
});
