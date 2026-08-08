"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import type Stripe from "stripe"

import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { sendContactEmail } from "@/lib/contact/email"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe, getSubscriptionPeriod } from "@/lib/stripe/server"

type ActionResult = {
  ok: boolean
  message: string
  warning?: string
}

const adminStatuses = ["pending", "approved", "active", "denied", "canceled"] as const
type AdminEnrollmentStatus = (typeof adminStatuses)[number]

type AvailableClassSchedule = {
  scheduleId: string
  classId: string | null
}

type ReassignmentClassRecord = {
  class_id: string | number
  class_name?: string | null
  stripe_price_id?: string | null
}

type ReassignmentEnrollmentRecord = {
  enrollment_id: string | number
  athlete_id?: string | number | null
  class_id?: string | number | null
  schedule_id?: string | number | null
  status?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_status?: string | null
}

type EnrollmentOwnerAthlete = {
  athlete_id?: string | number | null
  user_id?: string | null
  parent_id?: string | number | null
  Parents?:
    | {
        parent_id?: string | number | null
        user_id?: string | null
      }
    | {
        parent_id?: string | number | null
        user_id?: string | null
      }[]
    | null
}

type ParentScheduleSelectionEnrollmentRecord = {
  enrollment_id: string | number
  athlete_id?: string | number | null
  class_id?: string | number | null
  schedule_id?: string | number | null
  selection_required?: boolean | null
  status?: string | null
  Athletes?: EnrollmentOwnerAthlete | EnrollmentOwnerAthlete[] | null
}

type EnrollmentDecisionStatus = "approved" | "denied"

type EnrollmentDecisionParent = {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

type EnrollmentDecisionAthlete = {
  first_name?: string | null
  last_name?: string | null
  Parents?: EnrollmentDecisionParent | EnrollmentDecisionParent[] | null
}

type EnrollmentDecisionClass = {
  class_id?: string | number | null
  class_name?: string | null
}

type EnrollmentDecisionSchedule = {
  schedule_id?: string | number | null
  class_id?: string | number | null
  day_of_week?: string | number | null
  start_time?: string | null
  end_time?: string | null
  Classes?: EnrollmentDecisionClass | EnrollmentDecisionClass[] | null
}

type EnrollmentDecisionRecord = {
  enrollment_id: string | number
  class_id?: string | number | null
  schedule_id?: string | number | null
  status?: string | null
  Athletes?: EnrollmentDecisionAthlete | EnrollmentDecisionAthlete[] | null
  ClassSchedules?:
    | EnrollmentDecisionSchedule
    | EnrollmentDecisionSchedule[]
    | null
}

type EnrollmentDecisionContext = {
  enrollmentId: string
  previousStatus: string
  athleteName: string
  parentName: string
  parentEmail: string | null
  className: string
  scheduleLabel: string | null
}

const enrollmentDecisionStatuses = new Set<EnrollmentDecisionStatus>([
  "approved",
  "denied",
])

function isAdminEnrollmentStatus(value: string): value is AdminEnrollmentStatus {
  return adminStatuses.includes(value as AdminEnrollmentStatus)
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toId(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value)
}

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = "Unknown"
) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || fallback
}

function formatEnrollmentDay(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 0 || value === 7) {
      return "Sunday"
    }

    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]

    return days[value - 1] ?? String(value)
  }

  const normalized = String(value ?? "").trim().toLowerCase()
  const numericDay = Number(normalized)

  if (normalized && Number.isInteger(numericDay)) {
    return formatEnrollmentDay(numericDay)
  }

  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "Unscheduled"
}

function formatEnrollmentTime(value: string | null | undefined) {
  if (!value) {
    return "Time TBD"
  }

  const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
  const hour = Number(timeMatch?.[1])
  const minute = Number(timeMatch?.[2] ?? "00")

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value
  }

  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
}

function formatEnrollmentScheduleLabel(
  schedule: EnrollmentDecisionSchedule | null
) {
  if (!schedule) {
    return null
  }

  return `${formatEnrollmentDay(schedule.day_of_week)} ${formatEnrollmentTime(
    schedule.start_time
  )} - ${formatEnrollmentTime(schedule.end_time)}`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown email error."
}

