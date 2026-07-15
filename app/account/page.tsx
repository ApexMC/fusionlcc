import ParentList from "@/components/account/parents/parent_list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPhoneNumber } from "@/functions/shared_functions";
import {
    BarChart3,
    CalendarDays,
    ClipboardCheck,
    CreditCard,
    ListChecks,
    Phone,
    Mail,
    MapPin,
    Plus,
    UserRound,
    Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import ManageAthleteCard from "@/components/account/athletes/manage_athlete";
import AthleteCardList from "@/components/account/athletes/athlete_card";
import ManageAccountCard from "@/components/account/manage_account";
import { AdminMetrics } from "@/components/account/admin/admin_metrics";
import { AdminCharts } from "@/components/account/admin/admin_charts";
import { OperationsSummary } from "@/components/account/admin/operations_summary";
import { EnrollmentManagement } from "@/components/account/admin/enrollment_management";
import { ClassBillingManager } from "@/components/account/admin/class_billing_manager";
import { ClassScheduleManager } from "@/components/account/admin/class_schedule_manager";
import { ClassSessionReview } from "@/components/account/admin/class_session_review";
import { ParentEnrollments } from "@/components/account/parent_enrollments";
import { getAccountSession, getParentForUser } from "@/lib/account/auth";
import {
    getAdminDashboardData,
    getParentAthleteEnrollments,
} from "@/lib/account/data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ParentRecord } from "@/lib/account/types";

const adminDashboardSections = [
    {
        id: "metrics",
        label: "Metrics",
        icon: BarChart3,
    },
    {
        id: "charts",
        label: "Charts",
        icon: BarChart3,
    },
    {
        id: "enrollments",
        label: "Enrollments",
        icon: Users,
    },
    {
        id: "billing",
        label: "Billing",
        icon: CreditCard,
    },
    {
        id: "schedules",
        label: "Schedules",
        icon: CalendarDays,
    },
    {
        id: "sessions",
        label: "Sessions",
        icon: ClipboardCheck,
    },
    {
        id: "customers",
        label: "Customers",
        icon: UserRound,
    },
];

export default async function AccountPage() {
    const session = await getAccountSession();

    if (!session) {
        redirect("/login");
    }

    /*Parent Account Page*/
    if (session.isParent) {
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
                    <div className="mt-1 block min-w-70 bg-white dark:bg-black rounded-xl px-4 py-2 mb-4 text-sm font-bold text-black dark:text-white border border-zinc-300 dark:border-zinc-700">
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
        <div className="flex flex-col flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900 font-sans w-full">
            <main className="flex flex-1 min-h-[50vh] w-full flex-col items-center py-16 px-8 justify-center bg-zinc-100 dark:bg-zinc-900">
                <div className="flex w-full max-w-8xl flex-col items-center justify-center gap-6 bg-zinc-100 dark:bg-zinc-900 font-sans">
                    <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-200 mb-4">
                        Dashboard
                    </h1>
                    <nav
                        aria-label="Dashboard sections"
                        className="sticky top-15 z-20 flex w-full flex-wrap items-center justify-center gap-2 rounded-lg p-2 shadow-sm backdrop-blur dark:bg-transparent"
                    >
                        {adminDashboardSections.map((section) => {
                            const Icon = section.icon;

                            return (
                                <Button
                                    key={section.id}
                                    asChild
                                    size="sm"
                                    variant="outline"
                                >
                                    <a href={`#${section.id}`}>
                                        <Icon />
                                        {section.label}
                                    </a>
                                </Button>
                            );
                        })}
                    </nav>
                    <section id="metrics" className="w-full scroll-mt-30">
                        <OperationsSummary actionItems={dashboardData.actionItems} />
                        <AdminMetrics metrics={dashboardData.metrics} />
                    </section>
                    <section id="charts" className="w-full scroll-mt-30">
                        <AdminCharts
                            statusBreakdown={dashboardData.statusBreakdown}
                            monthlyTrend={dashboardData.monthlyTrend}
                        />
                    </section>
                    <section id="enrollments" className="w-full scroll-mt-30">
                        <EnrollmentManagement
                            enrollments={dashboardData.allEnrollments}
                            athletes={dashboardData.enrollmentAthletes}
                            schedules={dashboardData.classSchedules}
                        />
                    </section>
                    <section id="billing" className="w-full scroll-mt-30">
                        <ClassBillingManager classes={dashboardData.classBilling} />
                    </section>
                    <section id="schedules" className="w-full scroll-mt-30">
                        <ClassScheduleManager
                            schedules={dashboardData.classSchedules}
                            classes={dashboardData.classBilling}
                        />
                    </section>
                    <section id="sessions" className="w-full scroll-mt-30">
                        <ClassSessionReview sessions={dashboardData.classSessions} />
                    </section>
                    <section
                        id="customers"
                        className="flex w-full scroll-mt-30 flex-col items-center justify-center gap-6"
                    >
                        <ParentList />
                    </section>
                </div>
            </main>
        </div>
        );
    }

    return redirect("/login");
}
