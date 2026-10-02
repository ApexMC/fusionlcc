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
    let activeRequest: { userId: string; controller: AbortController } | null = null;

    async function loadRoleAccess(nextUser: User | null, force = false) {
      if (!nextUser) {
        activeRequest?.controller.abort();
        activeRequest = null;
        if (mounted) {
          setShowTimeClock(false);
          setRequiresEnrollmentSelection(false);
        }
        return;
      }

      if (!force && activeRequest?.userId === nextUser.id) return;

      activeRequest?.controller.abort();
      const request = {
        userId: nextUser.id,
        controller: new AbortController(),
      };
      activeRequest = request;

      try {
        const response = await fetch("/api/account/roles", {
          cache: "no-store",
          signal: request.controller.signal,
        });
        const data = response.ok
          ? ((await response.json()) as AccountRoleResponse)
          : null;

        if (mounted && activeRequest === request) {
          setShowTimeClock(Boolean(data?.isStaff));
          setRequiresEnrollmentSelection(
            Boolean(data?.requiresEnrollmentSelection)
          );
        }
      } catch {
        if (mounted && activeRequest === request && !request.controller.signal.aborted) {
          setShowTimeClock(false);
          setRequiresEnrollmentSelection(false);
        }
      } finally {
        if (activeRequest === request) activeRequest = null;
      }
    }

    // Supabase emits INITIAL_SESSION when the subscription is registered.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;

      if (currentUser?.id !== nextUser?.id) {
        setShowTimeClock(false);
        setRequiresEnrollmentSelection(false);
      }
      currentUser = nextUser;
      setUser(nextUser);
      void loadRoleAccess(nextUser);
    });
    const reloadEnrollmentSelectionFlag = () => {
      void loadRoleAccess(currentUser, true);
    };

    window.addEventListener(
      "account-enrollment-selection-updated",
      reloadEnrollmentSelectionFlag
    );

    return () => {
      mounted = false;
      activeRequest?.controller.abort();
      activeRequest = null;
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
