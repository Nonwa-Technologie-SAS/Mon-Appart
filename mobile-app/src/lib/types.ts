export type PropertyType =
  | 'APARTMENT'
  | 'HOUSE'
  | 'VILLA'
  | 'STUDIO'
  | 'LAND'
  | 'OFFICE'
  | 'COMMERCIAL'
  | 'OTHER';

export type PropertyStatus =
  | 'DRAFT'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'RENTED'
  | 'SOLD'
  | 'ARCHIVED';

export type UserRole =
  | 'VISITOR'
  | 'TENANT'
  | 'OWNER'
  | 'AGENCY'
  | 'ADMIN'
  | 'SUPERADMIN';

export const PUBLISHER_ROLES: UserRole[] = [
  'OWNER',
  'AGENCY',
  'ADMIN',
  'SUPERADMIN',
];

export type PropertyListItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  type: PropertyType;
  location: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  agencyName: string | null;
  status?: PropertyStatus;
};

export type CreatePropertyPayload = {
  title: string;
  description: string;
  price: number;
  type: PropertyType;
  location: string;
  images?: { uri: string; name: string; type: string; width?: number; height?: number }[];
  beds?: string;
  baths?: string;
  surface?: string;
  status?: Extract<PropertyStatus, 'AVAILABLE' | 'ARCHIVED'>;
};

export const AVAILABILITY_OPTIONS: {
  value: Extract<PropertyStatus, 'AVAILABLE' | 'ARCHIVED'>;
  label: string;
}[] = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'ARCHIVED', label: 'Non disponible' },
];

export const PROPERTY_TYPE_OPTIONS: { value: PropertyType | ''; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'APARTMENT', label: 'Appartement' },
  { value: 'HOUSE', label: 'Maison' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'LAND', label: 'Terrain' },
  { value: 'OFFICE', label: 'Bureau' },
  { value: 'COMMERCIAL', label: 'Commerce' },
];

export const PROPERTY_TYPE_CHOICES = PROPERTY_TYPE_OPTIONS.filter(
  (option): option is { value: PropertyType; label: string } => option.value !== ''
);

export function formatPrice(price: number) {
  return `${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(price)} F CFA`;
}

export function formatPropertyType(type: PropertyType) {
  return PROPERTY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function formatPropertyStatus(status: PropertyStatus) {
  switch (status) {
    case 'DRAFT':
      return 'Brouillon';
    case 'AVAILABLE':
      return 'Disponible';
    case 'RESERVED':
      return 'Réservé';
    case 'RENTED':
      return 'Loué';
    case 'SOLD':
      return 'Vendu';
    case 'ARCHIVED':
      return 'Non disponible';
    default:
      return status;
  }
}

export function canPublishListings(role: string | undefined | null) {
  return PUBLISHER_ROLES.includes(role as UserRole);
}

export type VisitStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export type OwnerVisitRequest = {
  id: string;
  visitDate: string;
  visitorWhatsapp: string;
  status: VisitStatus;
  createdAt: string;
  property: {
    id: string;
    title: string;
    location: string;
  };
};

export function formatVisitDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatVisitStatus(status: VisitStatus) {
  switch (status) {
    case 'PENDING':
      return 'En attente';
    case 'ACCEPTED':
      return 'Acceptée';
    case 'DECLINED':
      return 'Refusée';
    default:
      return status;
  }
}

export function whatsappUrl(number: string) {
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}
