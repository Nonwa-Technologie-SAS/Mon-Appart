import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const MAX_PROPERTY_IMAGES = 10;

export type PickedPropertyImage = {
  uri: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
};

type PropertyImagePickerProps = {
  images: PickedPropertyImage[];
  onChange: (images: PickedPropertyImage[]) => void;
  onError?: (message: string) => void;
};

function guessName(asset: ImagePicker.ImagePickerAsset, index: number) {
  if (asset.fileName) return asset.fileName;
  const ext = asset.mimeType?.split('/')[1] ?? 'jpg';
  return `photo-${index + 1}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

export async function pickPropertyImages(
  current: PickedPropertyImage[]
): Promise<PickedPropertyImage[]> {
  const remaining = MAX_PROPERTY_IMAGES - current.length;
  if (remaining <= 0) return current;

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Autorisez l’accès à la galerie pour ajouter des photos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 1,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) {
    return current;
  }

  const next = result.assets.map((asset, index) => ({
    uri: asset.uri,
    name: guessName(asset, current.length + index),
    type: asset.mimeType ?? 'image/jpeg',
    width: asset.width,
    height: asset.height,
  }));

  return [...current, ...next].slice(0, MAX_PROPERTY_IMAGES);
}

export function PropertyImagePicker({
  images,
  onChange,
  onError,
}: PropertyImagePickerProps) {
  const theme = useTheme();

  async function handlePick() {
    try {
      const next = await pickPropertyImages(images);
      onChange(next);
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : 'Impossible d’ouvrir la galerie'
      );
    }
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.text }]}>Photos de la maison</Text>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Ajoutez jusqu’à {MAX_PROPERTY_IMAGES} photos. Elles sont optimisées
        automatiquement avant publication.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {images.map((image) => (
          <View key={image.uri} style={styles.thumbWrap}>
            <Image source={{ uri: image.uri }} style={styles.thumb} contentFit="cover" />
            <Pressable
              onPress={() => onChange(images.filter((item) => item.uri !== image.uri))}
              style={styles.removeBtn}
              accessibilityLabel="Retirer cette photo">
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}

        {images.length < MAX_PROPERTY_IMAGES ? (
          <Pressable
            onPress={() => void handlePick()}
            style={[
              styles.addBtn,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}>
            <Ionicons name="images-outline" size={22} color={theme.primary} />
            <Text style={[styles.addLabel, { color: theme.primary }]}>Galerie</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  thumbWrap: {
    width: 92,
    height: 92,
    borderRadius: 16,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  addBtn: {
    width: 92,
    height: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
