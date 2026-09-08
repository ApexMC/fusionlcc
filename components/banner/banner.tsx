"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Announcement } from "@/lib/announcements"

const rotationDelayMs = 8_000

export default function Banner({
  announcements,
}: {
  announcements: Announcement[]
}) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [isPaused, setIsPaused] = React.useState(false)

  React.useEffect(() => {
    if (announcements.length < 2 || isPaused) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % announcements.length)
    }, rotationDelayMs)

    return () => window.clearInterval(timer)
  }, [announcements.length, isPaused])

  if (!announcements.length) {
    return null
  }

  const safeActiveIndex = activeIndex % announcements.length
  const activeAnnouncement = announcements[safeActiveIndex]
  const hasMultipleAnnouncements = announcements.length > 1

  function showPrevious() {
    setActiveIndex(
      (current) =>
        (current - 1 + announcements.length) % announcements.length
    )
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % announcements.length)
  }

  return (
    <section
      aria-label="Announcements"
      className="relative isolate w-full overflow-hidden bg-zinc-950 text-white"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsPaused(false)
        }
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-r from-fuchsia-700 via-purple-700 to-violet-700"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-35 [background-image:radial-gradient(circle_at_15%_50%,white_0,transparent_22%),radial-gradient(circle_at_85%_20%,#fb923c_0,transparent_25%)]"
      />

      <div className="mx-auto flex min-h-11 max-w-7xl items-center gap-2 px-3 py-1.5 sm:px-6">
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.16em] text-white/90 uppercase shadow-sm backdrop-blur sm:flex">
          <Megaphone className="size-3.5" aria-hidden="true" />
          Limitless update
        </div>

        {hasMultipleAnnouncements ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-white hover:bg-white/15 hover:text-white"
            aria-label="Show previous announcement"
            onClick={showPrevious}
          >
            <ChevronLeft />
          </Button>
        ) : (
          <Megaphone
            className="size-4 shrink-0 text-white/85 sm:hidden"
            aria-hidden="true"
          />
        )}

        <div className="min-w-0 flex-1 overflow-hidden text-center">
          <p
            key={activeAnnouncement.announcementId}
            aria-live="polite"
            aria-atomic="true"
            className="animate-in fade-in slide-in-from-bottom-1 text-sm font-semibold leading-5 duration-500 motion-reduce:animate-none sm:text-[0.925rem]"
          >
            {activeAnnouncement.announcementText}
          </p>
        </div>

        {hasMultipleAnnouncements ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-white hover:bg-white/15 hover:text-white"
            aria-label="Show next announcement"
            onClick={showNext}
          >
            <ChevronRight />
          </Button>
        ) : null}

        {hasMultipleAnnouncements ? (
          <div
            className="hidden min-w-12 shrink-0 items-center justify-end gap-1 sm:flex"
            aria-label={`Announcement ${safeActiveIndex + 1} of ${announcements.length}`}
          >
            {announcements.map((announcement, index) => (
              <span
                key={announcement.announcementId}
                aria-hidden="true"
                className={
                  index === safeActiveIndex
                    ? "h-1.5 w-4 rounded-full bg-white transition-all"
                    : "size-1.5 rounded-full bg-white/45 transition-all"
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
