import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhoneNumber } from "@/functions/shared_functions";
import ManageAccountCard from "@/components/account/manage_account";
import AthleteCardList from "@/components/account/athletes/athlete_card";
import { getAccountSession, getParentForUser } from "@/lib/account/auth";
import { ParentEnrollments } from "@/components/account/parent_enrollments";
import ManageAthleteCard from "@/components/account/athletes/manage_athlete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    getAdminDashboardData,
    getCoachDashboardData,
    getParentAthleteEnrollments,
} from "@/lib/account/data";
import type {
    AdminDashboardData,
    CoachDashboardData,
    ClassSessionDisplayRecord,
    EnrollmentDisplayRecord,
    OperationsActionItem,
    ParentAthleteEnrollment,
    ParentRecord,
} from "@/lib/account/types";
import { cn } from "@/lib/utils";
import {
    BadgeCheck,
    BarChart3,
    BookOpen,
    CalendarDays,
    CircleDollarSign,
    ClipboardCheck,
    Clock,
    CreditCard,
    ListChecks,
    Mail,
    MapPin,
    Phone,
    Plus,
    UserRound,
    Users,
} from "lucide-react";
import {
    AccountDashboardFrame,
    DashboardHeader,
    DashboardLinkGrid,
    DashboardStatGrid,
    type DashboardNavItem,
    type DashboardStat,
} from "@/components/account/dashboard_navigation";

