import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth/config";
import { CALLBACK_PATH_HEADER } from "@/lib/auth/login-url";

const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(
    CALLBACK_PATH_HEADER,
    `${req.nextUrl.pathname}${req.nextUrl.search}`,
  );
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)",
  ],
};