function shouldSendEnrollmentDecisionEmail(
  previousStatus: string,
  nextStatus: AdminEnrollmentStatus
): nextStatus is EnrollmentDecisionStatus {
  return (
    previousStatus.trim().toLowerCase() === "pending" &&
    enrollmentDecisionStatuses.has(nextStatus as EnrollmentDecisionStatus)
  )
}

async function getAvailableClassSchedule(scheduleId: string): Promise<
  | (ActionResult & {
      ok: false
    })
  | ({
      ok: true
      message: string
    } & AvailableClassSchedule)
> {
  const supabase = createAdminClient()
  const { data: scheduleRecord, error: scheduleError } = await supabase
    .from("ClassSchedules")
    .select("schedule_id,class_id,is_active,season_id")
    .eq("schedule_id", scheduleId)
    .maybeSingle()

  if (scheduleError || !scheduleRecord) {
    return {
      ok: false as const,
      message: scheduleError?.message ?? "Class schedule was not found.",
    }
  }

  if (scheduleRecord.is_active === false) {
    return {
      ok: false as const,
      message: "Choose an active class schedule.",
    }
  }

  if (
    scheduleRecord.season_id === null ||
    scheduleRecord.season_id === undefined
  ) {
    return {
      ok: false as const,
      message: "Choose a schedule in the active season.",
    }
  }

  const { data: seasonRecord, error: seasonError } = await supabase
    .from("ScheduleSeasons")
    .select("is_active")
    .eq("season_id", String(scheduleRecord.season_id))
    .maybeSingle()

  if (seasonError || !seasonRecord) {
    return {
      ok: false as const,
      message: seasonError?.message ?? "Schedule season was not found.",
    }
  }

  if (seasonRecord.is_active !== true) {
    return {
      ok: false as const,
      message: "Choose a schedule in the active season.",
    }
  }

  return {
    ok: true as const,
    message: "",
    scheduleId: String(scheduleRecord.schedule_id),
    classId:
      scheduleRecord.class_id === null || scheduleRecord.class_id === undefined
        ? null
        : String(scheduleRecord.class_id),
  }
}

function getStripeCustomerId(
  value: string | { id: string } | null | undefined
) {
  if (!value) {
    return null
  }

  return typeof value === "string" ? value : value.id
}

async function updateStripeSubscriptionForReassignment({
  enrollment,
  classRecord,
  scheduleId,
}: {
  enrollment: ReassignmentEnrollmentRecord
  classRecord: ReassignmentClassRecord
  scheduleId: string
}) {
  if (!enrollment.stripe_subscription_id) {
    return null
  }

  const stripePriceId = classRecord.stripe_price_id?.trim()

  if (!stripePriceId) {
    throw new Error(
      "The new class needs a Stripe price ID before a subscribed enrollment can be reassigned."
    )
  }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(
    enrollment.stripe_subscription_id
  )
  const subscriptionItems = subscription.items.data

  if (subscriptionItems.length !== 1) {
    throw new Error(
      "This Stripe subscription has more than one item. Reassign it in Stripe manually, then update the enrollment."
    )
  }

  const subscriptionItem = subscriptionItems[0]
  const metadata: Record<string, string> = {
    ...subscription.metadata,
    enrollment_id: String(enrollment.enrollment_id),
    class_id: String(classRecord.class_id),
    schedule_id: scheduleId,
  }

  if (enrollment.athlete_id !== null && enrollment.athlete_id !== undefined) {
    metadata.athlete_id = String(enrollment.athlete_id)
  }

  if (subscriptionItem.price.id === stripePriceId) {
    return stripe.subscriptions.update(subscription.id, {
      metadata,
    })
  }

  return stripe.subscriptions.update(subscription.id, {
    items: [
      {
        id: subscriptionItem.id,
        price: stripePriceId,
        quantity: subscriptionItem.quantity ?? 1,
      },
    ],
    metadata,
    payment_behavior: "allow_incomplete",
    proration_behavior: "create_prorations",
  })
}

async function getEnrollmentDecisionContext(
  enrollmentId: string
): Promise<
  | { ok: true; context: EnrollmentDecisionContext }
  | { ok: false; message: string }
> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Enrollments")
    .select(
      `
        enrollment_id,
        class_id,
        schedule_id,
        status,
        Athletes(
          first_name,
          last_name,
          Parents(first_name, last_name, email)
        ),
        ClassSchedules(
          schedule_id,
          class_id,
          day_of_week,
          start_time,
          end_time,
          Classes(class_id, class_name)
        )
      `
    )
    .eq("enrollment_id", enrollmentId)
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
      message: "Enrollment was not found.",
    }
  }

  const enrollment = data as EnrollmentDecisionRecord
  const athlete = firstRelation(enrollment.Athletes)
  const parent = firstRelation(athlete?.Parents)
  const classSchedule = firstRelation(enrollment.ClassSchedules)
  const classRecord = firstRelation(classSchedule?.Classes)
  const classId = toId(
    enrollment.class_id ?? classSchedule?.class_id ?? classRecord?.class_id
  )

  return {
    ok: true,
    context: {
      enrollmentId: String(enrollment.enrollment_id),
      previousStatus: enrollment.status?.trim().toLowerCase() || "unknown",
      athleteName: getDisplayName(
        athlete?.first_name,
        athlete?.last_name,
        "Unknown athlete"
      ),
      parentName: getDisplayName(
        parent?.first_name,
        parent?.last_name,
        "there"
      ),
      parentEmail: parent?.email?.trim() || null,
      className:
        classRecord?.class_name?.trim() ||
        (classId ? `Class #${classId}` : "Selected class"),
      scheduleLabel: formatEnrollmentScheduleLabel(classSchedule ?? null),
    },
  }
}

function buildEnrollmentDecisionMessage({
  context,
  status,
}: {
  context: EnrollmentDecisionContext
  status: EnrollmentDecisionStatus
}) {
  const decisionLine =
    status === "approved"
      ? `Your enrollment request for ${context.athleteName} has been approved.`
      : `Your enrollment request for ${context.athleteName} was not approved at this time.`
  const lines = [
    `Hello ${context.parentName},`,
    "",
    decisionLine,
    "",
    `Class: ${context.className}`,
  ]

  if (context.scheduleLabel) {
    lines.push(`Schedule: ${context.scheduleLabel}`)
  }

  lines.push("")

  if (status === "approved") {
    lines.push(
      "Please sign in to your account to review the enrollment and complete payment to activate the enrollment. If you have any questions, please contact us."
    )
  } else {
    lines.push(
      "Please contact us if you have questions or would like help finding another class option."
    )
  }

  lines.push("", "Thank you,", "Limitless Cheer and Gymnastics")

  return lines.join("\n")
}

