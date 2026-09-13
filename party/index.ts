import { routePartykitRequest } from "partyserver";

export { MatchRoom } from "./match-room";
export { UserSession } from "./user-session";

const worker = {
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

export default worker;
