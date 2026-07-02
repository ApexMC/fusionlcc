import { NextResponse } from "next/server";
import { formatPhoneNumber } from "@/functions/shared_functions";
import { getAccountSession, requireAdminSession } from "@/lib/account/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    requireAdminSession(await getAccountSession());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("Parents")
    .select("*")
    .order("last_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  data?.forEach((parent) => {
    parent.phone = formatPhoneNumber(parent.phone);
    parent.balance = parent.balance ? `$${parent.balance.toFixed(2)}` : "$0.00";
  });

  return NextResponse.json(data ?? []);
}
