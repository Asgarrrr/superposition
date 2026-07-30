// The edition's marks. The "sans retouche" one used to be a bare ′ at 10px and
// /40 opacity — present in the DOM, effectively invisible on screen, and taught
// by no legend. A test that only asked "is something rendered?" would have
// passed throughout, so this asks for the seal BY ITS ACCESSIBLE NAME: the one
// mark the boards and the edition now share.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LEVELS } from "../../engine/levels.ts";
import { PAR } from "../../engine/par.ts";
import { m } from "../../paraglide/messages.js";
import { emptyLedger, type Ledger } from "../progression.ts";
import { SelectScreen } from "./SelectScreen.tsx";

const FIRST = LEVELS[0];

const noop = () => {};
const show = (ledger: Ledger) =>
  render(
    <SelectScreen
      ledger={ledger}
      onPick={noop}
      onDaily={noop}
      onProfile={noop}
    />,
  );

describe("SelectScreen — the plate marks", () => {
  /** The record chip of the first plate. */
  const chip = () => screen.getByText(/^✓ \d/).closest("span")!;

  it("inks the frame of a plate pulled at par in one clean pass", () => {
    show({
      ...emptyLedger,
      best: { [FIRST.id]: PAR[FIRST.id] },
      clean: { [FIRST.id]: true },
    });
    expect(chip().className).toContain("sp-ink-frame");
    // the gradient says nothing to a screen reader, so the stamp is also named
    expect(screen.getByText(m.stamp_sans_retouche())).toBeDefined();
  });

  it("keeps the amber frame on a plate at par that used corrections", () => {
    show({ ...emptyLedger, best: { [FIRST.id]: PAR[FIRST.id] } });
    expect(chip().className).toContain("border-tape/50");
    expect(chip().className).not.toContain("sp-ink-frame");
    expect(screen.queryByText(m.stamp_sans_retouche())).toBeNull();
  });

  it("frames nothing above par — the clean mark rides the frame, so it is lost", () => {
    // an accepted consequence of putting the clean mark ON the frame: a plate
    // cleared without a correction but above par has no frame to ink
    show({
      ...emptyLedger,
      best: { [FIRST.id]: PAR[FIRST.id] + 3 },
      clean: { [FIRST.id]: true },
    });
    expect(chip().className).not.toContain("sp-ink-frame");
    expect(screen.queryByText(m.stamp_sans_retouche())).toBeNull();
  });

  it("shows the record, and only a dim tick for a hinted clear", () => {
    show({
      ...emptyLedger,
      best: { [FIRST.id]: 12 },
      hinted: { [LEVELS[1].id]: true },
    });
    // the plate on the record is titled "tiré" and carries its count (above par,
    // so it is not framed as "bon à tirer")
    const pulled = screen.getAllByTitle(m.stamp_tire());
    expect(pulled).toHaveLength(1);
    expect(pulled[0].textContent).toContain("12");
    // the hinted plate claims no count — a bare tick, so its text is exactly ✓
    expect(screen.getAllByText("✓", { selector: "span" })).toHaveLength(1);
  });
});
