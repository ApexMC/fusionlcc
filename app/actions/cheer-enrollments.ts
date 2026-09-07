"use server"

import { revalidatePath } from "next/cache"

import {
  getAccountSession,
  getParentForUser,
  requireAdminSession,
} from "@/lib/account/auth"
import { sendContactEmail } from "@/lib/contact/email"
import { BLOCKED_ENROLLMENT_MESSAGE } from "@/lib/enrollments"
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = {
  ok: boolean
  message: string
  warning?: string
}

const adminStatuses = [
  "pending",
  "approved",
  "active",
  "denied",
  "canceled",
] as const

type AdminEnrollmentStatus = (typeof adminStatuses)[number]

type CheerEnrollmentDecisionContext = {
  previousStatus: string
  athleteName: string
  parentName: string
  parentEmail: string | null
  teamName: string
}

function isAdminEnrollmentStatus(
  value: string
): value is AdminEnrollmentStatus {
  return adminStatuses.includes(value as AdminEnrollmentStatus)
}

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = "Unknown"
) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || fallback
}

function normalizeSignature(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown email error."
}

function getAccountUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (configuredUrl) {
    return `${configuredUrl.replace(/\/$/, "")}/account`
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/account`
  }

  return "https://fusionlcc.com/account"
}

async function getCheerEnrollmentDecisionContext(
  enrollmentId: string
): Promise<
  | { ok: true; context: CheerEnrollmentDecisionContext }
  | { ok: false; message: string }
> {
  const supabase = createAdminClient()
  const { data: enrollment, error: enrollmentError } = await supabase
    .from("CheerEnrollments")
    .select("enrollment_id,athlete_id,parent_id,team_id,status")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle()

  if (enrollmentError || !enrollment) {
    return {
      ok: false,
      message: enrollmentError?.message ?? "Cheer enrollment was not found.",
    }
  }

  const athleteId =
    enrollment.athlete_id === null || enrollment.athlete_id === undefined
      ? null
      : String(enrollment.athlete_id)
  const teamId =
    enrollment.team_id === null || enrollment.team_id === undefined
      ? null
      : String(enrollment.team_id)
  const [athleteResult, teamResult] = await Promise.all([
    athleteId
      ? supabase
          .from("Athletes")
          .select("first_name,last_name,parent_id")
          .eq("athlete_id", athleteId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    teamId
      ? supabase
          .from("CheerTeams")
          .select("team_name")
          .eq("team_id", teamId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (athleteResult.error || teamResult.error) {
    return {
      ok: false,
      message:
        athleteResult.error?.message ??
        teamResult.error?.message ??
        "Cheer enrollment details could not be loaded.",
    }
  }

  const parentIdValue = enrollment.parent_id ?? athleteResult.data?.parent_id
  const parentId =
    parentIdValue === null || parentIdValue === undefined
      ? null
      : String(parentIdValue)
  const parentResult = parentId
    ? await supabase
        .from("Parents")
        .select("first_name,last_name,email")
        .eq("parent_id", parentId)
        .maybeSingle()
    : { data: null, error: null }

  if (parentResult.error) {
    return {
      ok: false,
      message: parentResult.error.message,
    }
  }

  return {
    ok: true,
    context: {
      previousStatus: enrollment.status?.trim().toLowerCase() || "unknown",
      athleteName: getDisplayName(
        athleteResult.data?.first_name,
        athleteResult.data?.last_name,
        athleteId ? `Athlete #${athleteId}` : "Your athlete"
      ),
      parentName: getDisplayName(
        parentResult.data?.first_name,
        parentResult.data?.last_name,
        "there"
      ),
      parentEmail: parentResult.data?.email?.trim() || null,
      teamName:
        teamResult.data?.team_name?.trim() ||
        (teamId ? `Team #${teamId}` : "their cheer team"),
    },
  }
}

function buildCheerApprovalMessage(context: CheerEnrollmentDecisionContext) {
  return [
    `Hello ${context.parentName},`,
    "",
    `Congratulations! ${context.athleteName} made ${context.teamName}!`,
    "",
    `Team: ${context.teamName}`,
    "",
    "Please sign in and visit your account dashboard to review and sign the cheer contract:",
    getAccountUrl(),
    "",
    "After signing the contract, follow the payment instructions on your dashboard to process payment for this enrollment.",
    "",
    "We are excited to welcome you to the team!",
    "",
    "Thank you,",
    "Limitless Cheer and Gymnastics",
  ].join("\n")
}

