import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type EmptyStateAction = {
  href: string
  label: string
  variant?: "default" | "outline" | "secondary"
}

export function EmptyState({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: readonly EmptyStateAction[]
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center shadow-[var(--elevation-sm)] sm:py-16",
        className
      )}
      role="status"
    >
      <div className="max-w-md space-y-2">
        <p className="text-base font-semibold text-foreground sm:text-lg">
          {title}
        </p>
        {description ? (
          <p className="text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {children}
      {actions && actions.length > 0 ? (
        <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          {actions.map((action) => (
            <Button
              key={action.href}
              variant={action.variant ?? "outline"}
              className="min-h-11 w-full sm:w-auto"
              nativeButton={false}
              render={<Link href={action.href} />}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
