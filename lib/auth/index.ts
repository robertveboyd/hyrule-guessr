import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashSessionId } from "@/lib/auth/hash-session-id";
import { verifyPassword } from "@/lib/auth/password";
import { authConfig } from "@/lib/auth/config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (!user) return null;

        const valid = await verifyPassword(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          username: user.username,
          avatarId: user.avatarId,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.avatarId = user.avatarId;
        delete token.sessionIdHash;
        return token;
      }

      if (typeof token.id !== "string") return null;

      const row = await db.query.users.findFirst({
        where: eq(users.id, token.id),
        columns: { username: true, avatarId: true, sessionId: true },
      });
      if (!row) return null;

      token.username = row.username;
      token.avatarId = row.avatarId;
      if (typeof row.sessionId === "string") {
        token.sessionIdHash = hashSessionId(row.sessionId);
      } else {
        delete token.sessionIdHash;
      }
      return token;
    },
  },
});