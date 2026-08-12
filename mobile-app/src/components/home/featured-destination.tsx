import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { PropertyListItem } from '@/lib/types';

type FeaturedDestinationProps = {
  property: PropertyListItem | null;
};

export function FeaturedDestination({ property }: FeaturedDestinationProps) {
  const theme = useTheme();

  if (!property) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <View style={styles.left}>
        {property.imageUrl ? (
          <Image
            source={{ uri: property.imageUrl }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]} />
        )}
        <View style={styles.copy}>
          <Text style={[styles.city, { color: theme.text }]} numberOfLines={1}>
            {property.location}
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
            {property.title}
          </Text>
        </View>
      </View>
      <View style={[styles.action, { backgroundColor: theme.primary }]}>
        <Ionicons name="arrow-up" size={16} color={theme.primaryForeground} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.two + 2,
    gap: Spacing.two,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  city: {
    fontSize: 16,
    fontWeight: '700',
  },
  sub: {
    fontSize: 13,
  },
  action: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
