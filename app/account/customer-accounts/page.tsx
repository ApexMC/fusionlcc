import { redirect } from "next/navigation";
import createClient from "@/lib/supabase/server";
import ParentList from "@/components/account/parents/parent_list";

export default async function AthletesPage() {
  const supabase = await createClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claims?.claims?.sub) {
    redirect("/login");
  }

  const userId = claims.claims.sub;

  const { data: memberRecords } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"]);

  const isMember = (memberRecords?.length ?? 0) > 0;
  if (!isMember) {
    redirect("/unauthorized");
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900 font-sans">
      <main className="flex flex-1 w-full flex-col items-center py-16 px-8 justify-center bg-zinc-100 dark:bg-zinc-900">
        <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-200 mb-4">
          Dashboard
        </h1>
        <ParentList />
      </main>
    </div>
  );
}