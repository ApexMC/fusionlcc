import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPhoneNumber } from "@/functions/shared_functions";
import {BarChart3, CalendarDays, ClipboardCheck, Clock, CreditCard, ListChecks, Phone, Mail, MapPin, Plus, UserRound, Users,} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import ManageAthleteCard from "@/components/account/athletes/manage_athlete";
import AthleteCardList from "@/components/account/athletes/athlete_card";
import ManageAccountCard from "@/components/account/manage_account";
import { ParentEnrollments } from "@/components/account/parent_enrollments";
import {
    AccountDashboardFrame,
    DashboardHeader,
    DashboardLinkGrid,
    DashboardStatGrid,
    type DashboardNavItem,
    type DashboardStat,
} from "@/components/account/dashboard_navigation";
import { getAccountSession, getParentForUser } from "@/lib/account/auth";
import {getAdminDashboardData, getCoachDashboardData, getParentAthleteEnrollments,} from "@/lib/account/data";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
    AdminDashboardData,
    CoachDashboardData,
    OperationsActionItem,
    ParentRecord,
} from "@/lib/account/types";

const adminDashboardSections = [
    {
        title: "Overview",
        description: "Check priority queues and key account metrics.",
        href: "/account/admin/overview",
        icon: ListChecks,
    },
    {
        title: "Charts",
        description: "Track enrollment status and request trends.",
        href: "/account/admin/charts",
        icon: BarChart3,
    },
    {
        title: "Enrollments",
        description: "Review requests and manage athlete enrollments.",
        href: "/account/admin/enrollments",
        icon: Users,
    },
    {
        title: "Billing",
        description: "Maintain billing setup, program type, and Stripe pricing.",
        href: "/account/admin/billing",
        icon: CreditCard,
    },
    {
        title: "Schedules",
        description: "Manage class days, times, active status, and rosters.",
        href: "/account/admin/schedules",
        icon: CalendarDays,
    },
    {
        title: "Sessions",
        description: "Review class sessions and attendance details.",
        href: "/account/admin/sessions",
        icon: ClipboardCheck,
    },
    {
        title: "Customers",
        description: "Search parent accounts and attached athletes.",
        href: "/account/admin/customers",
        icon: UserRound,
    },
    {
        title: "Staff Time Clock",
        description: "Review coach time entries and pay-period totals.",
        href: "/account/admin/time-clock",
        icon: Clock,
    },
] satisfies DashboardNavItem[];

const coachDashboardSections = [
    {
        title: "Sessions",
        description: "Review class sessions and attendance.",
        href: "/account/coach/sessions",
        icon: ClipboardCheck,
    },
    {
        title: "Time Clock",
        description: "Clock in and out for coaching shifts.",
        href: "/account/time-clock",
        icon: Clock,
    },
] satisfies DashboardNavItem[];

function findActionItem(
    dashboardData: AdminDashboardData,
    label: string
): OperationsActionItem | undefined {
    return dashboardData.actionItems.find((item) => item.label === label);
}

function metricValue(
    dashboardData: AdminDashboardData,
    label: string,
    fallback = "0"
) {
    return (
        dashboardData.metrics.find((metric) => metric.label === label)?.value ??
        fallback
    );
}

function metricDetail(
    dashboardData: AdminDashboardData,
    label: string,
    fallback?: string
) {
    return (
        dashboardData.metrics.find((metric) => metric.label === label)?.detail ??
        fallback
    );
}

function countLabel(value: number, singular: string, plural = `${singular}s`) {
    return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}

function actionBadge(
    item: OperationsActionItem | undefined,
    singular: string,
    plural = `${singular}s`
) {
    return item ? countLabel(Number(item.value) || 0, singular, plural) : undefined;
}

