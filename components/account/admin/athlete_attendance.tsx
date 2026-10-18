"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, Search } from "lucide-react"
import { saveAttendanceSeason } from "@/app/actions/attendance"
import { absenceLimits, attendanceLabels, categoryLabels, normalizeAttendanceStatus, selectAttendanceSeason, standingLabels, summarizeAthleteAttendance, type AbsenceTotals, type AthleteAttendanceData, type AthleteAttendanceSummary, type AttendanceSeason, type AttendanceStanding } from "@/lib/account/attendance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SmartSelect } from "@/components/ui/smart-select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DashboardStatGrid } from "@/components/account/dashboard_navigation"

export function AttendanceStandingBadge({ standing }: { standing: AttendanceStanding }) {
  return <Badge variant={standing === "over-limit" ? "destructive" : standing === "at-limit" || standing === "approaching" ? "warning" : standing === "within" ? "success" : "outline"}>{standingLabels[standing]}</Badge>
}

function SeasonEditor({ season, ready, onSaved }: { season?: AttendanceSeason; ready: boolean; onSaved: (id: string) => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(season?.name ?? "")
  const [startsOn, setStartsOn] = useState(season?.startsOn ?? "")
  const [endsOn, setEndsOn] = useState(season?.endsOn ?? "")
  const [error, setError] = useState("")
  const [saving, startTransition] = useTransition()
  return <Dialog open={open} onOpenChange={(value) => { if (!saving) { setOpen(value); setError("") } }}>
    <DialogTrigger asChild><Button variant="outline" disabled={!ready}><CalendarDays />{season ? "Edit season" : "Add season"}</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>{season ? "Edit attendance season" : "Add attendance season"}</DialogTitle><DialogDescription>Absence allowances apply within these dates. Changing dates recalculates totals from saved attendance. Seasons cannot overlap.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); startTransition(async () => {
        try {
          const result = await saveAttendanceSeason({ id: season?.id, name, startsOn, endsOn })
          if (!result.ok || !result.id) { setError(result.message); return }
          onSaved(result.id); setOpen(false); router.refresh()
        } catch { setError("The season could not be saved. Please try again.") }
      }) }}>
        <label className="block space-y-1 text-sm font-medium">Season name<Input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. 2026–2027 Cheer" disabled={saving} /></label>
        <label className="block space-y-1 text-sm font-medium">Start date<Input type="date" required value={startsOn} onChange={(event) => setStartsOn(event.target.value)} disabled={saving} /></label>
        <label className="block space-y-1 text-sm font-medium">End date<Input type="date" required min={startsOn || undefined} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} disabled={saving} /></label>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving}>{saving ? "Saving…" : "Save season"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>
}

function Totals({ totals, applies, category }: { totals: AbsenceTotals; applies: boolean; category: string }) {
  return <div className="rounded-lg border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{category}</h3><AttendanceStandingBadge standing={totals.standing} /></div>
    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
      <p>Excused: <strong>{totals.excused}{applies ? ` / ${absenceLimits.excused}` : ""}</strong></p>
      <p>Unexcused: <strong>{totals.unexcused}{applies ? ` / ${absenceLimits.unexcused}` : ""}</strong></p>
      <p className="text-muted-foreground">Present: {totals.present}</p><p className="text-muted-foreground">Late: {totals.late}</p>
    </div>
    {totals.incomplete ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{totals.incomplete} attendance marks missing</p> : null}
  </div>
}