async function sendEnrollmentDecisionEmail({
  context,
  status,
}: {
  context: EnrollmentDecisionContext
  status: EnrollmentDecisionStatus
}) {
  if (!context.parentEmail) {
    return {
      ok: false,
      message: "No parent email address was found, so no email was sent.",
    }
  }

  const subject =
    status === "approved"
      ? `LCC Enrollment Approved: ${context.athleteName}`
      : `LCC Enrollment Denied: ${context.athleteName}`

  try {
    await sendContactEmail({
      email: process.env.CONTACT_FROM_EMAIL,
      to: context.parentEmail,
      subject,
      message: buildEnrollmentDecisionMessage({ context, status }),
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

async function updateEnrollmentStatus(
  enrollmentId: string,
  status: AdminEnrollmentStatus
): Promise<ActionResult> {
  const session = requireAdminSession(await getAccountSession())
  const normalizedEnrollmentId = enrollmentId.trim()

  if (!normalizedEnrollmentId) {
    return {
      ok: false,
      message: "Choose an enrollment before updating its status.",
    }
  }

  const contextResult = await getEnrollmentDecisionContext(normalizedEnrollmentId)

  if (!contextResult.ok) {
    return {
      ok: false,
      message: contextResult.message,
    }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("Enrollments")
    .update({ status })
    .eq("enrollment_id", normalizedEnrollmentId)

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  const actor = session.roles.includes("owner") ? "owner" : "admin"
  const baseMessage = `Enrollment ${status} by ${actor}.`
  let emailMessage: string | null = null
  let warning: string | undefined

  if (
    shouldSendEnrollmentDecisionEmail(
      contextResult.context.previousStatus,
      status
    )
  ) {
    const emailResult = await sendEnrollmentDecisionEmail({
      context: contextResult.context,
      status,
    })

    if (emailResult.ok) {
      emailMessage = emailResult.message
    } else {
      warning = emailResult.message
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: emailMessage ? `${baseMessage} ${emailMessage}` : baseMessage,
    warning,
  }
}

export async function approveEnrollment(enrollmentId: string) {
  return updateEnrollmentStatus(enrollmentId, "approved")
}

export async function denyEnrollment(enrollmentId: string) {
  return updateEnrollmentStatus(enrollmentId, "denied")
}

export async function updateEnrollmentAdminStatus({
  enrollmentId,
  status,
}: {
  enrollmentId: string
  status: string
}) {
  if (!isAdminEnrollmentStatus(status)) {
    return {
      ok: false,
      message: "That enrollment status is not supported.",
    }
  }

  return updateEnrollmentStatus(enrollmentId, status)
}

export async function createAdminEnrollment({
  athleteId,
  parentId,
  classId,
  scheduleId,
  status,
}: {
  athleteId: string
  parentId?: string | null
  classId: string
  scheduleId: string
  status: string
}): Promise<ActionResult & { enrollmentId?: string }> {
  requireAdminSession(await getAccountSession())

  const normalizedAthleteId = athleteId.trim()
  const normalizedScheduleId = scheduleId.trim()
  const normalizedClassId = classId.toString().trim()
  const normalizedParentId = parentId?.trim() || null
  const normalizedStatus = status.trim().toLowerCase()

  if (!normalizedAthleteId || !normalizedScheduleId || !normalizedClassId) {
    return {
      ok: false,
      message: "Choose an athlete, class, and class schedule before creating an enrollment.",
    }
  }

  if (!isAdminEnrollmentStatus(normalizedStatus)) {
    return {
      ok: false,
      message: "That enrollment status is not supported.",
    }
  }

  const supabase = createAdminClient()
  const { data: athlete, error: athleteError } = await supabase
    .from("Athletes")
    .select("athlete_id,parent_id")
    .eq("athlete_id", normalizedAthleteId)
    .maybeSingle()

  if (athleteError || !athlete) {
    return {
      ok: false,
      message: athleteError?.message ?? "Athlete was not found.",
    }
  }

  const scheduleRecord = await getAvailableClassSchedule(normalizedScheduleId)

  if (!scheduleRecord.ok) {
    return {
      ok: false,
      message: scheduleRecord.message,
    }
  }

  if (scheduleRecord.classId !== normalizedClassId) {
    return {
      ok: false,
      message: "Choose a schedule that belongs to the selected class.",
    }
  }

  const resolvedParentId =
    normalizedParentId ??
    (athlete.parent_id === null || athlete.parent_id === undefined
      ? null
      : String(athlete.parent_id))

  if (!resolvedParentId) {
    return {
      ok: false,
      message: "The selected athlete does not have a linked parent account.",
    }
  }

  const { data: existingEnrollment, error: existingError } = await supabase
    .from("Enrollments")
    .select("enrollment_id,status")
    .eq("athlete_id", normalizedAthleteId)
    .eq("schedule_id", normalizedScheduleId)
    .in("status", ["pending", "approved", "active"])
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
      message: `This athlete already has a ${existingEnrollment.status} enrollment for that class schedule.`,
    }
  }

  const { data, error } = await supabase
    .from("Enrollments")
    .insert([
      {
        athlete_id: normalizedAthleteId,
        class_id: normalizedClassId,
        schedule_id: normalizedScheduleId,
        parent_id: resolvedParentId,
        status: normalizedStatus,
      },
    ])
    .select("enrollment_id")
    .single()

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Enrollment created.",
    enrollmentId: String(data.enrollment_id),
  }
}

export async function reassignEnrollment({
  enrollmentId,
  classId,
  scheduleId,
  confirmed,
}: {
  enrollmentId: string
  classId: string
  scheduleId: string
  confirmed: boolean
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedEnrollmentId = enrollmentId.trim()
  const normalizedClassId = classId.trim()
  const normalizedScheduleId = scheduleId.trim()

  if (!confirmed) {
    return {
      ok: false,
      message: "Confirm the Stripe subscription impact before reassigning.",
    }
  }

  if (!normalizedEnrollmentId || !normalizedClassId || !normalizedScheduleId) {
    return {
      ok: false,
      message: "Choose an enrollment, class, and class schedule.",
    }
  }

  const supabase = createAdminClient()
  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("Enrollments")
    .select(
      "enrollment_id,athlete_id,class_id,schedule_id,status,stripe_customer_id,stripe_subscription_id,subscription_status"
    )
    .eq("enrollment_id", normalizedEnrollmentId)
    .maybeSingle()

  if (enrollmentError || !enrollmentData) {
    return {
      ok: false,
      message: enrollmentError?.message ?? "Enrollment was not found.",
    }
  }

  const enrollment = enrollmentData as ReassignmentEnrollmentRecord
  const scheduleRecord = await getAvailableClassSchedule(normalizedScheduleId)

  if (!scheduleRecord.ok) {
    return {
      ok: false,
      message: scheduleRecord.message,
    }
  }

  if (scheduleRecord.classId !== normalizedClassId) {
    return {
      ok: false,
      message: "Choose a schedule that belongs to the selected class.",
    }
  }

  if (String(enrollment.schedule_id ?? "") === normalizedScheduleId) {
    return {
      ok: false,
      message: "Choose a different schedule before reassigning.",
    }
  }

  const { data: classData, error: classError } = await supabase
    .from("Classes")
    .select("class_id,class_name,stripe_price_id")
    .eq("class_id", normalizedClassId)
    .maybeSingle()

  if (classError || !classData) {
    return {
      ok: false,
      message: classError?.message ?? "Class was not found.",
    }
  }

  const classRecord = classData as ReassignmentClassRecord

  if (enrollment.athlete_id !== null && enrollment.athlete_id !== undefined) {
    const { data: existingEnrollment, error: existingError } = await supabase
      .from("Enrollments")
      .select("enrollment_id,status")
      .eq("athlete_id", String(enrollment.athlete_id))
      .eq("schedule_id", normalizedScheduleId)
      .neq("enrollment_id", normalizedEnrollmentId)
      .in("status", ["pending", "approved", "active"])
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
        message: `This athlete already has a ${existingEnrollment.status} enrollment for that class schedule.`,
      }
    }
  }

  let stripeUpdated = false
  let updatedSubscription: Stripe.Subscription | null = null

  try {
    updatedSubscription = await updateStripeSubscriptionForReassignment({
      enrollment,
      classRecord,
      scheduleId: normalizedScheduleId,
    })
    stripeUpdated = Boolean(updatedSubscription)
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Stripe subscription could not be updated.",
    }
  }

  const updatePayload: {
    class_id: string
    schedule_id: string
    selection_required: boolean
    stripe_customer_id?: string | null
    stripe_subscription_id?: string
    subscription_status?: string
    current_period_start?: string | null
    current_period_end?: string | null
  } = {
    class_id: normalizedClassId,
    schedule_id: normalizedScheduleId,
    selection_required: false,
  }

  if (updatedSubscription) {
    const period = getSubscriptionPeriod(updatedSubscription)
    updatePayload.stripe_customer_id = getStripeCustomerId(
      updatedSubscription.customer
    )
    updatePayload.stripe_subscription_id = updatedSubscription.id
    updatePayload.subscription_status = updatedSubscription.status
    updatePayload.current_period_start = period.currentPeriodStart
    updatePayload.current_period_end = period.currentPeriodEnd
  }

  const { error: updateError } = await supabase
    .from("Enrollments")
    .update(updatePayload)
    .eq("enrollment_id", normalizedEnrollmentId)

  if (updateError) {
    return {
      ok: false,
      message: stripeUpdated
        ? `Stripe was updated, but the enrollment could not be saved locally: ${updateError.message}`
        : updateError.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: stripeUpdated
      ? "Enrollment reassigned and Stripe subscription updated."
      : "Enrollment reassigned.",
  }
}

export async function selectEnrollmentScheduleSlot({
  enrollmentId,
  scheduleId,
}: {
  enrollmentId: string
  scheduleId: string
}): Promise<ActionResult> {
  const session = await getAccountSession()

  if (!session?.userId) {
    return {
      ok: false,
      message: "You must be signed in to choose an enrollment schedule.",
    }
  }

  const normalizedEnrollmentId = enrollmentId.trim()
  const normalizedScheduleId = scheduleId.trim()

  if (!normalizedEnrollmentId || !normalizedScheduleId) {
    return {
      ok: false,
      message: "Choose an enrollment and class schedule.",
    }
  }

  const supabase = createAdminClient()
  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("Enrollments")
    .select(
      "enrollment_id,athlete_id,class_id,schedule_id,status,selection_required,Athletes(athlete_id,user_id,parent_id,Parents(parent_id,user_id))"
    )
    .eq("enrollment_id", normalizedEnrollmentId)
    .maybeSingle()

  if (enrollmentError || !enrollmentData) {
    return {
      ok: false,
      message: enrollmentError?.message ?? "Enrollment was not found.",
    }
  }

  const enrollment =
    enrollmentData as ParentScheduleSelectionEnrollmentRecord
  const athlete = firstRelation(enrollment.Athletes)
  const parent = firstRelation(athlete?.Parents)
  const ownsEnrollment =
    athlete?.user_id === session.userId || parent?.user_id === session.userId

  if (!ownsEnrollment) {
    return {
      ok: false,
      message: "You can only choose schedules for your own athletes.",
    }
  }

  if (enrollment.selection_required !== true) {
    return {
      ok: false,
      message: "This enrollment does not require a schedule selection.",
    }
  }

  const scheduleRecord = await getAvailableClassSchedule(normalizedScheduleId)

  if (!scheduleRecord.ok) {
    return {
      ok: false,
      message: scheduleRecord.message,
    }
  }

  if (!scheduleRecord.classId) {
    return {
      ok: false,
      message: "Choose a schedule that belongs to a class.",
    }
  }

  let enrollmentClassId =
    enrollment.class_id === null || enrollment.class_id === undefined
      ? null
      : String(enrollment.class_id)

  if (!enrollmentClassId && enrollment.schedule_id) {
    const { data: currentSchedule, error: currentScheduleError } =
      await supabase
        .from("ClassSchedules")
        .select("class_id")
        .eq("schedule_id", String(enrollment.schedule_id))
        .maybeSingle()

    if (currentScheduleError) {
      return {
        ok: false,
        message: currentScheduleError.message,
      }
    }

    enrollmentClassId =
      currentSchedule?.class_id === null ||
      currentSchedule?.class_id === undefined
        ? null
        : String(currentSchedule.class_id)
  }

  if (!enrollmentClassId) {
    return {
      ok: false,
      message: "This enrollment is missing class information.",
    }
  }

  if (scheduleRecord.classId !== enrollmentClassId) {
    return {
      ok: false,
      message: "Choose a schedule for the enrolled class.",
    }
  }

  if (enrollment.athlete_id !== null && enrollment.athlete_id !== undefined) {
    const { data: existingEnrollment, error: existingError } = await supabase
      .from("Enrollments")
      .select("enrollment_id,status")
      .eq("athlete_id", String(enrollment.athlete_id))
      .eq("schedule_id", normalizedScheduleId)
      .neq("enrollment_id", normalizedEnrollmentId)
      .in("status", ["pending", "approved", "active"])
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
        message: `This athlete already has a ${existingEnrollment.status} enrollment for that class schedule.`,
      }
    }
  }

  const { error: updateError } = await supabase
    .from("Enrollments")
    .update({
      class_id: scheduleRecord.classId,
      schedule_id: normalizedScheduleId,
      selection_required: false,
    })
    .eq("enrollment_id", normalizedEnrollmentId)

  if (updateError) {
    return {
      ok: false,
      message: updateError.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Enrollment schedule updated.",
  }
}

export async function requestEnrollment({
  athleteId,
  classId,
  scheduleId,
}: {
  athleteId: string
  classId: string | number
  scheduleId: string | number
}): Promise<ActionResult & { enrollmentId?: string }> {
  const session = await getAccountSession()

  if (!session?.userId) {
    return {
      ok: false,
      message: "You must be signed in to request an enrollment.",
    }
  }

  const supabase = createAdminClient()
  const normalizedScheduleId = String(scheduleId).trim()
  const normalizedClassId = String(classId).trim()

  if (!normalizedScheduleId) {
    return {
      ok: false,
      message: "Choose a class schedule before requesting enrollment.",
    }
  }

  const { data: athlete, error: athleteError } = await supabase
    .from("Athletes")
    .select("athlete_id,user_id,parent_id")
    .eq("athlete_id", athleteId)
    .maybeSingle()

  if (athleteError || !athlete) {
    return {
      ok: false,
      message: athleteError?.message ?? "Athlete was not found.",
    }
  }

  if (athlete.user_id !== session.userId) {
    return {
      ok: false,
      message: "You can only request enrollments for your own athletes.",
    }
  }

  const scheduleRecord = await getAvailableClassSchedule(normalizedScheduleId)

  if (!scheduleRecord.ok) {
    return {
      ok: false,
      message: scheduleRecord.message,
    }
  }

  if (scheduleRecord.classId !== normalizedClassId) {
    return {
      ok: false,
      message: "Choose a schedule that belongs to the selected class.",
    }
  }

  const { data: existingEnrollment, error: existingError } = await supabase
    .from("Enrollments")
    .select("enrollment_id,status")
    .eq("athlete_id", athleteId)
    .eq("schedule_id", normalizedScheduleId)
    .in("status", ["pending", "approved", "active"])
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
      message: `This athlete already has a ${existingEnrollment.status} enrollment for that class schedule.`,
    }
  }

  const { data, error } = await supabase
    .from("Enrollments")
    .insert([
      {
        athlete_id: athleteId,
        class_id: normalizedClassId,
        schedule_id: normalizedScheduleId,
        status: "pending",
      },
    ])
    .select("enrollment_id")
    .single()

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Your enrollment request was submitted.",
    enrollmentId: String(data.enrollment_id),
  }
}

