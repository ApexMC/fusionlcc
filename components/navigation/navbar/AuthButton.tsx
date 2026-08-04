'use client';
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import LogonButton from "./logon_button";
import ProfileButton from "./profile_button";
import createClient from "@/lib/supabase/client";

type AccountRoleResponse = {
  isStaff?: boolean
  requiresEnrollmentSelection?: boolean
}

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [showTimeClock, setShowTimeClock] = useState(false);
  const [requiresEnrollmentSelection, setRequiresEnrollmentSelection] =
    useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;
    let currentUser: User | null = null;

    async function loadRoleAccess(nextUser: User | null) {
      if (!nextUser) {
        if (mounted) {
          setShowTimeClock(false);
          setRequiresEnrollmentSelection(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/account/roles", {
          cache: "no-store",
        });
        const data = response.ok
          ? ((await response.json()) as AccountRoleResponse)
          : null;

        if (mounted) {
          setShowTimeClock(Boolean(data?.isStaff));
          setRequiresEnrollmentSelection(
            Boolean(data?.requiresEnrollmentSelection)
          );
        }
      } catch {
        if (mounted) {
          setShowTimeClock(false);
          setRequiresEnrollmentSelection(false);
        }
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      const nextUser = data?.user ?? null;

      if (!mounted) return;
      currentUser = nextUser;
      setUser(nextUser);
      void loadRoleAccess(nextUser);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const nextUser = session?.user ?? null;

      currentUser = nextUser;
      setUser(nextUser);
      void loadRoleAccess(nextUser);
    });
    const reloadEnrollmentSelectionFlag = () => {
      void loadRoleAccess(currentUser);
    };

    window.addEventListener(
      "account-enrollment-selection-updated",
      reloadEnrollmentSelectionFlag
    );

    return () => {
      mounted = false;
      window.removeEventListener(
        "account-enrollment-selection-updated",
        reloadEnrollmentSelectionFlag
      );
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  return user ? (
    <ProfileButton
      user={user}
      showTimeClock={showTimeClock}
      requiresEnrollmentSelection={requiresEnrollmentSelection}
    />
  ) : (
    <LogonButton />
  );
}
