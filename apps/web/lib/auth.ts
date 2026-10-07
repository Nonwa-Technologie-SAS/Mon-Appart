import { expo } from "@better-auth/expo"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { bearer } from "better-auth/plugins"

import { prisma } from "@/lib/prisma"
import { Role } from "@/prisma/generated/client/enums"

const appUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: appUrl,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  trustedOrigins: [
    "mobileapp://",
    appUrl,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8081",
    ...(process.env.NODE_ENV !== "production"
      ? ["exp://", "exp://**", "http://10.0.2.2:*"]
      : []),
  ].filter((origin): origin is string => Boolean(origin)),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: Role.VISITOR,
        input: false,
      },
      agencyId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  plugins: [expo(), bearer(), nextCookies()],
})

export type Session = typeof auth.$Infer.Session
