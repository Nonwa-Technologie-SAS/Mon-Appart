export type PropertyType =
  | 'APARTMENT'
  | 'HOUSE'
  | 'VILLA'
  | 'STUDIO'
  | 'LAND'
  | 'OFFICE'
  | 'COMMERCIAL'
  | 'OTHER';

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
};

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

export function formatPrice(price: number) {
  return `${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(price)} F CFA`;
}

export function formatPropertyType(type: PropertyType) {
  return PROPERTY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}
