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
  it("wears the clean seal on a plate cleared with no correction", () => {
    show({
      ...emptyLedger,
      best: { [FIRST.id]: PAR[FIRST.id] },
      clean: { [FIRST.id]: true },
    });
    expect(
      screen.getAllByRole("img", { name: m.stamp_sans_retouche() }),
    ).toHaveLength(1);
  });

  it("wears no seal on a plate that has a record but no clean run", () => {
    show({ ...emptyLedger, best: { [FIRST.id]: PAR[FIRST.id] } });
    expect(
      screen.queryByRole("img", { name: m.stamp_sans_retouche() }),
    ).toBeNull();
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
