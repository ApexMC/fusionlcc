import type { AdminReportingData } from "@/lib/account/types"
import type { CsvRow } from "@/lib/account/reporting"

export type ReportIcon = "financial" | "customers" | "enrollments" | "athletes" | "schedules" | "timeClock"

export type ReportingExport = {
  title: string
  description: string
  filename: string
  rows: CsvRow[]
  icon: ReportIcon
  unavailableReason?: string
}

function getEntryHours(clockInAt: string, clockOutAt: string | null) {
  if (!clockOutAt) {
    return null
  }

  const start = new Date(clockInAt).getTime()
  const end = new Date(clockOutAt).getTime()

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null
  }

  return Number(((end - start) / 3_600_000).toFixed(2))
}

function buildSessionExportRows(data: AdminReportingData): CsvRow[] {
  const classRows = data.classSessions.flatMap<CsvRow>((session) => {
    const base = {
      "Program type": "Class",
      "Session ID": session.sessionId,
      Program: session.className,
      Schedule: session.scheduleLabel,
      Date: session.sessionDate,
      "Starts at": session.startsAt,
      "Ends at": session.endsAt,
      "Session status": session.status,
      "Session type": session.type,
    }

    if (!session.expectedAthletes.length) {
      return [{
        ...base,
        Athlete: "",
        Parent: "",
        "Enrollment status": "",
        "Attendance status": "",
        "Attendance notes": "",
        "Attendance reviewed at": "",
      }]
    }

    return session.expectedAthletes.map((athlete) => ({
      ...base,
      Athlete: athlete.athleteName,
      Parent: athlete.parentName,
      "Enrollment status": athlete.enrollmentStatus,
      "Attendance status": athlete.attendanceStatus,
      "Attendance notes": athlete.attendanceNotes,
      "Attendance reviewed at": athlete.attendanceReviewedAt,
    }))
  })

  const cheerRows = data.cheerSessions.map<CsvRow>((session) => ({
    "Program type": "Cheer",
    "Session ID": session.sessionId,
    Program: session.teamName,
    Schedule: session.scheduleLabel,
    Date: session.sessionDate,
    "Starts at": session.startsAt,
    "Ends at": session.endsAt,
    "Session status": session.status,
    "Session type": session.type,
    Athlete: "",
    Parent: "",
    "Enrollment status": "",
    "Attendance status": "",
    "Attendance notes": "",
    "Attendance reviewed at": "",
  }))

  return [...classRows, ...cheerRows]
}

function buildTimeClockExportRows(data: AdminReportingData): CsvRow[] {
  return data.timeClockReview.coaches.flatMap((coach) => {
    const entries = new Map(
      [...coach.currentPeriodEntries, ...coach.historyEntries].map((entry) => [
        entry.entryId,
        entry,
      ])
    )

    return Array.from(entries.values()).map((entry) => ({
      "Entry ID": entry.entryId,
      Coach: coach.coachName,
      "Coach phone": coach.coachPhone,
      "Work date": entry.workDate,
      "Clock in": entry.clockInAt,
      "Clock out": entry.clockOutAt,
      Hours: getEntryHours(entry.clockInAt, entry.clockOutAt),
      Status: entry.status,
      "Clock-in note": entry.clockInNote,
      "Clock-out note": entry.clockOutNote,
      "Created at": entry.createdAt,
      "Updated at": entry.updatedAt,
    }))
  })
}

