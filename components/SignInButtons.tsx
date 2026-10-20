"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInButtons({ google, dev, domain, callbackUrl }: { google: boolean; dev: boolean; domain: string; callbackUrl: string }) {
  const [email, setEmail] = useState("");
  return (
    <div className="stack" style={{ width: "100%" }}>
      {google && (
        <button className="btn btn-primary" onClick={() => signIn("google", { callbackUrl })}>
          Sign in with Google
        </button>
      )}
      {dev && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            signIn("dev", { email, callbackUrl });
          }}
        >
          <p className="notice">Local mode: Google isn&apos;t set up, so any @{domain} email signs you in. This is off in production.</p>
          <input id="dev-email" className="input" type="email" placeholder={`you@${domain}`} aria-label="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn btn-dark">Sign in</button>
        </form>
      )}
    </div>
  );
}
