// The ranked list's own rules, which are easy to get wrong and were until now
// only ever verified by looking at a running board: the empty state, the visible
// cut, the "· you" badge, and the two optional marks (clean seal, discovery
// time) that must appear only where their board carries them.
//
// Rows here deliberately carry `username: null`. That is the pre-plugin account
// path, which renders the name as plain text — and it is also the path that
// needs no router context, so these stay component tests rather than becoming
// router tests.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaderboardRows } from "./LeaderboardRows.tsx";
import type { LeaderRow } from "../../server/leaderboard.ts";

const row = (over: Partial<LeaderRow> = {}): LeaderRow => ({
  rank: 1,
  userId: "u1",
  name: "Adèle",
  username: null,
  moves: 12,
  ...over,
});

describe("LeaderboardRows", () => {
  it("shows the empty label instead of a list when there are no rows", () => {
    render(<LeaderboardRows rows={[]} emptyLabel="personne encore" />);
    expect(screen.getByText("personne encore")).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("caps the visible rows at `limit`, keeping the top of the board", () => {
    const rows = [1, 2, 3, 4].map((n) =>
      row({ rank: n, userId: `u${n}`, name: `J${n}` }),
    );
    render(<LeaderboardRows rows={rows} emptyLabel="—" limit={2} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/J1/)).toBeDefined();
    expect(screen.queryByText(/J3/)).toBeNull();
  });

  it("badges only the caller's own row", () => {
    render(
      <LeaderboardRows
        rows={[
          row({ rank: 1, userId: "me", name: "Moi" }),
          row({ rank: 2, userId: "other", name: "Autre" }),
        ]}
        uid="me"
        emptyLabel="—"
      />,
    );
    const [mine, theirs] = screen.getAllByRole("listitem");
    expect(mine.textContent).toContain("Moi ·");
    expect(theirs.textContent).toBe("02Autre12");
  });

  it("shows the clean seal only on a clean row", () => {
    render(
      <LeaderboardRows
        rows={[
          row({ userId: "a", clean: true }),
          row({ rank: 2, userId: "b", clean: false }),
        ]}
        emptyLabel="—"
      />,
    );
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("prints a discovery time when measured, and nothing when not", () => {
    render(
      <LeaderboardRows
        rows={[
          row({ userId: "a", elapsedMs: 95_000 }),
          // the same board, a result the server declined to measure
          row({ rank: 2, userId: "b", elapsedMs: null }),
        ]}
        emptyLabel="—"
      />,
    );
    const [measured, unmeasured] = screen.getAllByRole("listitem");
    expect(measured.textContent).toContain("1:35");
    expect(unmeasured.textContent).toBe("02Adèle12");
  });
});
