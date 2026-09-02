import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    username: string;
    avatarId: string;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      avatarId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    avatarId?: string;
  }
}