export async function cancelEnrollmentRequest(
  enrollmentId: string
): Promise<ActionResult> {
  const session = await getAccountSession()

  if (!session?.userId) {
    return {
      ok: false,
      message: "You must be signed in to cancel an enrollment request.",
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Enrollments")
    .select(
      "enrollment_id,status,Athletes(athlete_id,user_id,parent_id,Parents(parent_id,user_id))"
    )
    .eq("enrollment_id", enrollmentId)
    .maybeSingle()

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Enrollment was not found.",
    }
  }

  const athlete = Array.isArray(data.Athletes)
    ? data.Athletes[0]
    : data.Athletes
  const parent = Array.isArray(athlete?.Parents)
    ? athlete?.Parents[0]
    : athlete?.Parents
  const ownsEnrollment =
    athlete?.user_id === session.userId || parent?.user_id === session.userId

  if (!ownsEnrollment) {
    return {
      ok: false,
      message: "You can only cancel enrollment requests for your own athletes.",
    }
  }

  if (data.status !== "pending") {
    return {
      ok: false,
      message: "Only pending enrollment requests can be canceled here.",
    }
  }

  const { error: updateError } = await supabase
    .from("Enrollments")
    .update({ status: "canceled" })
    .eq("enrollment_id", enrollmentId)

  if (updateError) {
    return {
      ok: false,
      message: updateError.message,
    }
  }

  revalidatePath("/account")

  return {
    ok: true,
    message: "Enrollment request canceled.",
  }
}

