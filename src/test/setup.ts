// Setup for the `dom` vitest project (see vitest.config.ts).
//
// Testing Library only auto-cleans when a global `afterEach` exists, which it
// does not here — the suite runs without `globals: true`, so vitest's helpers
// are imported rather than ambient. Registering cleanup once here is what keeps
// each test's render from leaking into the next one's queries.

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);
