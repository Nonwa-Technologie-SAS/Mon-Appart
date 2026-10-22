import { Injectable } from "@nestjs/common"
import type { Role } from "@mon-appart/types"

import {
  UserStatus,
  VerificationStatus,
  VerificationType,
} from "../../../../generated/prisma/enums"
import type { Identifier } from "../../domain/identifier"
import { IdentityDatabase, type Db } from "../persistence/identity-database"

const userWithRoles = {
  roles: { select: { role: { select: { code: true } } } },
} as const

export interface UserRecord {
  id: bigint
  publicId: string
  email: string | null
  phone: string | null
  passwordHash: string | null
  firstName: string | null
  lastName: string | null
  status: UserStatus
  emailVerifiedAt: Date | null
  phoneVerifiedAt: Date | null
  lastLoginAt: Date | null
  createdAt: Date
  roles: Role[]
}

type RawUser = Omit<UserRecord, "roles"> & {
  roles: Array<{ role: { code: string } }>
}

function toRecord(user: RawUser): UserRecord {
  const { roles, ...rest } = user
  return { ...rest, roles: roles.map((entry) => entry.role.code as Role) }
}

const ACTIVE = { deletedAt: null } as const

@Injectable()
export class UserRepository {
  constructor(private readonly db: IdentityDatabase) {}

  async findByIdentifier(
    identifier: Identifier,
    db: Db = this.db.client,
  ): Promise<UserRecord | null> {
    const where =
      identifier.kind === "email"
        ? { email: identifier.value, ...ACTIVE }
        : { phone: identifier.value, ...ACTIVE }
    const user = await db.user.findFirst({ where, include: userWithRoles })
    return user ? toRecord(user) : null
  }

  async findByPublicId(
    publicId: string,
    db: Db = this.db.client,
  ): Promise<UserRecord | null> {
    const user = await db.user.findFirst({
      where: { publicId, ...ACTIVE },
      include: userWithRoles,
    })
    return user ? toRecord(user) : null
  }

  async findById(
    id: bigint,
    db: Db = this.db.client,
  ): Promise<UserRecord | null> {
    const user = await db.user.findFirst({
      where: { id, ...ACTIVE },
      include: userWithRoles,
    })
    return user ? toRecord(user) : null
  }

  async contactTaken(
    field: "email" | "phone",
    value: string,
    db: Db = this.db.client,
  ): Promise<boolean> {
    const count = await db.user.count({ where: { [field]: value, ...ACTIVE } })
    return count > 0
  }

  async create(
    data: {
      email: string | null
      phone: string | null
      passwordHash: string
      firstName: string | null
      lastName: string | null
    },
    db: Db,
  ): Promise<{ id: bigint; publicId: string }> {
    return db.user.create({
      data: { ...data, status: UserStatus.PENDING },
      select: { id: true, publicId: true },
    })
  }

  async assignRole(
    userId: bigint,
    roleId: number,
    grantedById: bigint | null,
    db: Db,
  ): Promise<void> {
    await db.userRole.create({ data: { userId, roleId, grantedById } })
  }

  async createPendingVerifications(
    userId: bigint,
    types: VerificationType[],
    db: Db,
  ): Promise<void> {
    if (types.length === 0) return
    await db.verification.createMany({
      data: types.map((type) => ({
        userId,
        type,
        status: VerificationStatus.PENDING,
      })),
    })
  }

  /** Marque la vérification d'un canal et active un compte en attente. */
  async markContactVerified(
    userId: bigint,
    type: "PHONE" | "EMAIL",
    status: UserStatus,
    db: Db,
  ): Promise<void> {
    const now = new Date()
    await db.user.update({
      where: { id: userId },
      data: {
        ...(type === "PHONE"
          ? { phoneVerifiedAt: now }
          : { emailVerifiedAt: now }),
        status,
      },
    })
    const updated = await db.verification.updateMany({
      where: { userId, type, status: VerificationStatus.PENDING },
      data: { status: VerificationStatus.VERIFIED, verifiedAt: now },
    })
    if (updated.count === 0) {
      await db.verification.create({
        data: {
          userId,
          type,
          status: VerificationStatus.VERIFIED,
          verifiedAt: now,
        },
      })
    }
  }

  async updatePassword(
    userId: bigint,
    passwordHash: string,
    db: Db,
  ): Promise<void> {
    await db.user.update({ where: { id: userId }, data: { passwordHash } })
  }

  async updateProfile(
    userId: bigint,
    data: { firstName?: string | null; lastName?: string | null },
    db: Db = this.db.client,
  ): Promise<void> {
    await db.user.update({ where: { id: userId }, data })
  }

  async touchLastLogin(userId: bigint, db: Db = this.db.client): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    })
  }

  async updateStatus(
    userId: bigint,
    status: UserStatus,
    db: Db,
  ): Promise<void> {
    await db.user.update({ where: { id: userId }, data: { status } })
  }
}
