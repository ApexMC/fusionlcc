"use client"

import { Button } from "@/components/ui/button"

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        We could not load this page. Please try again.
      </p>
      <Button type="button" onClick={retry}>Try again</Button>
    </main>
  )
}