function AthleteDetails({ athlete, data, season }: { athlete: AthleteAttendanceSummary; data: AthleteAttendanceData; season: AttendanceSeason }) {
  const hasCheer = data.cheerMemberships.some((membership) => membership.athleteId === athlete.id)
  return <>
    <DialogHeader><DialogTitle>{athlete.name}</DialogTitle><DialogDescription>{season.name} · {season.startsOn} to {season.endsOn}</DialogDescription></DialogHeader>
    <div className="flex flex-wrap gap-3 text-sm"><span>{athlete.parentName}</span>{athlete.parentEmail ? <a className="underline" href={`mailto:${athlete.parentEmail}`}>{athlete.parentEmail}</a> : null}{athlete.parentPhone ? <a className="underline" href={`tel:${athlete.parentPhone}`}>{athlete.parentPhone}</a> : null}</div>
    <div className={`grid gap-3${hasCheer ? " sm:grid-cols-2" : ""}`}>{hasCheer ? <Totals category="Cheer practices" totals={athlete.totals.cheer} applies={athlete.policyApplies} /> : null}<Totals category="Gymnastics / tumbling" totals={athlete.totals.gymnastics} applies={athlete.policyApplies} /></div>
    {athlete.history.some((event) => event.category === "other") ? <Totals category="Other classes · tracking only" totals={athlete.totals.other} applies={false} /> : null}
    <p className="text-xs leading-5 text-muted-foreground">Cheer and gymnastics have separate allowances of 4 excused and 2 unexcused absences. Recreational athletes are tracked without these limits. Missing marks, canceled sessions and optional makeup sessions do not consume allowances. A makeup does not erase a saved absence.</p>
    <h3 className="font-semibold">Attendance history</h3>
    {athlete.history.length ? <div className="space-y-3">{athlete.history.map((event) => {
      const status = normalizeAttendanceStatus(event.status)
      return <div key={`${event.category}:${event.sessionId}`} className="rounded-lg border p-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{event.date} · {event.programName}</p><p className="text-xs text-muted-foreground">{categoryLabels[event.category]}{event.isMakeup ? " · Optional makeup" : ""}</p></div><Badge variant={!status ? "warning" : status === "absent" ? "destructive" : "outline"}>{status ? attendanceLabels[status] : "Not recorded"}</Badge></div>
        {event.notes ? <p className="mt-2 whitespace-pre-wrap break-words">{event.notes}</p> : null}
        {event.reviewedAt ? <p className="mt-2 text-xs text-muted-foreground">Reviewed by {event.reviewedBy ? data.reviewers[event.reviewedBy] ?? "Staff member" : "Former staff member"} · {new Date(event.reviewedAt).toLocaleString()}</p> : null}
        <Link className="mt-2 inline-block text-xs font-medium underline" href={`/account/admin/sessions?kind=${event.category === "cheer" ? "cheer" : "class"}&session=${encodeURIComponent(event.sessionId)}`}>Review session attendance</Link>
      </div>
    })}</div> : <p className="text-sm text-muted-foreground">No attendance records or assigned past sessions in this season.</p>}
  </>
}

function AttendanceCounts({ label, programs, totals }: { label: string; programs: string[]; totals: Pick<AbsenceTotals, "present" | "excused" | "unexcused" | "late"> }) {
  return <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_20rem] sm:items-center sm:gap-4 lg:grid-cols-1 lg:grid-rows-[1fr_auto] lg:gap-2">
    <div className="min-w-0">
      <p className="text-sm font-medium">{label}</p>
      {programs.length ? <p className="break-words text-xs text-muted-foreground">{programs.join(", ")}</p> : null}
      {totals.late ? <p className="text-xs text-muted-foreground">{totals.late} late</p> : null}
    </div>
    <div className="grid grid-cols-3 gap-2" aria-label={`${label} season attendance`}>
      <Badge variant="success" className="flex-col justify-between gap-0.5 rounded-md px-1.5 py-1.5 text-[11px] sm:flex-row sm:gap-1 sm:px-2.5 sm:text-xs lg:flex-col xl:flex-row"><span>Present</span><strong className="text-sm tabular-nums">{totals.present}</strong></Badge>
      <Badge variant="warning" className="flex-col justify-between gap-0.5 rounded-md px-1.5 py-1.5 text-[11px] sm:flex-row sm:gap-1 sm:px-2.5 sm:text-xs lg:flex-col xl:flex-row"><span>Excused</span><strong className="text-sm tabular-nums">{totals.excused}</strong></Badge>
      <Badge variant="destructive" className="flex-col justify-between gap-0.5 rounded-md px-1.5 py-1.5 text-[11px] sm:flex-row sm:gap-1 sm:px-2.5 sm:text-xs lg:flex-col xl:flex-row"><span>Unexcused</span><strong className="text-sm tabular-nums">{totals.unexcused}</strong></Badge>
    </div>
  </div>
}

