import { redirect } from "next/navigation"

import { TryoutRequestForm } from "@/components/cheer/tryout_request_form"
import { getAccountSession, getParentForUser } from "@/lib/account/auth"
import { getCheerTryoutRequestData } from "@/lib/account/data"

export default async function RequestTryoutPage() {
  const session = await getAccountSession()

  if (!session?.userId) {
    redirect("/login")
  }

  const [requestData, parent] = await Promise.all([
    getCheerTryoutRequestData(session.userId),
    getParentForUser(session.userId),
  ])

  return (
    <div className="flex flex-1 flex-col items-center justify-start bg-zinc-100 font-sans dark:bg-zinc-900">
      <main className="flex min-h-[50vh] w-full max-w-3xl flex-1 flex-col items-center justify-center bg-zinc-100 px-6 py-16 dark:bg-zinc-900 sm:px-16">
        <h1 className="text-center text-4xl font-bold text-zinc-800 dark:text-zinc-200">
          Request a Competitive Cheer Tryout
        </h1>
        <p className="mt-4 max-w-2xl text-center leading-7 text-zinc-600 dark:text-zinc-300">
          Select an athlete from your account and the team they are interested
          in. Our staff will review your request and notify you soon.
          Cheer contract including all pricing information and terms and 
          conditions will be provided for your review and signature.
        </p>
        <p className="mt-4 max-w-2xl text-center leading-7 text-zinc-600 dark:text-zinc-300">
          
        </p>
        <TryoutRequestForm
          athletes={requestData.athletes}
          teams={requestData.teams}
          userId={session.userId}
          parentId={parent?.parent_id}
          parent={
            parent
              ? {
                  firstName: parent.first_name ?? null,
                  lastName: parent.last_name ?? null,
                  phone: parent.phone ?? null,
                  email: parent.email ?? null,
                  address: parent.address ?? null,
                  city: parent.city ?? null,
                  state: parent.state ?? null,
                  zipCode: parent.zip_code ?? null,
                }
              : null
          }
        />
      </main>
    </div>
  )
}
