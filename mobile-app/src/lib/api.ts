import { Platform } from 'react-native';

import type { PropertyListItem, PropertyType } from '@/lib/types';

function resolveApiBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  // Android emulator cannot reach host localhost via 127.0.0.1
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export type PropertySearchParams = {
  q?: string;
  type?: PropertyType | '';
  maxPrice?: string;
};

export async function fetchProperties(
  params: PropertySearchParams = {}
): Promise<PropertyListItem[]> {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.type) search.set('type', params.type);
  if (params.maxPrice) search.set('maxPrice', params.maxPrice);

  const qs = search.toString();
  const url = `${API_BASE_URL}/api/properties${qs ? `?${qs}` : ''}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Impossible de charger les annonces (${response.status})`);
  }

  const json = (await response.json()) as { data: PropertyListItem[] };
  return json.data ?? [];
}

export async function fetchPropertyById(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/properties/${id}`);
  if (!response.ok) {
    throw new Error(`Bien introuvable (${response.status})`);
  }

  const json = (await response.json()) as {
    data: PropertyListItem & {
      images?: { id: string; url: string }[];
      virtualTourUrl?: string | null;
      features?: { id: string; name: string; value: string }[];
      agency?: { name: string; phone: string | null; email: string | null } | null;
    };
  };
  return json.data;
}