export function buildReportingExports(
  data: AdminReportingData,
  subscriptionRows: CsvRow[]
): ReportingExport[] {
  const classEnrollmentRows: CsvRow[] = data.allEnrollments.map((enrollment) => ({
    "Enrollment ID": enrollment.enrollmentId,
    Athlete: enrollment.athleteName,
    Parent: enrollment.parentName,
    "Parent email": enrollment.parentEmail,
    "Parent phone": enrollment.parentPhone,
    Class: enrollment.className,
    "Class type": enrollment.classType,
    "Program type": enrollment.programType,
    Schedule: enrollment.scheduleLabel,
    "Enrollment status": enrollment.status,
    "Selection required": enrollment.selectionRequired,
    "Billing data available": enrollment.billingDataAvailable,
    "Subscription status": enrollment.subscriptionStatus,
    "Payment status": enrollment.paymentStatus,
    "Stripe customer ID": enrollment.stripeCustomerId,
    "Stripe subscription ID": enrollment.stripeSubscriptionId,
    "Current period start": enrollment.currentPeriodStart,
    "Current period end": enrollment.currentPeriodEnd,
    "Created at": enrollment.createdAt,
  }))

  const cheerEnrollmentRows: CsvRow[] = data.cheerEnrollments.map((enrollment) => ({
    "Enrollment ID": enrollment.enrollmentId,
    Athlete: enrollment.athleteName,
    Parent: enrollment.parentName,
    "Parent email": enrollment.parentEmail,
    "Parent phone": enrollment.parentPhone,
    Team: enrollment.teamName,
    Schedule: enrollment.scheduleLabel,
    "Enrollment status": enrollment.status,
    "Contract signed": enrollment.contractSigned,
    "Selection required": enrollment.selectionRequired,
    "Billing data available": enrollment.billingDataAvailable,
    "Subscription status": enrollment.subscriptionStatus,
    "Payment status": enrollment.paymentStatus,
    "Stripe customer ID": enrollment.stripeCustomerId,
    "Tuition subscription ID": enrollment.tuitionSubscriptionId,
    "Fee subscription ID": enrollment.feeSubscriptionId,
    "Current period start": enrollment.currentPeriodStart,
    "Current period end": enrollment.currentPeriodEnd,
    "Created at": enrollment.createdAt,
  }))

  const parentRows: CsvRow[] = data.reportingParents.map((parent) => ({
    "Parent ID": parent.parentId,
    Name: parent.parentName,
    Email: parent.email,
    Phone: parent.phone,
    Address: parent.address,
    City: parent.city,
    State: parent.state,
    ZIP: parent.zipCode,
    Balance: parent.balance,
    "Stripe customer ID": parent.stripeCustomerId,
  }))

  const athleteRows: CsvRow[] = data.reportingAthletes.map((athlete) => ({
    "Athlete ID": athlete.athleteId,
    Athlete: athlete.athleteName,
    "Date of birth": athlete.dateOfBirth,
    Phone: athlete.phone,
    "Shirt size": athlete.shirtSize,
    "Parent ID": athlete.parentId,
    Parent: athlete.parentName,
    "Parent email": athlete.parentEmail,
    "Parent phone": athlete.parentPhone,
  }))

  const billingRows: CsvRow[] = [
    ...data.classBilling.map((program) => ({
      "Program type": "Class",
      "Program ID": program.classId,
      Program: program.className,
      Type: program.classType,
      Description: program.classDescription,
      Category: program.programType,
      "Billing day": program.billingDay,
      "Primary price ID": program.stripePriceId,
      "Secondary price ID": "",
      "Billing ready": Boolean(
        program.stripePriceId && program.billingDay && program.programType
      ),
      "Created at": program.createdAt,
    })),
    ...data.cheerBilling.map((program) => ({
      "Program type": "Cheer",
      "Program ID": program.teamId,
      Program: program.teamName,
      Type: program.teamType,
      Description: program.teamDescription,
      Category: program.programType,
      "Billing day": program.billingDay,
      "Primary price ID": program.tuitionPriceId,
      "Secondary price ID": program.feePriceId,
      "Billing ready": Boolean(
        program.tuitionPriceId &&
          program.feePriceId &&
          program.billingDay &&
          program.programType
      ),
      "Created at": program.createdAt,
    })),
  ]

  const scheduleRows: CsvRow[] = [
    ...data.classSchedules.map((schedule) => ({
      "Program type": "Class",
      "Schedule ID": schedule.scheduleId,
      "Program ID": schedule.classId,
      Program: schedule.className,
      Schedule: schedule.scheduleLabel,
      Day: schedule.dayOfWeek,
      "Start time": schedule.startTime,
      "End time": schedule.endTime,
      Active: schedule.isActive,
      Season: schedule.season,
      "Active season": schedule.seasonIsActive,
      Enrollments: schedule.enrollmentCount,
      Athletes: schedule.athleteNames.join("; "),
      "Created at": schedule.createdAt,
    })),
    ...data.cheerSchedules.map((schedule) => ({
      "Program type": "Cheer",
      "Schedule ID": schedule.scheduleId,
      "Program ID": schedule.teamId,
      Program: schedule.teamName,
      Schedule: schedule.scheduleLabel,
      Day: schedule.dayOfWeek,
      "Start time": schedule.startTime,
      "End time": schedule.endTime,
      Active: schedule.isActive,
      Season: "",
      "Active season": "",
      Enrollments: schedule.enrollmentCount,
      Athletes: "",
      "Created at": schedule.createdAt,
    })),
  ]

  const sessionRows = buildSessionExportRows(data)

  const timeClockRows = buildTimeClockExportRows(data)

  return [
    {
      title: "Subscription coverage",
      description:
        "Every class and cheer enrollment, including who is active, missing a subscription, or needs attention.",
      filename: "subscription-coverage.csv",
      rows: subscriptionRows,
      icon: "financial",
    },
    {
      title: "Parent balances",
      description:
        "Customer contact details, balances, and Stripe customer identifiers.",
      filename: "parent-balances.csv",
      rows: parentRows,
      icon: "customers",
    },
    {
      title: "Billing catalog",
      description:
        "Class and cheer billing configuration with price IDs and setup readiness.",
      filename: "billing-catalog.csv",
      rows: billingRows,
      icon: "financial",
    },
    {
      title: "Class enrollments",
      description:
        "Full class enrollment history with schedules, payments, and billing periods.",
      filename: "class-enrollments.csv",
      rows: classEnrollmentRows,
      icon: "enrollments",
    },
    {
      title: "Cheer enrollments",
      description:
        "Full cheer enrollment history with contracts, tuition, fees, and payment status.",
      filename: "cheer-enrollments.csv",
      rows: cheerEnrollmentRows,
      icon: "enrollments",
    },
    {
      title: "Customer directory",
      description:
        "All parent accounts with contact, address, balance, and Stripe data.",
      filename: "customer-directory.csv",
      rows: parentRows,
      icon: "customers",
    },
    {
      title: "Athlete roster",
      description:
        "All athletes and their linked parent contact information.",
      filename: "athlete-roster.csv",
      rows: athleteRows,
      icon: "athletes",
    },
    {
      title: "Schedules",
      description:
        "Class and cheer schedules, active state, seasons, and roster counts.",
      filename: "program-schedules.csv",
      rows: scheduleRows,
      icon: "schedules",
    },
    {
      title: "Sessions and attendance",
      description:
        "Class and cheer session history with class attendance details where available.",
      filename: "sessions-and-attendance.csv",
      rows: sessionRows,
      icon: "enrollments",
    },
    {
      title: "Staff time clock",
      description:
        "Coach time entries, approval status, notes, and calculated hours.",
      filename: "staff-time-clock.csv",
      rows: timeClockRows,
      unavailableReason: data.timeClockReview.tableReady ? undefined : "Staff time data is unavailable.",
      icon: "timeClock",
    },
  ]
}