function getAdminDashboardLinks(
    dashboardData: AdminDashboardData
): DashboardNavItem[] {
    const reviewQueue = findActionItem(dashboardData, "Review queue");
    const billingSetup = findActionItem(dashboardData, "Class billing setup");
    const activeSchedules = dashboardData.classSchedules.filter(
        (schedule) => schedule.isActive
    ).length;
    const pendingTimeEntries = dashboardData.timeClockReview.coaches.reduce(
        (total, coach) => total + coach.pendingCount,
        0
    );

    return adminDashboardSections.map((section) => {
        if (section.href.endsWith("/overview")) {
            return {
                ...section,
                badge: actionBadge(reviewQueue, "pending request"),
            };
        }

        if (section.href.endsWith("/charts")) {
            return {
                ...section,
                detail: countLabel(dashboardData.allEnrollments.length, "record"),
            };
        }

        if (section.href.endsWith("/enrollments")) {
            return {
                ...section,
                badge: actionBadge(reviewQueue, "pending request"),
                tone: reviewQueue?.tone,
                detail: countLabel(dashboardData.allEnrollments.length, "enrollment"),
            };
        }

        if (section.href.endsWith("/billing")) {
            return {
                ...section,
                badge: actionBadge(billingSetup, "setup gap"),
                tone: billingSetup?.tone,
                detail: countLabel(dashboardData.classBilling.length, "class", "classes"),
            };
        }

        if (section.href.endsWith("/schedules")) {
            return {
                ...section,
                detail: `${activeSchedules.toLocaleString()} active of ${dashboardData.classSchedules.length.toLocaleString()}`,
            };
        }

        if (section.href.endsWith("/sessions")) {
            return {
                ...section,
                detail: countLabel(dashboardData.classSessions.length, "session"),
            };
        }

        if (section.href.endsWith("/customers")) {
            return {
                ...section,
                detail: `${metricValue(dashboardData, "Parent accounts")} parent accounts`,
            };
        }

        if (section.href.endsWith("/time-clock")) {
            return {
                ...section,
                badge: countLabel(pendingTimeEntries, "pending entry"),
                tone: pendingTimeEntries ? "warning" : "success",
                detail: countLabel(
                    dashboardData.timeClockReview.coaches.length,
                    "coach",
                    "coaches"
                ),
            };
        }

        return {
            ...section,
        };
    });
}

function getAdminDashboardStats(
    dashboardData: AdminDashboardData
): DashboardStat[] {
    const reviewQueue = findActionItem(dashboardData, "Review queue");
    const readyToBill = findActionItem(dashboardData, "Ready to bill");

    return [
        {
            label: "Review queue",
            value: reviewQueue?.value ?? "0",
            detail: reviewQueue?.detail,
            tone: reviewQueue?.tone,
        },
        {
            label: "Ready to bill",
            value: readyToBill?.value ?? "0",
            detail: readyToBill?.detail,
            tone: readyToBill?.tone,
        },
        {
            label: "Monthly recurring revenue",
            value: metricValue(dashboardData, "Monthly recurring revenue"),
            detail: metricDetail(
                dashboardData,
                "Monthly recurring revenue",
                "Estimated from active monthly Stripe prices"
            ),
            tone:
                metricValue(dashboardData, "Monthly recurring revenue") ===
                "0"
                    ? "default"
                    : "success",
        },
        {
            label: "Parent accounts",
            value: metricValue(dashboardData, "Parent accounts"),
            detail: "Total parent records",
        },
    ];
}

function getCoachDashboardLinks(
    dashboardData: CoachDashboardData
): DashboardNavItem[] {
    return coachDashboardSections.map((section) => {
        if (section.href.endsWith("/sessions")) {
            return {
                ...section,
                detail: countLabel(dashboardData.classSessions.length, "session"),
            };
        }

        return {
            ...section,
            badge: dashboardData.timeClock.activeEntry ? "Clocked in" : "Ready",
            tone: dashboardData.timeClock.activeEntry ? "success" : "default",
            detail: countLabel(
                dashboardData.timeClock.recentEntries.length,
                "recent entry",
                "recent entries"
            ),
        };
    });
}

function getCoachDashboardStats(
    dashboardData: CoachDashboardData
): DashboardStat[] {
    return [
        {
            label: "Class sessions",
            value: dashboardData.classSessions.length.toLocaleString(),
            detail: "Available for attendance review",
        },
        {
            label: "Time clock",
            value: dashboardData.timeClock.activeEntry ? "Active" : "Ready",
            detail: dashboardData.timeClock.activeEntry
                ? "You are currently clocked in"
                : "No active shift",
            tone: dashboardData.timeClock.activeEntry ? "success" : "default",
        },
    ];
}

