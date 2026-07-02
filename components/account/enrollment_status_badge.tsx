import { Badge } from "@/components/ui/badge"

export function EnrollmentStatusBadge({
  status,
}: {
  status: string | null | undefined
}) {
  const normalized = (status ?? "unknown").toLowerCase()
  const variant =
    normalized === "approved" || normalized === "active"
      ? "success"
      : normalized === "pending"
        ? "warning"
        : normalized === "denied" ||
            normalized === "canceled" ||
            normalized === "payment_failed"
          ? "destructive"
          : "outline"

  return (
    <Badge variant={variant}>
      {normalized.replace(/_/g, " ")}
    </Badge>
  )
}
