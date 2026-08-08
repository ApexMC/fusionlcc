"use client"

import { useEffect, useState } from "react";
import { columns, Athlete } from "../athletes/columns"
import { DataTable } from "../parents/data-table"

export default function AthleteList() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/athletes")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        setAthletes(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="p-4">Loading athletes…</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="w-full">
      <DataTable title="All Athletes" columns={columns} data={athletes} />
    </div>
  );
}
