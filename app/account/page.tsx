import ParentList from "@/components/account/parents/parent_list";
import createClient from "@/lib/supabase/server";
import { ChartPieDonutText } from "@/components/account/charts/outstanding_clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhoneNumber } from "@/functions/shared_functions";
import { Phone, Mail, MapPin, Pencil, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import ManageAthleteCard from "@/components/account/athletes/manage_athlete";
import AthleteCardList from "@/components/account/athletes/athlete_card";
import ManageAccountCard from "@/components/account/manage_account";

type Parent = {
    id?: string | number | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
    balance?: number | null;
    [key: string]: unknown;
};

export default async function AccountPage() {
    const supabase = await createClient();
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();

    if (claimsError || !claims?.claims?.sub) {
        redirect("/login");
    }

    const userId = claims.claims.sub;
    const { data: memberRecords } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", userId)
        .in("role", ["owner", "admin", "coach", "parent"]);

    const isAdmin = memberRecords?.some((r) => r.role === "admin") ?? false;
    const isOwner = memberRecords?.some((r) => r.role === "owner") ?? false;
    const isCoach = memberRecords?.some((r) => r.role === "coach") ?? false;
    const isParent = memberRecords?.some((r) => r.role === "parent") ?? false;

    /*Parent Account Page*/
    if (isParent) {
        const { data: parents, error } = await supabase
            .from("Parents")
            .select("*")
            .eq("user_id", userId);
        if (error) {
            throw new Error(error.message);
        }

        const { data: athletes } = await supabase
        .from("Athletes")
        .select("athlete_id, first_name, last_name, dob, phone, shirt_size")
        .eq("user_id", userId);
            
        return (
        <div className="flex flex-col flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900 font-sans">
        <main className="flex flex-col md:flex-row flex-1 min-h-[50vh] w-full gap-6 items-center md:items-start py-20 px-8 justify-center bg-zinc-100 dark:bg-zinc-900">
            <div className="flex flex-col items-center">
                <h1 className="text-3xl font-bold mb-2">
                    Account
                </h1>
                {(parents as Parent[] | null)?.map((parent) => (
                    <Card key={String(parent.parent_id)} className="mx-auto bg-white dark:bg-black shadow-md hover:shadow-lg transition-all duration-200 h-full mt-2">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex flex-row items-center justify-between gap-2">
                                {parent.first_name} {parent.last_name}
                                <ManageAccountCard userId={userId} phone={parent.phone ?? undefined} address={parent.address ?? undefined} city={parent.city ?? undefined} state={parent.state ?? undefined} zip_code={parent.zip_code ?? undefined} />
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
                    Account Balance: <span className="text-orange-400">{parents?.[0]?.balance ? `$${parents[0].balance.toFixed(2)}` : "N/A"}</span>
                </div>
            </div>
            <div className="h-0.5 w-65 md:h-40 md:w-0.5 md:mt-13 bg-zinc-300 dark:bg-zinc-600">
            </div>
            <div className="flex flex-col items-center">
                <div className="flex flex-row gap-2 items-center mb-2">
                    <h1 className="text-3xl font-bold">
                        Athletes
                    </h1>
                    <ManageAthleteCard userId={userId} icon={<Plus className="w-4 h-4 text-white font-bold" />} />
                </div>
                <AthleteCardList userId={userId} athletes={athletes ?? []} />
            </div>
        </main>
        </div>
        );
    }

    /*Owner & Admin Management Dashboard*/
    else if (isAdmin || isOwner) {
        return (
        <div className="flex flex-col flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900 font-sans w-full">
            <main className="flex flex-1 min-h-[50vh] w-full flex-col items-center py-16 px-6 justify-center bg-zinc-100 dark:bg-zinc-900">
                <div className="flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900 font-sans w-full">
                    <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-200 mb-4">
                        Dashboard
                    </h1>
                    <div className="flex flex-col mt-8 items-center justify-center gap-6 w-full">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-6 w-full">
                            <ChartPieDonutText />
                            <ChartPieDonutText />
                        </div>
                        <ParentList />
                    </div>
                </div>
            </main>
        </div>
        );
    }
}