async function sendCheerApprovalEmail(
  context: CheerEnrollmentDecisionContext
): Promise<ActionResult> {
  if (!context.parentEmail) {
    return {
      ok: false,
      message: "No parent email address was found, so no email was sent.",
    }
  }

  try {
    await sendContactEmail({
      email: process.env.CONTACT_FROM_EMAIL,
      to: context.parentEmail,
      subject: `Congratulations! ${context.athleteName} Made ${context.teamName}`,
      message: buildCheerApprovalMessage(context),
    })
  } catch (error) {
    return {
      ok: false,
      message: `Parent email failed to send: ${getErrorMessage(error)}`,
    }
  }

  return {
    ok: true,
    message: `Parent email sent to ${context.parentEmail}.`,
  }
}

function revalidateEnrollmentPages() {
  revalidatePath("/account")
  revalidatePath("/account/admin/enrollments")
  revalidatePath("/competitive-cheer/request-tryout")
}

async function createCheerEnrollment({
  athleteId,
  teamId,
  status,
  expectedUserId,
}: {
  athleteId: string
  teamId: string
  status: AdminEnrollmentStatus
  expectedUserId?: string
}): Promise<ActionResult & { enrollmentId?: string }> {
  const normalizedAthleteId = athleteId.trim()
  const normalizedTeamId = teamId.trim()

  if (!normalizedAthleteId || !normalizedTeamId) {
    return {
      ok: false,
      message: "Choose an athlete and cheer team before submitting.",
    }
  }

  const supabase = createAdminClient()
  const [{ data: athlete, error: athleteError }, { data: team, error: teamError }] =
    await Promise.all([
      supabase
        .from("Athletes")
        .select("athlete_id,user_id,parent_id")
        .eq("athlete_id", normalizedAthleteId)
        .maybeSingle(),
      supabase
        .from("CheerTeams")
        .select("team_id")
        .eq("team_id", normalizedTeamId)
        .maybeSingle(),
    ])

  if (athleteError || !athlete) {
    return {
      ok: false,
      message: athleteError?.message ?? "Athlete was not found.",
    }
  }

  if (expectedUserId && athlete.user_id !== expectedUserId) {
    return {
      ok: false,
      message: "You can only request tryouts for athletes on your account.",
    }
  }

  if (teamError || !team) {
    return {
      ok: false,
      message: teamError?.message ?? "Cheer team was not found.",
    }
  }

  const { data: existingEnrollment, error: existingError } = await supabase
    .from("CheerEnrollments")
    .select("enrollment_id,status")
    .eq("athlete_id", normalizedAthleteId)
    .eq("team_id", normalizedTeamId)
    .in("status", ["pending", "approved", "active"])
    .limit(1)
    .maybeSingle()

  if (existingError) {
    return {
      ok: false,
      message: existingError.message,
    }
  }

  if (existingEnrollment) {
    return {
      ok: false,
      message: BLOCKED_ENROLLMENT_MESSAGE,
    }
  }

  const { data, error } = await supabase
    .from("CheerEnrollments")
    .insert({
      athlete_id: normalizedAthleteId,
      parent_id: athlete.parent_id ?? null,
      team_id: normalizedTeamId,
      status,
    })
    .select("enrollment_id")
    .single()

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidateEnrollmentPages()

  return {
    ok: true,
    message:
      status === "pending"
        ? "Your tryout request was submitted."
        : "Cheer enrollment created.",
    enrollmentId: String(data.enrollment_id),
  }
}

export async function requestCheerTryout({
  athleteId,
  teamId,
}: {
  athleteId: string
  teamId: string
}): Promise<ActionResult & { enrollmentId?: string }> {
  const session = await getAccountSession()

  if (!session?.userId) {
    return {
      ok: false,
      message: "You must be signed in to request a tryout.",
    }
  }

  return createCheerEnrollment({
    athleteId,
    teamId,
    status: "pending",
    expectedUserId: session.userId,
  })
}

