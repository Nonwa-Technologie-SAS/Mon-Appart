import { HttpStatus, Injectable } from "@nestjs/common"
import { isIP } from "node:net"

import { AppException } from "../common/http/app-exception"
import { Prisma, type PrismaClient } from "../generated/prisma/client"
import { PrismaService } from "./prisma.service"

export type Tx = Prisma.TransactionClient
export type Db = PrismaClient | Tx

/** Accès PostgreSQL des modules métier ; 503 explicite si la base est absente. */
@Injectable()
export class DatabaseService {
  constructor(private readonly prisma: PrismaService) {}

  get client(): PrismaClient {
    const client = this.prisma.getClient()
    if (!client) {
      throw new AppException(
        "DATABASE_UNAVAILABLE",
        HttpStatus.SERVICE_UNAVAILABLE,
        "Base de données indisponible",
      )
    }
    return client
  }

  transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
    return this.client.$transaction(run, {
      isolationLevel: "ReadCommitted",
      timeout: 10_000,
    })
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

/** Adresse IP acceptable pour une colonne INET, sinon `null`. */
export function toInet(ip: string | undefined | null): string | null {
  if (!ip) return null
  return isIP(ip) ? ip : null
}

export function truncate(
  value: string | undefined | null,
  max: number,
): string | null {
  if (!value) return null
  return value.length > max ? value.slice(0, max) : value
}
