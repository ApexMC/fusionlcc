'use client';
import { useEffect, useState } from "react";
import LogonButton from "./logon_button";
import ProfileButton from "./profile_button";
import createClient from "@/lib/supabase/client";

export default function AuthButton() {
  const [user, setUser] = useState<any | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  return user ? <ProfileButton user={user} /> : <LogonButton />;
}