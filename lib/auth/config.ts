import type { NextAuthConfig } from "next-auth";

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

      if (isLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      if (isLoggedIn) return true;
      return Response.redirect(new URL("/login", request.nextUrl));
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
      return session;
    },
  },
} satisfies NextAuthConfig;