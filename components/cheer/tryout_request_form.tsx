"use client"

import Image from "next/image"
import { useState } from "react"

import { requestCheerTryout } from "@/app/actions/cheer-enrollments"
import ManageAthleteCard from "@/components/account/athletes/manage_athlete"
import { SmartSelect } from "@/components/ui/smart-select"
import { BLOCKED_ENROLLMENT_MESSAGE } from "@/lib/enrollments"

const ADD_ATHLETE_VALUE = "__add_athlete__"

type AthleteOption = {
  athleteId: string
  athleteName: string
  blockedCheerTeamIds: string[]
}

type TeamOption = {
  teamId: string
  teamName: string
}

type ParentContact = {
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
}

export function TryoutRequestForm({
  athletes,
  teams,
  userId,
  parentId,
  parent,
}: {
  athletes: AthleteOption[]
  teams: TeamOption[]
  userId: string
  parentId?: string | number
  parent: ParentContact | null
}) {
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle")
  const [message, setMessage] = useState("")
  const [athleteId, setAthleteId] = useState(athletes[0]?.athleteId ?? "")
  const [teamId, setTeamId] = useState(teams[0]?.teamId ?? "")
  const [addAthleteOpen, setAddAthleteOpen] = useState(false)
  const selectedAthlete = athletes.find(
    (athlete) => athlete.athleteId === athleteId
  )
  const selectedAthleteHasBlockedEnrollment = Boolean(
    teamId && selectedAthlete?.blockedCheerTeamIds.includes(teamId)
  )
  const displayedMessage = selectedAthleteHasBlockedEnrollment
    ? BLOCKED_ENROLLMENT_MESSAGE
    : message
  const displayedStatus = selectedAthleteHasBlockedEnrollment ? "error" : status
  const canSubmit = Boolean(
    athleteId &&
      teamId &&
      status !== "sending" &&
      !selectedAthleteHasBlockedEnrollment
  )

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (selectedAthleteHasBlockedEnrollment) {
      return
    }

    setStatus("sending")
    setMessage("")

    try {
      const submittedAthlete = athletes.find(
        (athlete) => athlete.athleteId === athleteId
      )
      const selectedTeam = teams.find((team) => team.teamId === teamId)

      if (!submittedAthlete || !selectedTeam) {
        throw new Error("Please choose an athlete and cheer team.")
      }

      const result = await requestCheerTryout({ athleteId, teamId })

      if (!result.ok) {
        throw new Error(result.message)
      }

      const emailPayload = {
        email: parent?.email || "",
        subject: `LCC Competitive Cheer Tryout Request: ${submittedAthlete.athleteName}`,
        message: [
          `Parent Name: ${[parent?.firstName, parent?.lastName]
            .filter(Boolean)
            .join(" ")}`,
          `Athlete Name: ${submittedAthlete.athleteName}`,
          `Requested Team: ${selectedTeam.teamName}`,
          "",
          `Address: ${parent?.address ?? ""}, ${parent?.city ?? ""}, ${parent?.state ?? ""} ${parent?.zipCode ?? ""}`,
          `Phone Number: ${parent?.phone ?? ""}`,
          `Email: ${parent?.email ?? ""}`,
        ].join("\n"),
      }

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      })
      const responseData = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(responseData?.error || "Failed to send email.")
      }

      setStatus("success")
      setMessage("Thanks! Your tryout request has been submitted.")
    } catch (caughtError) {
      setStatus("error")
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again."
      )
    }
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="mt-10 w-full space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <Image
          src="/images/logos/limitless_logo.png"
          alt="Limitless Cheer and Gymnastics"
          width={125}
          height={125}
          className="mx-auto"
        />
        <div
          className="mx-auto mb-8 mt-4 flex justify-center"
          aria-hidden="true"
        >
          <div className="h-1.5 w-full max-w-sm rounded-full bg-linear-to-r from-purple-600 to-purple-600" />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Athlete
            <SmartSelect
              name="athlete"
              value={athleteId}
              onValueChange={(value) => {
                if (value === ADD_ATHLETE_VALUE) {
                  setAddAthleteOpen(true)
                  return
                }

                setAthleteId(value)
              }}
              options={[
                { value: "", label: "Select athlete", disabled: true },
                ...athletes.map((athlete) => ({
                  value: athlete.athleteId,
                  label: athlete.athleteName,
                })),
                { value: ADD_ATHLETE_VALUE, label: "+ Add Athlete" },
              ]}
              searchPlaceholder="Search athletes..."
              required
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Team
            <SmartSelect
              name="team"
              value={teamId}
              onValueChange={setTeamId}
              options={
                teams.length
                  ? teams.map((team) => ({
                      value: team.teamId,
                      label: team.teamName,
                    }))
                  : [{ value: "", label: "No cheer teams available" }]
              }
              searchPlaceholder="Search teams..."
              required
              disabled={!teams.length}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
        </div>

        <div className="flex flex-col items-center justify-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60 dark:text-white dark:hover:bg-purple-700"
          >
            {status === "sending" ? "Sending..." : "Request Tryout"}
          </button>

          <p
            aria-live="polite"
            className={`min-h-5 text-center text-sm ${
              displayedStatus === "success"
                ? "text-emerald-600 dark:text-emerald-400"
                : displayedStatus === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {displayedMessage}
          </p>
        </div>
      </form>
      <ManageAthleteCard
        userId={userId}
        parentId={parentId}
        icon="+ Add Athlete"
        open={addAthleteOpen}
        onOpenChange={setAddAthleteOpen}
        showTrigger={false}
      />
    </>
  )
}
