import { UserError } from "./config";
import { getDrop, getDropBySlug } from "./model";

/** Finds a drop by id or by its link slug. */
export async function findDrop(idOrSlug: string) {
  const d = (await getDrop(idOrSlug)) || (await getDropBySlug(idOrSlug));
  if (!d) throw new UserError("That drop doesn't exist.", 404);
  return d;
}
