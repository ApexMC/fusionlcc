"use client"

import Link from "next/link"
import type { ComponentProps } from "react"

type SectionLinkProps = Omit<ComponentProps<"a">, "href"> & { href: string }

export function SectionLink({ href, ...props }: SectionLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      onNavigate={(event) => {
        const destination = new URL(href, window.location.href)
        if (!destination.hash || destination.href !== window.location.href) return

        let id: string
        try {
          id = decodeURIComponent(destination.hash.slice(1))
        } catch {
          return
        }

        const section = document.getElementById(id)
        if (!section) return

        // Next.js may skip scrolling when both the route and hash are unchanged.
        event.preventDefault()
        section.scrollIntoView({ block: "start" })
      }}
    />
  )
}
