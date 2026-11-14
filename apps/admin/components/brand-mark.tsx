import Image from "next/image"
import Link from "next/link"

export function BrandMark({
  href = "/",
  size = "sidebar",
}: {
  href?: string
  size?: "sidebar" | "login"
}) {
  const heightClass = size === "login" ? "h-20" : "h-16"

  return (
    <Link
      href={href}
      className="group inline-flex flex-col items-start gap-1.5"
    >
      <Image
        src="/logo.png"
        alt="Mon Appart"
        width={320}
        height={213}
        priority
        unoptimized
        className={`${heightClass} w-auto max-w-[13.5rem] object-contain object-left transition-opacity group-hover:opacity-90`}
      />
      <span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Admin
      </span>
    </Link>
  )
}
