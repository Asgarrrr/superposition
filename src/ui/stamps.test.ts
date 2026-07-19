// Pins the stamp derivation: par gates "bon à tirer", the clean ledger gates
// "sans retouche", and an unknown id can never claim a stamp it has no par for.

import { describe, expect, it } from "vitest";
import { PAR } from "../engine/par.ts";
import { stamps } from "./stamps.ts";

const none: Record<string, true> = {};

describe("stamps — bon à tirer", () => {
  it("record au par → acquis", () => {
    expect(stamps("accord", PAR.accord, none).bat).toBe(true);
  });

  it("record au-dessus du par → non acquis", () => {
    expect(stamps("accord", PAR.accord + 1, none).bat).toBe(false);
  });

  it("non résolu → non acquis", () => {
    expect(stamps("accord", undefined, none).bat).toBe(false);
  });

  it("id inconnu (sans par) → sûr, jamais acquis", () => {
    expect(stamps("inconnu", 1, none).bat).toBe(false);
  });
});

describe("stamps — sans retouche", () => {
  it("suit le drapeau clean", () => {
    expect(stamps("accord", undefined, { accord: true }).sans).toBe(true);
    expect(stamps("accord", PAR.accord, none).sans).toBe(false);
  });

  it("indépendant du par : au-dessus du par mais propre → sans retouche seul", () => {
    const s = stamps("accord", PAR.accord + 3, { accord: true });
    expect(s.bat).toBe(false);
    expect(s.sans).toBe(true);
  });

  it("id inconnu → sans retouche sûr", () => {
    expect(stamps("inconnu", undefined, none).sans).toBe(false);
  });
});
