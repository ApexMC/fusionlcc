import { NextResponse } from "next/server";
import { formatPhoneNumber } from "@/functions/shared_functions";
import { getAccountSession, requireAdminSession } from "@/lib/account/auth";
import { formatLocalTime } from "@/lib/local_time";
import { createAdminClient } from "@/lib/supabase/admin";

type ParentRow = {
  parent_id: string | number;
  phone?: string | null;
  balance?: number | string | null;
  stripe_payment_status?: string;
  athletes?: ParentAthleteSummary[];
  [key: string]: unknown;
};

type AthleteRelation = {
  parent_id?: string | number | null;
};

type EnrollmentPaymentRow = {
  status?: string | null;
  payment_status?: string | null;
  subscription_status?: string | null;
  stripe_subscription_id?: string | null;
  Athletes?: AthleteRelation | AthleteRelation[] | null;
};

type AthleteRow = {
  athlete_id: string | number;
  parent_id?: string | number | null;
  first_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  shirt_size?: string | null;
};

type ClassRelation = {
  class_id?: string | number | null;
  class_name?: string | null;
  type?: string | null;
};

type ClassScheduleRelation = {
  schedule_id?: string | number | null;
  class_id?: string | number | null;
  day_of_week?: string | number | null;
  start_time?: string | null;
  end_time?: string | null;
  Classes?: ClassRelation | ClassRelation[] | null;
};

type AthleteEnrollmentRow = {
  enrollment_id: string | number;
  athlete_id?: string | number | null;
  schedule_id?: string | number | null;
  status?: string | null;
  ClassSchedules?: ClassScheduleRelation | ClassScheduleRelation[] | null;
};

type ParentAthleteSummary = {
  athleteId: string;
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  shirtSize: string | null;
  enrollments: {
    enrollmentId: string;
    scheduleId: string | null;
    classId: string | null;
    className: string;
    classType: string | null;
    scheduleLabel: string | null;
    status: string;
  }[];
};

const dayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDay(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 0 || value === 7) {
      return "Sunday";
    }

    const day = dayOrder[value - 1];
    return day ? day.charAt(0).toUpperCase() + day.slice(1) : String(value);
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  const numericDay = Number(normalized);

  if (normalized && Number.isInteger(numericDay)) {
    return formatDay(numericDay);
  }

  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "Unscheduled";
}

function formatScheduleLabel(schedule: ClassScheduleRelation | null | undefined) {
  if (!schedule) {
    return null;
  }

  return `${formatDay(schedule.day_of_week)} ${formatLocalTime(schedule.start_time)} - ${formatLocalTime(schedule.end_time)}`;
}

function getParentPaymentStatus(enrollments: EnrollmentPaymentRow[]) {
  if (!enrollments.length) {
    return "no_enrollments";
  }

  const hasPaymentIssue = enrollments.some((enrollment) =>
    [enrollment.payment_status, enrollment.subscription_status].some((status) =>
      ["payment_failed", "past_due", "unpaid", "incomplete"].includes(
        status ?? ""
      )
    )
  );

  if (hasPaymentIssue) {
    return "payment_failed";
  }

  const hasActivePayment = enrollments.some((enrollment) =>
    [enrollment.payment_status, enrollment.subscription_status].some((status) =>
      ["paid", "active", "trialing"].includes(status ?? "")
    )
  );

  if (hasActivePayment) {
    return "paid";
  }

  const hasApprovedWithoutSubscription = enrollments.some(
    (enrollment) =>
      enrollment.status === "approved" && !enrollment.stripe_subscription_id
  );

  if (hasApprovedWithoutSubscription) {
    return "ready_to_pay";
  }

  if (enrollments.some((enrollment) => enrollment.status === "pending")) {
    return "pending";
  }

  return "not_started";
}

async function getEnrollmentPaymentRows() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("Enrollments")
    .select(
      "status,payment_status,subscription_status,stripe_subscription_id,Athletes(parent_id)"
    );

  if (!error) {
    return (data ?? []) as EnrollmentPaymentRow[];
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("Enrollments")
    .select("status,Athletes(parent_id)");

  if (fallbackError) {
    return [];
  }

  return (fallbackData ?? []) as EnrollmentPaymentRow[];
}

async function getAthleteRows() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("Athletes")
    .select("athlete_id,parent_id,first_name,last_name,dob,shirt_size")
    .order("last_name", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []) as AthleteRow[];
}

