import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ALLOWED_DOMAINS, devLogin, hasGoogle } from "@/lib/config";
import SignInButtons from "@/components/SignInButtons";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const sp = await searchParams;
  if (await currentUser()) redirect(sp.callbackUrl?.startsWith("/") ? sp.callbackUrl : "/dashboard");
  const error = sp.error
    ? sp.error === "AccessDenied"
      ? `Only ${ALLOWED_DOMAINS.map((d) => "@" + d).join(" or ")} accounts can sign in.`
      : "Sign-in didn't work. Try again."
    : null;
  return (
    <main className="center-page">
      <div className="center-card">
        <p className="eyebrow">WQA</p>
        <h1 className="h1">Testbench.</h1>
        <p className="sub">Share tests and short-lived assets with clients by link. Links end on their own.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <SignInButtons google={hasGoogle} dev={devLogin} domain={ALLOWED_DOMAINS[0]} callbackUrl={sp.callbackUrl?.startsWith("/") ? sp.callbackUrl : "/dashboard"} />
        {!hasGoogle && !devLogin && <p className="error">Google sign-in isn't set up. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.</p>}
      </div>
    </main>
  );
}
