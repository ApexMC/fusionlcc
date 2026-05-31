"use client"

import { useEffect, useState } from "react";
import { columns, Parent } from "./columns"
import { DataTable } from "./data-table"

export default function ParentList() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch("/api/parents")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        setParents(Array.isArray(data) ? data : []);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message ?? String(err));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="p-4">Loading parents…</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="w-full">
      <DataTable columns={columns} data={parents} />
    </div>
  );
}