const adminDashboardSections = [
    {
        title: "Customers",
        description: "Search parent accounts and attached athletes.",
        href: "/account/admin/customers",
        icon: UserRound,
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
        title: "Staff Time Clock",
        description: "Review coach time entries and pay-period totals.",
        href: "/account/admin/time-clock",
        icon: Clock,
    },
    {
        title: "Charts",
        description: "Track enrollment status and request trends.",
        href: "/account/admin/charts",
        icon: BarChart3,
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

const classSessionTimeZone = "America/Indiana/Tell_City";

function getLocalDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: classSessionTimeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const dateParts = Object.fromEntries(
        parts.map((part) => [part.type, part.value])
    );

    return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function getDateKey(value: string | null) {
    if (!value) {
        return null;
    }

    const directDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

    if (directDate) {
        return directDate;
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    return getLocalDateKey(parsedDate);
}

function normalizeSessionStatus(status: string | null | undefined) {
    return status?.trim().toLowerCase() || "scheduled";
}

function isFutureScheduledSession(
    session: ClassSessionDisplayRecord,
    todayDateKey: string
) {
    const dateKey = getDateKey(session.sessionDate);

    return (
        Boolean(dateKey && dateKey > todayDateKey) &&
        normalizeSessionStatus(session.status) === "scheduled"
    );
}

function needsAttendanceReview(
    session: ClassSessionDisplayRecord,
    todayDateKey: string
) {
    const normalizedStatus = normalizeSessionStatus(session.status);

    if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") {
        return false;
    }

    if (isFutureScheduledSession(session, todayDateKey)) {
        return false;
    }

    return (
        session.expectedAthletes.length > 0 &&
        session.expectedAthletes.some((athlete) => !athlete.attendanceStatus)
    );
}

function getUnfilledAttendanceSessionCount(
    sessions: ClassSessionDisplayRecord[]
) {
    const todayDateKey = getLocalDateKey();

    return sessions.filter((session) =>
        needsAttendanceReview(session, todayDateKey)
    ).length;
}

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

function attendanceReviewLabel(value: number) {
    return `${countLabel(value, "session")} ${
        value === 1 ? "needs" : "need"
    } attendance`;
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
    const unfilledAttendanceSessions = getUnfilledAttendanceSessionCount(
        dashboardData.classSessions
    );
    const currentClassSchedules = dashboardData.classSchedules.filter(
        (schedule) => schedule.seasonIsActive
    );
    const activeSchedules = currentClassSchedules.filter(
        (schedule) => schedule.isActive
    ).length;
    const activeCheerSchedules = dashboardData.cheerSchedules.filter(
        (schedule) => schedule.isActive
    ).length;
    const pendingTimeEntries = dashboardData.timeClockReview.coaches.reduce(
        (total, coach) => total + coach.pendingCount,
        0
    );

    return adminDashboardSections.map((section) => {
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
                detail: `${countLabel(
                    dashboardData.classBilling.length,
                    "class",
                    "classes"
                )}, ${countLabel(dashboardData.cheerBilling.length, "cheer team")}`,
            };
        }

        if (section.href.endsWith("/schedules")) {
            return {
                ...section,
                detail: `${(
                    activeSchedules + activeCheerSchedules
                ).toLocaleString()} active of ${(
                    currentClassSchedules.length +
                    dashboardData.cheerSchedules.length
                ).toLocaleString()}`,
            };
        }

        if (section.href.endsWith("/sessions")) {
            return {
                ...section,
                detail: `${attendanceReviewLabel(
                    unfilledAttendanceSessions
                )}, ${countLabel(dashboardData.cheerSessions.length, "cheer session")}`,
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
    const unfilledAttendanceSessions = getUnfilledAttendanceSessionCount(
        dashboardData.classSessions
    );

    return coachDashboardSections.map((section) => {
        if (section.href.endsWith("/sessions")) {
            return {
                ...section,
                detail: attendanceReviewLabel(unfilledAttendanceSessions),
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
    const unfilledAttendanceSessions = getUnfilledAttendanceSessionCount(
        dashboardData.classSessions
    );

    return [
        {
            label: "Session Attendance",
            value: unfilledAttendanceSessions.toLocaleString(),
            detail: unfilledAttendanceSessions
                ? "Need attendance review"
                : "Attendance is caught up",
            tone: unfilledAttendanceSessions ? "warning" : "success",
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

function formatCurrency(value: number | null | undefined) {
    if (typeof value !== "number") {
        return "N/A";
    }

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(value);
}

function formatParentName(parent: ParentRecord | null) {
    return (
        [parent?.first_name, parent?.last_name].filter(Boolean).join(" ") ||
        "Family profile"
    );
}

function formatParentAddress(parent: ParentRecord | null) {
    const cityState = [parent?.city, parent?.state].filter(Boolean).join(", ");
    const secondLine = [cityState, parent?.zip_code].filter(Boolean).join(" ");

    return [parent?.address, secondLine].filter(Boolean).join(", ");
}

function getParentEnrollments(athletes: ParentAthleteEnrollment[]) {
    return athletes.flatMap((athlete) => athlete.enrollments);
}

function normalizeEnrollmentStatusValue(status: string | null | undefined) {
    return status?.trim().toLowerCase() ?? "";
}

function getParentEnrollmentCounts(enrollments: EnrollmentDisplayRecord[]) {
    return enrollments.reduce(
        (counts, enrollment) => {
            const enrollmentStatus = normalizeEnrollmentStatusValue(
                enrollment.status
            );
            const subscriptionStatus = normalizeEnrollmentStatusValue(
                enrollment.subscriptionStatus
            );

            if (
                enrollmentStatus === "active" ||
                subscriptionStatus === "active" ||
                subscriptionStatus === "trialing"
            ) {
                counts.active += 1;
            }

            if (enrollmentStatus === "approved") {
                counts.approved += 1;
            }

            if (enrollmentStatus === "pending") {
                counts.pending += 1;
            }

            return counts;
        },
        {
            active: 0,
            approved: 0,
            pending: 0,
        }
    );
}

function getParentDashboardStats({
    parent,
    athleteCount,
    enrollments,
}: {
    parent: ParentRecord | null;
    athleteCount: number;
    enrollments: EnrollmentDisplayRecord[];
}): DashboardStat[] {
    const counts = getParentEnrollmentCounts(enrollments);
    const balance = parent?.balance;

    return [
        {
            label: "Athletes",
            value: athleteCount.toLocaleString(),
            href: "#athletes",
            detail: athleteCount
                ? countLabel(athleteCount, "athlete")
                : "Add an athlete to request classes",
            tone: athleteCount ? "default" : "warning",
        },
        {
            label: "Active enrollments",
            value: counts.active.toLocaleString(),
            href: "#enrollments",
            detail: counts.approved
                ? countLabel(counts.approved, "approved request")
                : countLabel(enrollments.length, "total enrollment"),
            tone: counts.active ? "success" : "default",
        },
        {
            label: "Pending requests",
            value: counts.pending.toLocaleString(),
            href: "#enrollments",
            detail: counts.pending
                ? "Awaiting staff review"
                : "No pending requests",
            tone: counts.pending ? "warning" : "success",
        },
        {
            label: "Account balance",
            value: formatCurrency(balance),
            href: "#family-profile",
            detail:
                typeof balance !== "number"
                    ? "Balance not available"
                    : balance > 0
                      ? "Outstanding balance"
                      : "No balance due",
            tone:
                typeof balance === "number" && balance > 0
                    ? "warning"
                    : typeof balance === "number"
                      ? "success"
                      : "default",
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
        const { data: athletes, error: athletesError } = await supabase
        .from("Athletes")
        .select("athlete_id, first_name, last_name, dob, phone, shirt_size, gender")
        .eq("user_id", session.userId);

        if (athletesError) {
            throw new Error(athletesError.message);
        }

        const athleteCards = (athletes ?? []).map((athlete) => ({
            ...athlete,
            athlete_id: Number(athlete.athlete_id),
        }));
        const parentEnrollmentData = await getParentAthleteEnrollments(session.userId);
        const parentEnrollments = getParentEnrollments(parentEnrollmentData.athletes);
        const enrollmentCounts = getParentEnrollmentCounts(parentEnrollments);
        const parentAddress = formatParentAddress(parent);
            
        return (
            <AccountDashboardFrame>
                <DashboardHeader
                    eyebrow="Parent"
                    title="Parent Dashboard"
                    description="A family view of athletes, enrollment requests, billing status, and the next class to request."
                    actions={
                        <Button asChild variant="outline">
                            <Link href="/classes">
                                <BookOpen />
                                Browse classes
                            </Link>
                        </Button>
                    }
                />
                <DashboardStatGrid
                    stats={getParentDashboardStats({
                        parent,
                        athleteCount: athleteCards.length,
                        enrollments: parentEnrollments,
                    })}
                />
                <section
                    id="family-profile"
                    className="grid scroll-mt-24 w-full grid-cols-1 gap-4 lg:grid-cols-1"
                    aria-label="Family profile"
                >
                    <Card className="rounded-lg w-full bg-white dark:bg-black">
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Family profile
                                </p>
                                <CardTitle className="mt-1 text-xl font-semibold">
                                    {formatParentName(parent)}
                                </CardTitle>
                            </div>
                            {parent ? (
                                <ManageAccountCard
                                    userId={session.userId}
                                    phone={parent.phone ?? undefined}
                                    address={parent.address ?? undefined}
                                    city={parent.city ?? undefined}
                                    state={parent.state ?? undefined}
                                    zip_code={parent.zip_code ?? undefined}
                                />
                            ) : null}
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-2">
                            <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
                                <Phone className="size-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                    <div className="text-xs text-muted-foreground">
                                        Phone
                                    </div>
                                    <div className="truncate text-sm font-medium">
                                        {parent?.phone
                                            ? formatPhoneNumber(String(parent.phone))
                                            : "Not provided"}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
                                <Mail className="size-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                    <div className="text-xs text-muted-foreground">
                                        Email
                                    </div>
                                    <div className="truncate text-sm font-medium">
                                        {parent?.email ?? "Not provided"}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border bg-background p-3 sm:col-span-2">
                                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                    <div className="text-xs text-muted-foreground">
                                        Address
                                    </div>
                                    <div className="text-sm font-medium">
                                        {parentAddress || "Not provided"}
                                    </div>
                                </div>
                            </div>
                            <div className={cn(
                                    "flex items-center gap-2 rounded-lg border bg-background p-3 sm:col-span-2",
                                    typeof parent?.balance === "number" && parent.balance > 0
                                        ? "border-amber-300/60 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20"
                                        : "border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/50"
                                )}>
                                <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                    <div className="text-xs text-muted-foreground">
                                        Outstanding Balance
                                    </div>
                                    <div className="text-sm font-medium">
                                        {typeof parent?.balance === "number" ? formatCurrency(parent.balance) : "Not provided"}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section
                    id="athletes"
                    className="scroll-mt-24 space-y-3"
                    aria-label="Athletes"
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-50">
                                Athletes
                            </h2>
                            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
                                <ListChecks className="size-4" />
                                {countLabel(athleteCards.length, "record")}
                            </div>
                        </div>
                        <ManageAthleteCard
                            userId={session.userId}
                            parentId={parent?.parent_id}
                            icon={
                                <>
                                    <Plus className="size-4" />
                                    Add athlete
                                </>
                            }
                        />
                    </div>
                    {athleteCards.length ? (
                        <AthleteCardList
                            userId={session.userId}
                            athletes={athleteCards}
                        />
                    ) : (
                        <Card className="rounded-lg border-dashed bg-white dark:bg-black">
                            <CardContent className="py-8 text-sm text-muted-foreground">
                                Add an athlete before requesting a class.
                            </CardContent>
                        </Card>
                    )}
                </section>

                <section
                    id="enrollments"
                    className="scroll-mt-24 space-y-3"
                    aria-label="Enrollments"
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                                <BadgeCheck className="size-5" />
                                Enrollments
                            </h2>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
                            <ListChecks className="size-4" />
                            {countLabel(parentEnrollments.length, "record")}
                        </div>
                    </div>
                    <ParentEnrollments
                        athletes={parentEnrollmentData.athletes}
                        classOptions={parentEnrollmentData.classOptions}
                    />
                </section>
            </AccountDashboardFrame>
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
                <div className="h-0.5 w-full bg-zinc-700"></div>
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
