import Image from "next/image"
import Link from "next/link"

export default function Logo() {
  return (
    <Link href="/" aria-label="Limitless Cheer and Gymnastics home">
      <Image
        src="/images/logos/limitless_logo.png"
        alt="Limitless Cheer and Gymnastics"
        width={85}
        height={85}
        priority
      />
    </Link>
  )
}
