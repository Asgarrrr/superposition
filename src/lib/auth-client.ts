// Better Auth browser client. Same-origin, so no baseURL is needed: it calls
// the /api/auth/* routes mounted by src/routes/api/auth/$.ts.

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({ plugins: [usernameClient()] });

export const { signIn, signUp, signOut, useSession } = authClient;
