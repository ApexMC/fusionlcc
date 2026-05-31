"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Shirt, Cake} from "lucide-react";
import { formatPhoneNumber } from "@/functions/shared_functions";

type Athlete = {
  athlete_id: string | number;
  first_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  phone?: string | null;
  shirt_size?: string | null;
  [key: string]: unknown;
};

export default function AthleteList({ athletes }: { athletes: Athlete[] }) {
  return (
    <div className="flex flex-col md:flex-row gap-3 text-zinc-700 dark:text-zinc-300 mt-2">
        {athletes.map((athlete) => (
            <Card className="min-w-68 mx-auto bg-white dark:bg-black shadow-md hover:shadow-lg h-full">
                <CardHeader>
                <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {athlete.last_name}, {athlete.first_name}
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
