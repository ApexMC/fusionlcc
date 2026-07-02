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
  type?: string | null
  program_type?: string | null
  stripe_price_id?: string | null
  billing_day?: number | null
  created_at?: string | null
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
  athlete_id?: string | number | null
  status?: EnrollmentStatus | null
  created_at?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_status?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
  payment_status?: PaymentStatus
  Athletes?: AthleteRecord | AthleteRecord[] | null
  Classes?: ClassRecord | ClassRecord[] | null
}

export type EnrollmentDisplayRecord = {
  enrollmentId: string
  athleteId: string | null
  athleteName: string
  parentName: string
  parentEmail: string | null
  classId: string | null
  className: string
  classType: string | null
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
  metrics: EnrollmentMetric[]
  pendingEnrollments: EnrollmentDisplayRecord[]
  statusBreakdown: ChartDatum[]
  monthlyTrend: TrendDatum[]
}

export type ParentAthleteEnrollment = {
  athleteId: string
  athleteName: string
  enrollments: EnrollmentDisplayRecord[]
}
