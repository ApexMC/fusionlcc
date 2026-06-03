"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Shirt, Cake, Pencil} from "lucide-react";
import { formatPhoneNumber } from "@/functions/shared_functions";
import ManageAthleteCard from "./manage_athlete";

type Athlete = {
  athlete_id: number;
  first_name?: string;
  last_name?: string;
  dob?: string;
  phone?: string;
  shirt_size?: string;
  [key: string]: unknown;
};

export default function AthleteCardList({ userId, athletes }: { userId: string; athletes: Athlete[] }) {
  return (
    <div className="flex flex-col md:flex-row gap-3 text-zinc-700 dark:text-zinc-300 mt-2">
        {athletes.map((athlete) => (
            <Card className="min-w-68 mx-auto bg-white dark:bg-black shadow-md hover:shadow-lg h-full">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        <div className="flex flex-row items-center justify-between gap-2">
                            {athlete.last_name}, {athlete.first_name}
                            <ManageAthleteCard 
                                userId={userId} 
                                athleteId={athlete.athlete_id} 
                                icon={<Pencil className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />}
                                first_name={athlete.first_name}
                                last_name={athlete.last_name}
                                phone={athlete.phone}
                                dob={athlete.dob}
                                shirt_size={athlete.shirt_size}
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
