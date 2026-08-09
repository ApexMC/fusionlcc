// app/dashboard/layout.tsx

import { redirect } from "next/navigation";
import createClient from "@/lib/supabase/server";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: claims, error } = await supabase.auth.getClaims();

  if (error || !claims?.claims?.sub) {
    redirect("/login");
  }
{/*
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", claims.claims.sub)
    .in("role", ["owner", "admin", "parent", "coach"])
    .maybeSingle();

  if (!membership) {
    redirect("/unauthorized");
  }
*/}

  return <>{children}</>;
}