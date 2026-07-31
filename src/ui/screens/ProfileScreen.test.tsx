import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileScreen } from "./ProfileScreen.tsx";
import type { DailyHistory } from "../../server/profile.ts";

// The hors-série row is the only part of the profile no account can reach yet:
// nothing grants a commemorative, so the server always sends an empty list. These
// pin the two halves of that contract — that an empty list prints NOTHING (a
// stamp never put on sale cannot be missing from an album, so there is no empty
// mount for it), and that the row appears the moment the list is filled, which is
// all the future easter egg will have to do.

const blank: DailyHistory = {
  name: "Sissi",
  joinedAt: "2026-06-08",
  days: [],
  marks: { days: [], bat: [], artist: [], plates: [] },
  plates: [],
  cleanCount: 0,
  commemoratives: [],
};

const noop = () => {};

describe("ProfileScreen — hors-série", () => {
  it("prints no commemorative row when the account holds none", () => {
    render(<ProfileScreen history={blank} today="2026-07-31" onBack={noop} />);
    expect(
      screen.queryByRole("img", { name: /hors-série|special issue/i }),
    ).toBeNull();
  });

  it("prints the stamp once the account holds one", () => {
    render(
      <ProfileScreen
        history={{
          ...blank,
          commemoratives: [{ key: "sissi", earnedOn: "2026-07-31" }],
        }}
        today="2026-07-31"
        onBack={noop}
      />,
    );
    const stamp = screen.getByRole("img", {
      name: /Sissi.*(hors-série|special issue)/i,
    });
    expect(stamp).toBeDefined();
  });

  it("still prints the four series stamps beside it", () => {
    render(
      <ProfileScreen
        history={{
          ...blank,
          commemoratives: [{ key: "sissi", earnedOn: "2026-07-31" }],
        }}
        today="2026-07-31"
        onBack={noop}
      />,
    );
    // a blank account opens no family, so all four print as empty album mounts
    expect(
      screen.getAllByRole("img", { name: /—/ }).length,
    ).toBeGreaterThanOrEqual(4);
  });
});