export async function signCheerContract({
  enrollmentId,
  signature,
}: {
  enrollmentId: string
  signature: string
}): Promise<ActionResult> {
  const session = await getAccountSession()

  if (!session?.userId) {
    return {
      ok: false,
      message: "You must be signed in to sign the cheer contract.",
    }
  }

  const normalizedEnrollmentId = enrollmentId.trim()
  const normalizedSignature = signature.trim().replace(/\s+/g, " ")

  if (!normalizedEnrollmentId || !normalizedSignature) {
    return {
      ok: false,
      message: "Type your full name to sign the cheer contract.",
    }
  }

  if (normalizedSignature.length > 200) {
    return {
      ok: false,
      message: "The typed signature is too long.",
    }
  }

  const parent = await getParentForUser(session.userId)

  if (!parent) {
    return {
      ok: false,
      message: "A parent account is required to sign the cheer contract.",
    }
  }

  const expectedSignature = getDisplayName(
    parent.first_name,
    parent.last_name,
    ""
  )

  if (!expectedSignature) {
    return {
      ok: false,
      message:
        "Add your first and last name to your parent account before signing.",
    }
  }

  if (normalizeSignature(normalizedSignature) !== normalizeSignature(expectedSignature)) {
    return {
      ok: false,
      message: `Type ${expectedSignature} exactly as shown to sign the contract.`,
    }
  }

  const supabase = createAdminClient()
  const { data: enrollment, error: enrollmentError } = await supabase
    .from("CheerEnrollments")
    .select("enrollment_id,athlete_id,parent_id,status,contract_signed")
    .eq("enrollment_id", normalizedEnrollmentId)
    .maybeSingle()

  if (enrollmentError || !enrollment) {
    return {
      ok: false,
      message: enrollmentError?.message ?? "Cheer enrollment was not found.",
    }
  }

  const parentId = String(parent.parent_id)
  const enrollmentParentId =
    enrollment.parent_id === null || enrollment.parent_id === undefined
      ? null
      : String(enrollment.parent_id)
  let athleteBelongsToParent = false

  if (enrollment.athlete_id !== null && enrollment.athlete_id !== undefined) {
    const { data: athlete, error: athleteError } = await supabase
      .from("Athletes")
      .select("user_id,parent_id")
      .eq("athlete_id", enrollment.athlete_id)
      .maybeSingle()

    if (athleteError) {
      return {
        ok: false,
        message: athleteError.message,
      }
    }

    athleteBelongsToParent = Boolean(
      athlete &&
        (athlete.user_id === session.userId ||
          String(athlete.parent_id ?? "") === parentId)
    )
  }

  if (
    !athleteBelongsToParent ||
    (enrollmentParentId !== null && enrollmentParentId !== parentId)
  ) {
    return {
      ok: false,
      message: "This cheer enrollment does not belong to your account.",
    }
  }

  const status = enrollment.status?.trim().toLowerCase()

  if (status !== "approved" && status !== "active") {
    return {
      ok: false,
      message: "The cheer contract can be signed after enrollment approval.",
    }
  }

  if (enrollment.contract_signed === true) {
    return {
      ok: true,
      message: "The cheer contract is already signed.",
    }
  }

  const { data: updatedEnrollment, error: updateError } = await supabase
    .from("CheerEnrollments")
    .update({ contract_signed: true })
    .eq("enrollment_id", normalizedEnrollmentId)
    .select("enrollment_id")
    .maybeSingle()

  if (updateError || !updatedEnrollment) {
    return {
      ok: false,
      message: updateError?.message ?? "Cheer enrollment was not found.",
    }
  }

  revalidateEnrollmentPages()

  return {
    ok: true,
    message: "Cheer contract signed. You can now continue to payment.",
  }
}

export async function createAdminCheerEnrollment({
  athleteId,
  teamId,
  status,
}: {
  athleteId: string
  teamId: string
  status: string
}): Promise<ActionResult & { enrollmentId?: string }> {
  requireAdminSession(await getAccountSession())

  const normalizedStatus = status.trim().toLowerCase()

  if (!isAdminEnrollmentStatus(normalizedStatus)) {
    return {
      ok: false,
      message: "That cheer enrollment status is not supported.",
    }
  }

  return createCheerEnrollment({
    athleteId,
    teamId,
    status: normalizedStatus,
  })
}

export async function updateCheerEnrollmentAdminStatus({
  enrollmentId,
  status,
}: {
  enrollmentId: string
  status: string
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedEnrollmentId = enrollmentId.trim()
  const normalizedStatus = status.trim().toLowerCase()

  if (!normalizedEnrollmentId) {
    return {
      ok: false,
      message: "Choose a cheer enrollment before updating its status.",
    }
  }

  if (!isAdminEnrollmentStatus(normalizedStatus)) {
    return {
      ok: false,
      message: "That cheer enrollment status is not supported.",
    }
  }

  const contextResult = await getCheerEnrollmentDecisionContext(
    normalizedEnrollmentId
  )

  if (!contextResult.ok) {
    return contextResult
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerEnrollments")
    .update({ status: normalizedStatus })
    .eq("enrollment_id", normalizedEnrollmentId)
    .select("enrollment_id")
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  if (!data) {
    return {
      ok: false,
      message: "Cheer enrollment was not found.",
    }
  }

  revalidateEnrollmentPages()

  const baseMessage = `Cheer enrollment ${normalizedStatus}.`

  if (
    contextResult.context.previousStatus === "pending" &&
    normalizedStatus === "approved"
  ) {
    const emailResult = await sendCheerApprovalEmail(contextResult.context)

    if (emailResult.ok) {
      return {
        ok: true,
        message: `${baseMessage} ${emailResult.message}`,
      }
    }

    return {
      ok: true,
      message: baseMessage,
      warning: emailResult.message,
    }
  }

  return {
    ok: true,
    message: baseMessage,
  }
}
