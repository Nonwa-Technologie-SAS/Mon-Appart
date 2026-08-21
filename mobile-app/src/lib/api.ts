import { API_BASE_URL, absoluteMediaUrl } from '@/lib/config';
import { readStoredSession, sessionHeaders } from '@/lib/session-storage';
import type {
  CreatePropertyPayload,
  OwnerVisitRequest,
  PropertyListItem,
  PropertyStatus,
  PropertyType,
} from '@/lib/types';

export { API_BASE_URL };

export type PropertySearchParams = {
  q?: string;
  type?: PropertyType | '';
  maxPrice?: string;
};

async function parseError(response: Response, fallback: string) {
  const json = (await response.json().catch(() => null)) as { error?: string } | null;
  return json?.error ?? fallback;
}

async function authHeaders(options: { json?: boolean } = {}) {
  const stored = await readStoredSession();
  return sessionHeaders(stored?.token, options);
}

function withAbsoluteMedia<T extends PropertyListItem>(property: T): T {
  return {
    ...property,
    imageUrl: absoluteMediaUrl(property.imageUrl),
  };
}

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
  return (json.data ?? []).map(withAbsoluteMedia);
}

export async function fetchPropertyById(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/properties/${id}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Bien introuvable (${response.status})`);
  }

  const json = (await response.json()) as {
    data: PropertyListItem & {
      images?: { id: string; url: string }[];
      virtualTourUrl?: string | null;
      features?: { id: string; name: string; value: string }[];
      agency?: { name: string; phone: string | null; email: string | null } | null;
      isOwner?: boolean;
    };
  };
  const data = json.data;
  return {
    ...withAbsoluteMedia(data),
    images: data.images?.map((image) => ({
      ...image,
      url: absoluteMediaUrl(image.url) ?? image.url,
    })),
    virtualTourUrl: absoluteMediaUrl(data.virtualTourUrl),
    isOwner: Boolean(data.isOwner),
  };
}

export async function registerOwnerAccount(input: {
  name: string;
  email: string;
  password: string;
}) {
  const response = await fetch(`${API_BASE_URL}/api/register-owner`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Impossible de créer le compte'));
  }
}

export async function fetchMyProperties(): Promise<PropertyListItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/me/properties`, {
    headers: await authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Impossible de charger vos biens'));
  }

  const json = (await response.json()) as { data: PropertyListItem[] };
  return (json.data ?? []).map(withAbsoluteMedia);
}

export async function createProperty(input: CreatePropertyPayload) {
  const stored = await readStoredSession();
  const { uploadPropertyImage } = await import('@/lib/blob-upload');

  const imageUrls: string[] = [];
  for (const image of input.images ?? []) {
    imageUrls.push(await uploadPropertyImage(image, stored?.token));
  }

  const response = await fetch(`${API_BASE_URL}/api/properties`, {
    method: 'POST',
    headers: sessionHeaders(stored?.token),
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      price: input.price,
      type: input.type,
      location: input.location,
      status: input.status ?? 'AVAILABLE',
      beds: input.beds,
      baths: input.baths,
      surface: input.surface,
      imageUrls,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Impossible de publier le bien'));
  }

  const json = (await response.json()) as { data: PropertyListItem };
  return withAbsoluteMedia(json.data);
}

export async function updatePropertyStatus(
  id: string,
  status: Extract<PropertyStatus, 'AVAILABLE' | 'ARCHIVED'>
) {
  const response = await fetch(`${API_BASE_URL}/api/properties/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Impossible de mettre à jour le statut'));
  }

  const json = (await response.json()) as { data: PropertyListItem };
  return withAbsoluteMedia(json.data);
}

export async function requestPropertyVisit(
  propertyId: string,
  input: { visitAt: string; whatsapp: string }
) {
  const response = await fetch(`${API_BASE_URL}/api/properties/${propertyId}/visits`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Impossible d’envoyer la demande de visite'));
  }
}

export async function fetchOwnerVisits(): Promise<{
  data: OwnerVisitRequest[];
  pendingCount: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/me/visits`, {
    headers: await authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Impossible de charger les demandes de visite'));
  }

  const json = (await response.json()) as {
    data: OwnerVisitRequest[];
    pendingCount?: number;
  };

  return {
    data: json.data ?? [],
    pendingCount: json.pendingCount ?? 0,
  };
}
