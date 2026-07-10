import { Badge } from "@/components/ui/badge"

export function EnrollmentStatusBadge({
  status,
}: {
  status: string | null | undefined
}) {
  const normalized = (status ?? "unknown").toLowerCase()
  const variant =
    normalized === "approved" ||
    normalized === "active" ||
    normalized === "paid" ||
    normalized === "trialing"
      ? "success"
      : normalized === "pending" || normalized === "ready_to_pay"
        ? "warning"
        : normalized === "denied" ||
            normalized === "canceled" ||
            normalized === "payment_failed" ||
            normalized === "past_due" ||
            normalized === "unpaid" ||
            normalized === "incomplete"
          ? "destructive"
          : "outline"

  return (
    <Badge variant={variant}>
      {normalized.replace(/_/g, " ")}
    </Badge>
  )
}