async function getAthleteEnrollmentRows() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("Enrollments")
    .select(
      "enrollment_id,athlete_id,schedule_id,status,ClassSchedules(schedule_id,class_id,day_of_week,start_time,end_time,Classes(class_id,class_name,type))"
    );

  if (!error) {
    return (data ?? []) as AthleteEnrollmentRow[];
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("Enrollments")
    .select("enrollment_id,athlete_id,schedule_id,status");

  if (fallbackError) {
    return [];
  }

  return (fallbackData ?? []) as AthleteEnrollmentRow[];
}

function toAthleteSummary(
  athlete: AthleteRow,
  enrollmentRowsByAthleteId: Map<string, AthleteEnrollmentRow[]>
): ParentAthleteSummary {
  const athleteId = String(athlete.athlete_id);
  const enrollments = (
    enrollmentRowsByAthleteId.get(athleteId) ?? []
  )
    .filter(
      (enrollment) =>
        !["denied", "canceled"].includes(
          (enrollment.status ?? "").toLowerCase()
        )
    )
    .map((enrollment) => {
      const classSchedule = firstRelation(enrollment.ClassSchedules);
      const classRecord = firstRelation(classSchedule?.Classes);
      const classId = classSchedule?.class_id ?? classRecord?.class_id ?? null;

      return {
        enrollmentId: String(enrollment.enrollment_id),
        scheduleId:
          enrollment.schedule_id === null || enrollment.schedule_id === undefined
            ? null
            : String(enrollment.schedule_id),
        classId: classId === null ? null : String(classId),
        className:
          classRecord?.class_name ??
          (classId === null ? "Unassigned class" : `Class #${classId}`),
        classType: classRecord?.type ?? null,
        scheduleLabel: formatScheduleLabel(classSchedule),
        status: enrollment.status ?? "unknown",
      };
    });

  return {
    athleteId,
    firstName: athlete.first_name ?? null,
    lastName: athlete.last_name ?? null,
    dob: athlete.dob ?? null,
    shirtSize: athlete.shirt_size ?? null,
    enrollments,
  };
}

export async function GET() {
  try {
    requireAdminSession(await getAccountSession());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const [
    { data, error },
    enrollmentRows,
    athleteRows,
    athleteEnrollmentRows,
  ] = await Promise.all([
    supabase
    .from("Parents")
      .select("*")
      .order("last_name", { ascending: true }),
    getEnrollmentPaymentRows(),
    getAthleteRows(),
    getAthleteEnrollmentRows(),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enrollmentRowsByParentId = new Map<string, EnrollmentPaymentRow[]>();
  const athleteRowsByParentId = new Map<string, AthleteRow[]>();
  const enrollmentRowsByAthleteId = new Map<string, AthleteEnrollmentRow[]>();

  enrollmentRows.forEach((enrollment) => {
    const athlete = firstRelation(enrollment.Athletes);
    const parentId = athlete?.parent_id;

    if (parentId === null || parentId === undefined) {
      return;
    }

    const key = String(parentId);
    enrollmentRowsByParentId.set(key, [
      ...(enrollmentRowsByParentId.get(key) ?? []),
      enrollment,
    ]);
  });

  athleteRows.forEach((athlete) => {
    const parentId = athlete.parent_id;

    if (parentId === null || parentId === undefined) {
      return;
    }

    const key = String(parentId);
    athleteRowsByParentId.set(key, [
      ...(athleteRowsByParentId.get(key) ?? []),
      athlete,
    ]);
  });

  athleteEnrollmentRows.forEach((enrollment) => {
    const athleteId = enrollment.athlete_id;

    if (athleteId === null || athleteId === undefined) {
      return;
    }

    const key = String(athleteId);
    enrollmentRowsByAthleteId.set(key, [
      ...(enrollmentRowsByAthleteId.get(key) ?? []),
      enrollment,
    ]);
  });
  
  (data as ParentRow[] | null)?.forEach((parent) => {
    const parentId = String(parent.parent_id);

    parent.phone = parent.phone ? formatPhoneNumber(parent.phone) : parent.phone;
    parent.balance =
      typeof parent.balance === "number"
        ? `$${parent.balance.toFixed(2)}`
        : parent.balance || "$0.00";
    parent.stripe_payment_status = getParentPaymentStatus(
      enrollmentRowsByParentId.get(parentId) ?? []
    );
    parent.athletes = (athleteRowsByParentId.get(parentId) ?? []).map(
      (athlete) => toAthleteSummary(athlete, enrollmentRowsByAthleteId)
    );
  });

  return NextResponse.json(data ?? []);
}
