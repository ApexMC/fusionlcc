export type EnrollmentStatus =
  | "pending"
  | "approved"
  | "active"
  | "denied"
  | "canceled"
  | string

export type PaymentStatus =
  | "paid"
  | "unpaid"
  | "payment_failed"
  | "past_due"
  | string
  | null

export type ClassRecord = {
  class_id: string | number
  class_name?: string | null
  class_description?: string | null
  type?: string | null
  program_type?: string | null
  stripe_price_id?: string | null
  billing_day?: number | null
  created_at?: string | null
}

export type CheerTeamRecord = {
  team_id: string | number
  team_name?: string | null
  type?: string | null
  program_type?: string | null
  tuition_price_id?: string | null
  fee_price_id?: string | null
  billing_day?: string | null
  created_at?: string | null
}

export type ClassScheduleRecord = {
  schedule_id: string | number
  class_id?: string | number | null
  season_id?: string | number | null
  day_of_week?: string | number | null
  start_time?: string | null
  end_time?: string | null
  is_active?: boolean | null
  created_at?: string | null
  Classes?: ClassRecord | ClassRecord[] | null
}

export type ParentRecord = {
  parent_id: string | number
  user_id?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  balance?: number | null
  stripe_customer_id?: string | null
}

export type AthleteRecord = {
  athlete_id: string | number
  user_id?: string | null
  parent_id?: string | number | null
  first_name?: string | null
  last_name?: string | null
  dob?: string | null
  phone?: string | null
  shirt_size?: string | null
  created_at?: string | null
  Parents?: ParentRecord | ParentRecord[] | null
}

export type EnrollmentRecord = {
  enrollment_id: string | number
  class_id?: string | number | null
  schedule_id?: string | number | null
  athlete_id?: string | number | null
  status?: EnrollmentStatus | null
  selection_required?: boolean | null
  created_at?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_status?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
  payment_status?: PaymentStatus
  Athletes?: AthleteRecord | AthleteRecord[] | null
  ClassSchedules?: ClassScheduleRecord | ClassScheduleRecord[] | null
}

export type EnrollmentDisplayRecord = {
  enrollmentId: string
  athleteId: string | null
  athleteName: string
  parentName: string
  parentPhone: string | null
  parentEmail: string | null
  scheduleId: string | null
  classId: string | null
  className: string
  classType: string | null
  scheduleLabel: string | null
  selectionRequired: boolean
  programType: string | null
  billingDay: number | null
  status: string
  createdAt: string | null
  stripePriceId: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null
  paymentStatus: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
}

export type EnrollmentMetric = {
  label: string
  value: string
  detail?: string
}

export type AdminDashboardMetrics = {
  parentAccounts: EnrollmentMetric
  approvedActive: EnrollmentMetric
  deniedCanceled: EnrollmentMetric
  monthlyRecurringRevenue: EnrollmentMetric
}

export type ChartDatum = {
  name: string
  label: string
  value: number
  fill?: string
}

export type TrendDatum = {
  month: string
  enrollments: number
}

export type AdminDashboardData = {
  metrics: AdminDashboardMetrics
  reviewQueue: OperationsActionItem
  actionItems: OperationsActionItem[]
  pendingEnrollments: EnrollmentDisplayRecord[]
  allEnrollments: EnrollmentDisplayRecord[]
  enrollmentAthletes: AdminEnrollmentAthleteOption[]
  classBilling: ClassBillingRecord[]
  cheerBilling: CheerBillingRecord[]
  scheduleSeasons: ScheduleSeasonRecord[]
  classSchedules: ClassScheduleDisplayRecord[]
  cheerSchedules: CheerScheduleDisplayRecord[]
  classSessions: ClassSessionDisplayRecord[]
  cheerSessions: CheerSessionDisplayRecord[]
  timeClockReview: AdminTimeClockReviewData
  statusBreakdown: ChartDatum[]
  monthlyTrend: TrendDatum[]
}

export type CoachDashboardData = {
  classSessions: ClassSessionDisplayRecord[]
  timeClock: CoachTimeClockData
}

export type ParentAthleteEnrollment = {
  athleteId: string
  athleteName: string
  enrollments: EnrollmentDisplayRecord[]
}

