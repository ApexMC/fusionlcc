'use client';
import { useEffect, useState } from "react";
import LogonButton from "./logon_button";
import ProfileButton from "./profile_button";
import createClient from "@/lib/supabase/client";

export default function AuthButton() {
  const [user, setUser] = useState<any | null>(null);
  const [showTimeClock, setShowTimeClock] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    async function loadRoleAccess(nextUser: any | null) {
      if (!nextUser) {
        if (mounted) setShowTimeClock(false);
        return;
      }

      try {
        const response = await fetch("/api/account/roles", {
          cache: "no-store",
        });
        const data = response.ok ? await response.json() : null;

        if (mounted) setShowTimeClock(Boolean(data?.isStaff));
      } catch {
        if (mounted) setShowTimeClock(false);
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      const nextUser = data?.user ?? null;

      if (!mounted) return;
      setUser(nextUser);
      void loadRoleAccess(nextUser);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const nextUser = session?.user ?? null;

      setUser(nextUser);
      void loadRoleAccess(nextUser);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return user ? <ProfileButton user={user} showTimeClock={showTimeClock} /> : <LogonButton />;
}
