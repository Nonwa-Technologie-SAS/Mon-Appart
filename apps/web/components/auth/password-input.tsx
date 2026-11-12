"use client"

import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        disabled={props.disabled}
        aria-pressed={visible}
        aria-label={
          visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
        }
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? (
          <EyeOffIcon aria-hidden className="size-4" />
        ) : (
          <EyeIcon aria-hidden className="size-4" />
        )}
      </button>
    </div>
  )
}