export async function updateClassBillingConfig({
  classId,
  className,
  description,
  billingDay,
  stripePriceId,
}: {
  classId?: string | null
  className: string
  description?: string | null
  billingDay: number
  stripePriceId: string
}): Promise<ActionResult> {
  requireAdminSession(await getAccountSession())

  const normalizedPriceId = stripePriceId.trim()

  if (billingDay !== 1 && billingDay !== 15) {
    return {
      ok: false,
      message: "Billing day must be 1 or 15.",
    }
  }

  if (normalizedPriceId && !normalizedPriceId.startsWith("price_")) {
    return {
      ok: false,
      message: "Stripe price IDs usually start with price_.",
    }
  }

  const supabase = createAdminClient()
  const payload = {
    class_name: className.trim() || "Untitled class",
    class_description: description?.trim() || null,
    type: "gymnastics",
    program_type: "gymnastics",
    billing_day: billingDay,
    stripe_price_id: normalizedPriceId || null,
  }
  const mutation = classId
    ? supabase
        .from("Classes")
        .upsert({
          class_id: classId,
          ...payload,
        })
    : supabase.from("Classes").insert(payload)
  const { error } = await mutation

  if (error) {
    return {
      ok: false,
      message:
        "Class billing columns are missing or the class could not be saved. Apply the billing migration, then try again.",
    }
  }

  revalidatePath("/account")
  revalidateTag("public-class-data", "max")

  return {
    ok: true,
    message: "Class billing settings updated.",
  }
}
