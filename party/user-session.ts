import { routePartykitRequest, Server } from "partyserver";
import type { Connection, ConnectionContext } from "partyserver";
import { z } from "zod";

import {
  USER_SESSION_CLOSE_REPLACED,
  USER_SESSION_CLOSE_UNAUTHORIZED,
} from "../lib/auth/user-session-party";
import { secretsEqual, verifyJoinToken } from "./join-token";

const CURRENT_SESSION_ID_KEY = "currentSessionId";
const SESSION_REPLACED = "sessionReplaced";

const kickBodySchema = z.object({
  sessionId: z.string(),
});

type ConnectionSessionState = { sessionId: string };

function bearerSecret(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length);
}

async function readKickSessionId(request: Request): Promise<string | null> {
  try {
    const parsed = kickBodySchema.safeParse(await request.json());
    return parsed.success ? parsed.data.sessionId : null;
  } catch {
    return null;
  }
}

export class UserSession extends Server {
  static options = { hibernate: true };

  async onConnect(connection: Connection, ctx: ConnectionContext) {
    const secret = this.env.SESSION_ROOM_SECRET;
    const token = new URL(ctx.request.url).searchParams.get("token");
    if (!secret || !token) {
      connection.close(USER_SESSION_CLOSE_UNAUTHORIZED, "unauthorized");
      return;
    }

    const claims = await verifyJoinToken(secret, token);
    if (!claims || claims.userId !== this.name) {
      connection.close(USER_SESSION_CLOSE_UNAUTHORIZED, "unauthorized");
      return;
    }

    const currentSessionId = await this.ctx.storage.get<string>(
      CURRENT_SESSION_ID_KEY,
    );
    if (currentSessionId && currentSessionId !== claims.sessionId) {
      connection.close(USER_SESSION_CLOSE_REPLACED, SESSION_REPLACED);
      return;
    }

    connection.setState({ sessionId: claims.sessionId });
  }

  async onRequest(request: Request) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const secret = this.env.SESSION_ROOM_SECRET;
    const provided = bearerSecret(request.headers.get("Authorization"));
    if (!secret || !provided || !secretsEqual(provided, secret)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const sessionId = await readKickSessionId(request);
    if (!sessionId) {
      return new Response("Bad Request", { status: 400 });
    }

    await this.ctx.storage.put(CURRENT_SESSION_ID_KEY, sessionId);
    this.broadcast(JSON.stringify({ type: SESSION_REPLACED, sessionId }));

    for (const connection of this.getConnections<ConnectionSessionState>()) {
      if (connection.state?.sessionId === sessionId) continue;
      connection.close(USER_SESSION_CLOSE_REPLACED, SESSION_REPLACED);
    }

    return new Response(null, { status: 204 });
  }
}

export default {
  async fetch(request: Request, env: Cloudflare.Env) {
    return (
      (await routePartykitRequest(request, env, {
        onBeforeConnect(req) {
          if (req.headers.get("Origin") !== env.ALLOWED_ORIGIN) {
            return new Response("Forbidden", { status: 403 });
          }
        },
      })) || new Response("Not Found", { status: 404 })
    );
  },
};