export type AdminEnrollmentAthleteOption = {
  athleteId: string
  athleteName: string
  parentName: string
  parentId: string | null
  parentEmail: string | null
}

export type OperationsActionItem = {
  label: string
  value: string
  detail: string
  tone: "default" | "warning" | "danger" | "success"
}

export type ClassBillingRecord = {
  classId: string
  className: string
  classDescription: string | null
  classType: string | null
  programType: string | null
  billingDay: number | null
  stripePriceId: string | null
  createdAt: string | null
}

export type CheerBillingRecord = {
  teamId: string
  teamName: string
  teamType: string | null
  programType: string | null
  billingDay: string | null
  tuitionPriceId: string | null
  feePriceId: string | null
  createdAt: string | null
}

export type ClassScheduleOption = {
  scheduleId: string
  scheduleLabel: string
}

export type ClassOption = {
  classId: string
  className: string
  classType: string | null
  programType: string | null
  billingDay: number | null
  scheduleSummary: string | null
  schedules: ClassScheduleOption[]
  stripePriceId: string | null
}

export type ScheduleSeasonRecord = {
  seasonId: string
  season: string
  isActive: boolean
}

export type ClassScheduleDisplayRecord = {
  scheduleId: string
  classId: string | null
  className: string
  seasonId: string | null
  season: string | null
  seasonIsActive: boolean
  dayOfWeek: string
  startTime: string | null
  endTime: string | null
  isActive: boolean
  enrollmentCount: number
  createdAt: string | null
  scheduleLabel: string
}

export type CheerScheduleDisplayRecord = {
  scheduleId: string
  teamId: string | null
  teamName: string
  dayOfWeek: string
  startTime: string | null
  endTime: string | null
  isActive: boolean
  enrollmentCount: number
  createdAt: string | null
  scheduleLabel: string
}

export type ClassSessionExpectedAthlete = {
  athleteId: string
  athleteName: string
  enrollmentId: string
  enrollmentStatus: string
  scheduleId: string | null
  scheduleLabel: string | null
  parentName: string
  parentPhone: string | null
  parentEmail: string | null
  isMakeup: boolean
  attendanceStatus: ClassSessionAttendanceStatus | null
  attendanceNotes: string | null
  attendanceReviewedAt: string | null
  attendanceReviewedBy: string | null
}

export type ClassSessionDisplayRecord = {
  sessionId: string
  classId: string | null
  className: string
  scheduleId: string | null
  scheduleLabel: string | null
  sessionDate: string | null
  startsAt: string | null
  endsAt: string | null
  status: string
  type: string | null
  expectedAthletes: ClassSessionExpectedAthlete[]
  makeupAthleteOptions: ClassSessionExpectedAthlete[]
}

export type CheerSessionDisplayRecord = {
  sessionId: string
  teamId: string | null
  teamName: string
  scheduleId: string | null
  scheduleLabel: string | null
  sessionDate: string | null
  startsAt: string | null
  endsAt: string | null
  status: string
  type: string | null
}

export type DeadPeriodRecord = {
  periodId: string
  startsAt: string | null
  endsAt: string | null
}

export type ClassSessionAttendanceStatus =
  | "present"
  | "absent"
  | "excused"
  | "late"
  | string

export type CoachTimeClockEntry = {
  entryId: string
  coachUserId: string
  workDate: string | null
  clockInAt: string
  clockOutAt: string | null
  clockInNote: string | null
  clockOutNote: string | null
  status: string
  createdAt: string | null
  updatedAt: string | null
}

export type CoachTimeClockData = {
  activeEntry: CoachTimeClockEntry | null
  recentEntries: CoachTimeClockEntry[]
  tableReady: boolean
  message: string | null
}

export type AdminCoachTimeClockGroup = {
  coachUserId: string
  coachName: string
  coachPhone: string | null
  currentPeriodEntries: CoachTimeClockEntry[]
  historyEntries: CoachTimeClockEntry[]
  currentPeriodMinutes: number
  historyMinutes: number
  pendingCount: number
}

export type AdminTimeClockReviewData = {
  periodStart: string
  periodEnd: string
  coaches: AdminCoachTimeClockGroup[]
  tableReady: boolean
  message: string | null
}
