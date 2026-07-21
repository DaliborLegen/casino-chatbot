import { cookies } from "next/headers";
import { getTenant, TENANT_COOKIE, type Tenant } from "@/lib/tenants";

/** Resolves the admin's currently selected tenant from the cookie (server side). */
export async function getAdminTenant(): Promise<Tenant> {
  const store = await cookies();
  return getTenant(store.get(TENANT_COOKIE)?.value);
}