export default async function AccountPage() {
    const session = await getAccountSession();

    if (!session) {
        redirect("/login");
    }

    /*Parent Account Page*/
    if (session.isParent && !session.isOwner && !session.isAdmin && !session.isCoach) {
        const supabase = createAdminClient();
        const parent = await getParentForUser(session.userId);
        const parents = parent ? [parent] : [];
        const { data: athletes, error: athletesError } = await supabase
        .from("Athletes")
        .select("athlete_id, first_name, last_name, dob, phone, shirt_size")
        .eq("user_id", session.userId);

        if (athletesError) {
            throw new Error(athletesError.message);
        }

        const athleteCards = (athletes ?? []).map((athlete) => ({
            ...athlete,
            athlete_id: Number(athlete.athlete_id),
        }));
        const parentEnrollmentData = await getParentAthleteEnrollments(session.userId);
            
        return (
        <div className="flex flex-col flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900 font-sans">
        <main className="flex flex-col flex-1 min-h-[50vh] w-full gap-10 items-center py-20 px-8 justify-center bg-zinc-100 dark:bg-zinc-900">
            <div className="flex flex-col md:flex-row w-full gap-6 items-center md:items-start justify-center">
                <div className="flex flex-col items-center">
                    <h1 className="text-3xl font-bold mb-2">
                        Account
                    </h1>
                    {(parents as ParentRecord[] | null)?.map((parent) => (
                        <Card key={String(parent.parent_id)} className="mx-auto bg-white dark:bg-black shadow-md hover:shadow-lg transition-all duration-200 h-full mt-2">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex flex-row items-center justify-between gap-2">
                                    {parent.first_name} {parent.last_name}
                                    <ManageAccountCard userId={session.userId} phone={parent.phone ?? undefined} address={parent.address ?? undefined} city={parent.city ?? undefined} state={parent.state ?? undefined} zip_code={parent.zip_code ?? undefined} />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {parent.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                                        <span className="text-sm text-zinc-600 dark:text-zinc-400">{formatPhoneNumber(String(parent.phone))}</span>
                                    </div>
                                )}
                                {parent.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                                        <span className="text-sm text-zinc-600 dark:text-zinc-400">{String(parent.email)}</span>
                                    </div>
                                )}
                                {parent.address && (
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5" />
                                        <span className="text-sm text-zinc-600 dark:text-zinc-400">{String(parent.address + ", " + parent.city + ", " + parent.state + " " + parent.zip_code)}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        )
                    )}
                    <div className="mt-1 block min-w-70 bg-white dark:bg-black rounded-xl px-3 py-2 mb-4 text-sm font-bold text-black dark:text-white border border-zinc-300 dark:border-zinc-700">
                        Account Balance: <span className="text-orange-400">{typeof parents?.[0]?.balance === "number" ? `$${parents[0].balance.toFixed(2)}` : "N/A"}</span>
                    </div>
                </div>
                <div className="h-0.5 w-65 md:h-40 md:w-0.5 md:mt-13 bg-zinc-300 dark:bg-zinc-600">
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex flex-row gap-2 items-center mb-2">
                        <h1 className="text-3xl font-bold">
                            Athletes
                        </h1>
                        <ManageAthleteCard userId={session.userId} icon={<Plus className="w-4 h-4 text-white font-bold" />} />
                    </div>
                    <AthleteCardList userId={session.userId} athletes={athleteCards} />
                </div>
            </div>
            <ParentEnrollments
                athletes={parentEnrollmentData.athletes}
            />
        </main>
        </div>
        );
    }

    /*Owner & Admin Management Dashboard*/
    else if (session.isAdmin || session.isOwner) {
        const dashboardData = await getAdminDashboardData();

        return (
            <AccountDashboardFrame>
                <DashboardHeader
                    eyebrow={session.isOwner ? "Owner" : "Admin"}
                    title="Dashboard"
                    description="Jump straight into the workspace you need."
                />
                <DashboardStatGrid stats={getAdminDashboardStats(dashboardData)} />
                <DashboardLinkGrid items={getAdminDashboardLinks(dashboardData)} />
            </AccountDashboardFrame>
        );
    }

    /*Coach Dashboard*/
    else if (session.isCoach) {
        const dashboardData = await getCoachDashboardData(session.userId);

        return (
            <AccountDashboardFrame className="max-w-5xl">
                <DashboardHeader
                    eyebrow="Coach"
                    title="Coach Dashboard"
                    description="Open your session review or time clock workspace without sorting through admin tools."
                />
                <DashboardStatGrid stats={getCoachDashboardStats(dashboardData)} />
                <DashboardLinkGrid
                    items={getCoachDashboardLinks(dashboardData)}
                    className="xl:grid-cols-2"
                />
            </AccountDashboardFrame>
        );
    }

    return redirect("/login");
}
