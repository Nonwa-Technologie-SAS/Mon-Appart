import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchPropertyById } from '@/lib/api';
import { formatPrice, formatPropertyType, type PropertyListItem } from '@/lib/types';

type PropertyDetail = PropertyListItem & {
  images?: { id: string; url: string }[];
  virtualTourUrl?: string | null;
  features?: { id: string; name: string; value: string }[];
  agency?: { name: string; phone: string | null; email: string | null } | null;
};

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPropertyById(id);
        if (!cancelled) setProperty(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (error || !property) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background, padding: Spacing.four }]}>
        <Text style={{ color: theme.danger, marginBottom: Spacing.three }}>
          {error ?? 'Bien introuvable'}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingBottom: insets.bottom + Spacing.five,
      }}>
      <View style={styles.hero}>
        {property.imageUrl ? (
          <Image source={{ uri: property.imageUrl }} style={styles.heroImage} contentFit="cover" />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: theme.backgroundSelected }]} />
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.type, { color: theme.primary }]}>
          {formatPropertyType(property.type)}
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>{property.title}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={theme.textSecondary} />
          <Text style={{ color: theme.textSecondary }}>{property.location}</Text>
        </View>

        <Text style={[styles.price, { color: theme.text }]}>
          {formatPrice(property.price)}
          <Text style={{ fontSize: 14, fontWeight: '400', color: theme.textSecondary }}>
            {' '}
            / mois
          </Text>
        </Text>

        <Text style={[styles.description, { color: theme.text }]}>{property.description}</Text>

        {property.features && property.features.length > 0 ? (
          <View style={styles.features}>
            {property.features.map((feature) => (
              <View
                key={feature.id}
                style={[
                  styles.feature,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{feature.name}</Text>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{feature.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {property.agency ? (
          <View
            style={[
              styles.agency,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Proposé par</Text>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>
              {property.agency.name}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.cta, { backgroundColor: theme.primary }]}
          onPress={() => router.back()}>
          <Text style={{ color: theme.primaryForeground, fontWeight: '700', fontSize: 16 }}>
            Retour aux annonces
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 280,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  type: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.one,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: Spacing.two,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: Spacing.two,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  feature: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.two + 2,
    gap: 4,
  },
  agency: {
    marginTop: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 4,
  },
  cta: {
    marginTop: Spacing.four,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
});
