"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Shirt, Cake, Pencil} from "lucide-react";
import { formatPhoneNumber } from "@/functions/shared_functions";
import ManageAthleteCard from "./manage_athlete";

type Athlete = {
  athlete_id: number;
  first_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  phone?: string | null;
  shirt_size?: string | null;
  gender?: string | null;
  [key: string]: unknown;
};

export default function AthleteCardList({ athletes }: { athletes: Athlete[] }) {
  return (
    <div className="grid w-full grid-cols-1 gap-4 text-zinc-700 dark:text-zinc-300 md:grid-cols-2 xl:grid-cols-3">
        {athletes.map((athlete) => (
            <Card key={athlete.athlete_id} className="h-full rounded-lg bg-white transition-all duration-200 hover:shadow-md dark:bg-black">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        <div className="flex flex-row items-center justify-between gap-3">
                            <span className="min-w-0 truncate">
                                {athlete.last_name}, {athlete.first_name}
                            </span>
                            <ManageAthleteCard 
                                athleteId={athlete.athlete_id} 
                                icon={<Pencil className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />}
                                first_name={athlete.first_name ?? undefined}
                                last_name={athlete.last_name ?? undefined}
                                phone={athlete.phone ?? undefined}
                                dob={athlete.dob ?? undefined}
                                shirt_size={athlete.shirt_size ?? undefined}
                                gender={athlete.gender ?? undefined}
                            />
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                {athlete.phone && (
                    <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {athlete.phone ? formatPhoneNumber(String(athlete.phone)) : "N/A"}
                    </span>
                    </div>
                )}
                {athlete.shirt_size && (
                    <div className="flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {String(athlete.shirt_size)}
                    </span>
                    </div>
                )}
                {athlete.dob && (
                    <div className="flex items-center gap-2">
                    <Cake className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {String(athlete.dob)}
                    </span>
                    </div>
                )}
                </CardContent>
            </Card>
        ))}
    </div>
  );
}
