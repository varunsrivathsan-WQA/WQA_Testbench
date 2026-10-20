import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentUser } from "@/lib/auth";
import Nav from "@/components/Nav";

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) {
    const path = (await headers()).get("x-pathname") || "/dashboard";
    redirect(`/signin?callbackUrl=${encodeURIComponent(path)}`);
  }
  return (
    <div className="shell">
      <Nav name={user.name} />
      {children}
    </div>
  );
}
