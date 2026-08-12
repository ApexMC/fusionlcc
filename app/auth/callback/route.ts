import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import createClient from "@/lib/supabase/server";

const supportedEmailOtpTypes = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const satisfies readonly EmailOtpType[];

type SupportedEmailOtpType = (typeof supportedEmailOtpTypes)[number];

function isSupportedEmailOtpType(
  value: string | null
): value is SupportedEmailOtpType {
  return supportedEmailOtpTypes.some((type) => type === value);
}

function getSafeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/login";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();

  let error = null;
  let destination = next;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && isSupportedEmailOtpType(type)) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    }));

    if (!error) {
      destination =
        type === "recovery"
          ? "/reset-password"
          : next === "/reset-password"
            ? "/login"
            : next;
    }
  } else {
    error = new Error("The authentication link is invalid.");
  }

  if (error) {
    const errorPath = next === "/reset-password" ? next : "/login";
    const errorUrl = new URL(errorPath, request.url);
    errorUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
