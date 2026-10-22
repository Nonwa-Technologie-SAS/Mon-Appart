import { API_BASE_URL } from '@/lib/config';
import { optimizePropertyImage } from '@/lib/optimize-image';
import { sessionHeaders } from '@/lib/session-storage';

export async function uploadPropertyImage(
  image: { uri: string; name: string; type: string; width?: number; height?: number },
  authToken?: string | null
) {
  const optimized = await optimizePropertyImage(image);

  const form = new FormData();
  form.append(
    'file',
    {
      uri: optimized.uri,
      name: optimized.name,
      type: optimized.type,
    } as unknown as Blob
  );

  const response = await fetch(`${API_BASE_URL}/api/blob/put`, {
    method: 'POST',
    headers: sessionHeaders(authToken, { json: false }),
    body: form,
  });

  const json = (await response.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;

  if (!response.ok || !json?.url) {
    throw new Error(json?.error ?? 'Impossible d’envoyer la photo vers le stockage');
  }

  return json.url;
}
