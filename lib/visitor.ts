import { cookies } from "next/headers";
import { unlockValue, safeEqual } from "./crypto";
import type { Drop } from "./model";

export const unlockCookie = (slug: string) => `tb_${slug}`;

export async function isUnlocked(drop: Drop) {
  if (!drop.passwordHash) return true;
  const v = (await cookies()).get(unlockCookie(drop.slug))?.value || "";
  return safeEqual(v, unlockValue(drop.slug, drop.passwordVersion));
}
