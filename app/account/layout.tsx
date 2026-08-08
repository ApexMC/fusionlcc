import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/account/auth";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAccountSession();

  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