function AthleteSeasonCounts({ athlete, cheerMemberships }: { athlete: AthleteAttendanceSummary; cheerMemberships: AthleteAttendanceData["cheerMemberships"] }) {
  const hasCheer = cheerMemberships.length > 0
  const cheerPrograms = [...new Set(cheerMemberships.map((membership) => membership.programName))]
  const classPrograms = [...new Set(athlete.history.filter((event) => event.category !== "cheer").map((event) => event.programName))]
  const { gymnastics, other } = athlete.totals
  const classTotals = {
    present: gymnastics.present + other.present,
    excused: gymnastics.excused + other.excused,
    unexcused: gymnastics.unexcused + other.unexcused,
    late: gymnastics.late + other.late,
  }

  return <div className="grid gap-3 lg:grid-cols-2 lg:gap-6">
    {hasCheer ? <AttendanceCounts label="Cheer" programs={cheerPrograms} totals={athlete.totals.cheer} /> : null}
    {classPrograms.length ? <AttendanceCounts label="Classes" programs={classPrograms} totals={classTotals} /> : null}
    {!hasCheer && !classPrograms.length ? <p className="text-sm text-muted-foreground">No past sessions this season.</p> : null}
  </div>
}

export function AthleteAttendance({ data, initialAthleteId, initialFilter = "all", initialSeasonId }: { data: AthleteAttendanceData; initialAthleteId?: string; initialFilter?: string; initialSeasonId?: string }) {
  const [seasonId, setSeasonId] = useState(initialSeasonId ?? selectAttendanceSeason(data.seasons, data.today)?.id ?? "")
  const season = data.seasons.find((season) => season.id === seasonId) ?? selectAttendanceSeason(data.seasons, data.today)
  const [search, setSearch] = useState(initialAthleteId ? data.athletes.find((athlete) => athlete.id === initialAthleteId)?.name ?? "" : "")
  const [standing, setStanding] = useState(initialFilter)
  const [program, setProgram] = useState("all")
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(initialAthleteId ?? null)
  const summaries = useMemo(() => season ? summarizeAthleteAttendance(data, season) : [], [data, season])
  const selected = summaries.find((athlete) => athlete.id === selectedId)
  const attention = summaries.filter((athlete) => ["approaching", "at-limit", "over-limit"].includes(athlete.standing))
  const filtered = summaries.filter((athlete) => {
    const query = search.trim().toLowerCase()
    return (!query || [athlete.name, athlete.parentName, athlete.parentEmail, ...athlete.programs].some((value) => value?.toLowerCase().includes(query)))
      && (program === "all" || athlete.programKeys.includes(program))
      && (standing === "all" || (standing === "attention" ? attention.includes(athlete) : standing === "incomplete" ? athlete.incomplete > 0 : athlete.standing === standing))
  })
  const programOptions = [...new Map(summaries.flatMap((athlete) => athlete.history.map((event) => [`${event.category}:${event.programId}`, `${categoryLabels[event.category]} · ${event.programName}`] as const))).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(currentPage * 25, (currentPage + 1) * 25)
  return <>
    {data.notices.map((notice) => <p role="alert" key={notice} className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{notice}</p>)}
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className="flex min-w-60 flex-col gap-1 text-sm font-medium">Attendance season<SmartSelect className="h-10 rounded-md border bg-background px-3" value={season?.id ?? ""} onValueChange={(id) => { setSeasonId(id); setPage(0) }} options={data.seasons.length ? data.seasons.map((season) => ({ value: season.id, label: season.name })) : [{ value: "", label: "No seasons configured" }]} /></label>
      <div className="flex gap-2">{season ? <SeasonEditor key={season.id} season={season} ready={data.seasonsReady} onSaved={setSeasonId} /> : null}<SeasonEditor ready={data.seasonsReady} onSaved={setSeasonId} /></div>
    </div>
    {!season ? <Card><CardContent className="py-8"><h2 className="text-lg font-semibold">Set up an attendance season</h2><p className="mt-2 text-sm text-muted-foreground">Add the season’s start and end dates to calculate each athlete’s allowance. Existing attendance will be included automatically.</p></CardContent></Card> : <>
      <p className="text-sm text-muted-foreground">{season.startsOn} to {season.endsOn} · Separate limits for cheer and required gymnastics: 4 excused and 2 unexcused. Counts include sessions through {data.today}.</p>
      <DashboardStatGrid stats={[
        { label: "Athletes", value: String(summaries.length), detail: `${summaries.filter((athlete) => athlete.policyApplies).length} cheer athletes subject to limits` },
        { label: "Approaching limit", value: String(summaries.filter((athlete) => athlete.standing === "approaching").length), detail: "3 excused or 1 unexcused", tone: "warning" },
        { label: "At / over limit", value: String(summaries.filter((athlete) => ["at-limit", "over-limit"].includes(athlete.standing)).length), detail: "Review attendance history", tone: attention.length ? "danger" : "default" },
        { label: "Missing attendance", value: String(summaries.reduce((sum, athlete) => sum + athlete.incomplete, 0)), detail: "Unmarked athlete sessions; excluded from absences" },
      ]} />
      <Card><CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm font-medium">Search athletes / parents<div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Name, parent, or program" /></div></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Team / class<SmartSelect className="h-10 rounded-md border bg-background px-3" value={program} onValueChange={(value) => { setProgram(value); setPage(0) }} options={[{ value: "all", label: "All teams and classes" }, ...programOptions.map(([value, label]) => ({ value, label }))]} /></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Attendance standing<SmartSelect className="h-10 rounded-md border bg-background px-3" value={standing} onValueChange={(value) => { setStanding(value); setPage(0) }} options={[{ value: "all", label: "All athletes" }, { value: "attention", label: "Approaching, at or over limits" }, ...Object.entries(standingLabels).map(([value, label]) => ({ value, label })), { value: "incomplete", label: "Missing attendance" }]} /></label>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm"><p>{filtered.length} athletes · Priority order</p><Button variant="ghost" onClick={() => { setSearch(""); setProgram("all"); setStanding("all"); setPage(0) }}>Reset filters</Button></div>
        <ul className="space-y-3" aria-label="Season attendance by athlete">
          {visible.map((athlete) => <li key={athlete.id} className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)] lg:gap-6">
            <div className="min-w-0">
              <Button variant="link" className="h-auto max-w-full whitespace-normal break-words p-0 text-left text-base font-semibold" onClick={() => setSelectedId(athlete.id)} aria-label={`View attendance history for ${athlete.name}`}>{athlete.name}</Button>
              <p className="mt-1 break-words text-xs text-muted-foreground">{athlete.parentName}</p>
              <div className="mt-2 flex flex-wrap gap-2"><AttendanceStandingBadge standing={athlete.standing} />{athlete.incomplete ? <Badge variant="warning">{athlete.incomplete} missing {athlete.incomplete === 1 ? "mark" : "marks"}</Badge> : null}</div>
            </div>
            <AthleteSeasonCounts athlete={athlete} cheerMemberships={data.cheerMemberships.filter((membership) => membership.athleteId === athlete.id)} />
          </li>)}
        </ul>
        {!filtered.length ? <p className="py-8 text-center text-sm text-muted-foreground">No athletes match these filters.</p> : null}
        <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Page {currentPage + 1} of {pageCount}</p><div className="flex gap-2"><Button variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>
      </CardContent></Card>
    </>}
    <Dialog open={Boolean(selected && season)} onOpenChange={(open) => { if (!open) setSelectedId(null) }}><DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">{selected && season ? <AthleteDetails athlete={selected} data={data} season={season} /> : null}</DialogContent></Dialog>
  </>
}
