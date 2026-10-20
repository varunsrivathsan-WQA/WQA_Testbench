import { NextResponse } from "next/server";
import { LIMITS, UserError } from "./config";

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: UserError becomes a JSON error with its status, anything else a 500. */
export function route<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof UserError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Something went wrong on our side. Try again in a minute." }, 500);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request, max = LIMITS.apiBodyBytes): Promise<T> {
  const text = await req.text();
  if (text.length > max) throw new UserError(`The request is over ${Math.round(max / 1048576)} MB. Upload large files from the dashboard instead.`, 413);
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new UserError("The request body isn't valid JSON.");
  }
}
