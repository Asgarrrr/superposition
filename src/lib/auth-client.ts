// Better Auth browser client. Same-origin, so no baseURL is needed: it calls
// the /api/auth/* routes mounted by src/routes/api/auth/$.ts.

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
