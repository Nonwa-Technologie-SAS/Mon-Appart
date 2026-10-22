import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

export function BrandMark({
  href = "/",
  compact = false,
}: {
  href?: string
  compact?: boolean
}) {
  return (
    <Link href={href} className="flex min-w-0 items-center">
      <Image
        src="/logo.png"
        alt="Mon Appart — Trouvez votre chez-vous"
        width={1536}
        height={1024}
        priority={compact}
        className={cn(
          "w-auto max-w-[9.5rem] object-contain sm:max-w-none",
          compact ? "h-9 sm:h-11" : "h-16 sm:h-20 md:h-24"
        )}
      />
    </Link>
  )
}
