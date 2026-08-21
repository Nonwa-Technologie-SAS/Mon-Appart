import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const IMAGE_MAX_EDGE = 2560;
const IMAGE_QUALITY = 0.86;

function outputName(name: string) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${base || 'photo'}.webp`;
}

export async function optimizePropertyImage(image: {
  uri: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
}) {
  const longest = Math.max(image.width ?? 0, image.height ?? 0);
  const actions =
    longest > IMAGE_MAX_EDGE
      ? [
          {
            resize:
              (image.width ?? 0) >= (image.height ?? 0)
                ? { width: IMAGE_MAX_EDGE }
                : { height: IMAGE_MAX_EDGE },
          },
        ]
      : [];

  try {
    const result = await manipulateAsync(image.uri, actions, {
      compress: IMAGE_QUALITY,
      format: SaveFormat.WEBP,
    });

    return {
      uri: result.uri,
      name: outputName(image.name),
      type: 'image/webp',
    };
  } catch {
    const result = await manipulateAsync(image.uri, actions, {
      compress: IMAGE_QUALITY,
      format: SaveFormat.JPEG,
    });

    return {
      uri: result.uri,
      name: outputName(image.name).replace(/\.webp$/, '.jpg'),
      type: 'image/jpeg',
    };
  }
}
