import { NextResponse } from "next/server";
import createClient from "@/lib/supabase/server";
import { formatPhoneNumber } from "@/functions/shared_functions";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("Parents")
    .select("*")
    .order("last_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  data?.forEach((parent) => {
    parent.phone = formatPhoneNumber(parent.phone);
  });

  return NextResponse.json(data ?? []);
}