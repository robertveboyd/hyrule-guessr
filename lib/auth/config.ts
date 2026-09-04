import type { NextAuthConfig } from "next-auth";

import { loginPathWithCallback } from "@/lib/auth/login-url";

export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = typeof auth?.user?.id === "string";
      const isLogin = request.nextUrl.pathname === "/login";

      if (isLogin) return true;

      if (isLoggedIn) return true;

      return Response.redirect(
        new URL(
          loginPathWithCallback(
            `${request.nextUrl.pathname}${request.nextUrl.search}`,
          ),
          request.nextUrl,
        ),
      );
    },
    async session({ session, token }) {
      if (
        typeof token.id === "string" &&
        typeof token.username === "string" &&
        typeof token.avatarId === "string"
      ) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.avatarId = token.avatarId;
      }
      if (typeof token.sessionIdHash === "string") {
        session.sessionIdHash = token.sessionIdHash;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;