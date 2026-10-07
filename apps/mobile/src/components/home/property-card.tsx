import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { formatPrice, formatPropertyType, type PropertyListItem } from '@/lib/types';

type PropertyCardProps = {
  property: PropertyListItem;
  onPress?: (property: PropertyListItem) => void;
  badge?: string;
};

export function PropertyCard({ property, onPress, badge }: PropertyCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onPress?.(property)}
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <View style={styles.imageWrap}>
        {property.imageUrl ? (
          <Image
            source={{ uri: property.imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View
            style={[
              styles.image,
              styles.imageFallback,
              { backgroundColor: theme.backgroundSelected },
            ]}>
            <Text style={{ color: theme.textSecondary }}>Photo à venir</Text>
          </View>
        )}
        <View style={styles.favBtn}>
          <Ionicons name="heart-outline" size={16} color={theme.secondary} />
        </View>
        {badge ? (
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{badge}</Text>
          </View>
        ) : null}
        <View style={styles.locationPill}>
          <Ionicons name="location" size={12} color="#fff" />
          <Text style={styles.locationPillText} numberOfLines={1}>
            {property.location}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {property.title}
          </Text>
          <Text style={[styles.price, { color: theme.primary }]}>
            {formatPrice(property.price)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {formatPropertyType(property.type)}
          </Text>
          {property.agencyName ? (
            <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
              · {property.agencyName}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.rentHint, { color: theme.textSecondary }]}>/ mois</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageWrap: {
    position: 'relative',
    height: 180,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtn: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  statusPill: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 193, 7, 0.95)',
  },
  statusPillText: {
    color: '#212121',
    fontSize: 12,
    fontWeight: '700',
  },
  locationPill: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: '70%',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  locationPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: 13,
  },
  rentHint: {
    fontSize: 12,
  },
});
