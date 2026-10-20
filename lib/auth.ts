import type { AuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { ALLOWED_DOMAINS, devLogin, SECRET, UserError } from "./config";
import { kv } from "./store/kv";
import { randomId, sha256 } from "./crypto";
import type { Person } from "./model";

export function emailAllowed(email: string | null | undefined) {
  const domain = (email || "").toLowerCase().split("@")[1];
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}

const providers: AuthOptions["providers"] = [];
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Shows only Workspace accounts on the first allowed domain in Google's picker.
      authorization: { params: { hd: ALLOWED_DOMAINS[0], prompt: "select_account" } },
    })
  );
}
if (devLogin) {
  providers.push(
    CredentialsProvider({
      id: "dev",
      name: "Local sign-in",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(c) {
        const email = (c?.email || "").trim().toLowerCase();
        if (!emailAllowed(email)) return null;
        const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
        return { id: email, email, name };
      },
    })
  );
}

export const authOptions: AuthOptions = {
  secret: SECRET,
  providers,
  session: { strategy: "jwt", maxAge: 7 * 86_400 },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const p = profile as { email_verified?: boolean } | undefined;
        if (!p?.email_verified) return false;
      }
      return emailAllowed(user.email);
    },
  },
};

export async function currentUser(): Promise<Person | null> {
  const s = await getServerSession(authOptions);
  if (!s?.user?.email || !emailAllowed(s.user.email)) return null;
  return { email: s.user.email.toLowerCase(), name: s.user.name || s.user.email };
}

/* ---------- API tokens, for agents and scripts ---------- */

export type ApiToken = { id: string; label: string; owner: Person; createdAt: number; lastUsedAt?: number };

export async function createApiToken(owner: Person, label: string) {
  const secret = `wqa_${randomId(32)}`;
  const hash = sha256(secret);
  const t: ApiToken = { id: hash.slice(0, 10), label: label.trim().slice(0, 60) || "Untitled", owner, createdAt: Date.now() };
  await kv.set(`apitoken:${hash}`, t);
  await kv.hset(`apitokens:${owner.email}`, t.id, hash);
  return { token: t, secret };
}

export async function listApiTokens(email: string) {
  const map = await kv.hgetall<string>(`apitokens:${email}`);
  const out: ApiToken[] = [];
  for (const hash of Object.values(map)) {
    const t = await kv.get<ApiToken>(`apitoken:${hash}`);
    if (t) out.push(t);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function revokeApiToken(email: string, id: string) {
  const hash = await kv.hget<string>(`apitokens:${email}`, id);
  if (!hash) throw new UserError("Token not found.", 404);
  await kv.del(`apitoken:${hash}`);
  await kv.hdel(`apitokens:${email}`, id);
}

/** Team member for an API request: a signed-in session, or `Authorization: Bearer wqa_...`. */
export async function apiUser(req: Request): Promise<Person> {
  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Bearer ")) {
    const hash = sha256(header.slice(7).trim());
    const t = await kv.get<ApiToken>(`apitoken:${hash}`);
    if (!t || !emailAllowed(t.owner.email)) throw new UserError("That API token isn't valid. Create a new one under Settings.", 401);
    if (!t.lastUsedAt || Date.now() - t.lastUsedAt > 3600_000) await kv.set(`apitoken:${hash}`, { ...t, lastUsedAt: Date.now() });
    return t.owner;
  }
  const u = await currentUser();
  if (!u) throw new UserError("Sign in with your WQA Google account.", 401);
  return u;
}
