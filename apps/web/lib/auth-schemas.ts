import { z } from "zod"

import { PropertyStatus, PropertyType, Role } from "@/prisma/generated/client/enums"
import { VISIT_ROOMS } from "@/lib/visit-rooms"

export const credentialsSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
})

export const agencySchema = credentialsSchema.extend({
  agencyName: z.string().trim().min(2, "Le nom de l'agence est requis"),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
})

export const staffSchema = credentialsSchema.extend({
  role: z.enum([Role.ADMIN, Role.SUPERADMIN]),
})

export const signInSchema = z.object({
  email: z.email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
})

const propertyTypes = [
  PropertyType.APARTMENT,
  PropertyType.HOUSE,
  PropertyType.VILLA,
  PropertyType.STUDIO,
  PropertyType.LAND,
  PropertyType.OFFICE,
  PropertyType.COMMERCIAL,
  PropertyType.OTHER,
] as const

export const createPropertySchema = z.object({
  title: z.string().trim().min(3, "Le titre est trop court"),
  description: z.string().trim().min(10, "La description est trop courte"),
  price: z.coerce.number().int().positive("Le prix doit être positif"),
  type: z.enum(propertyTypes),
  location: z.string().trim().min(2, "La localisation est requise"),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  imageUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      "URL d'image invalide"
    ),
  imageUrls: z.array(z.string().trim().url()).max(10).optional(),
  imageLayout: z
    .array(
      z.object({
        url: z.string().trim().url(),
        room: z.enum(VISIT_ROOMS),
        sortOrder: z.coerce.number().int().min(0),
      })
    )
    .max(10)
    .optional(),
  beds: z.string().trim().optional(),
  baths: z.string().trim().optional(),
  surface: z.string().trim().optional(),
  status: z
    .enum([PropertyStatus.AVAILABLE, PropertyStatus.ARCHIVED])
    .optional(),
  publish: z.boolean().optional().default(true),
})

export const updatePropertyStatusSchema = z.object({
  status: z.enum([PropertyStatus.AVAILABLE, PropertyStatus.ARCHIVED]),
})

export const updateOwnedPropertyStatusSchema = updatePropertyStatusSchema.extend({
  propertyId: z.string().trim().min(1, "Bien requis"),
})

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => !value || z.email().safeParse(value).success,
    "Email invalide"
  )

export const createVisitSchema = z.object({
  visitorName: z.string().trim().max(80).optional(),
  visitorEmail: optionalEmail,
  visitAt: z.coerce.date(),
  whatsapp: z
    .string()
    .trim()
    .min(8, "Indiquez un numéro WhatsApp valide"),
})

export const requestVisitFormSchema = createVisitSchema.extend({
  propertyId: z.string().min(1, "Bien introuvable"),
  visitorName: z.string().trim().min(2, "Indiquez votre nom").max(80),
})

export type CreatePropertyInput = z.infer<typeof createPropertySchema>

export function firstZodError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Données invalides"
}
