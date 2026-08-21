import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { CategoryChips } from '@/components/home/category-chips';
import { FeaturedDestination } from '@/components/home/featured-destination';
import { PropertyCard } from '@/components/home/property-card';
import { SearchBar } from '@/components/home/search-bar';
import { AppHeader } from '@/components/app-header';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchProperties } from '@/lib/api';
import {
  PROPERTY_TYPE_OPTIONS,
  type PropertyListItem,
  type PropertyType,
} from '@/lib/types';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<PropertyType | ''>('');
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProperties({
          q: debouncedQuery,
          type,
        });
        if (!cancelled) setProperties(data);
      } catch (err) {
        if (!cancelled) {
          setProperties([]);
          setError(
            err instanceof Error ? err.message : 'Erreur de chargement des annonces'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, type]);

  const featured = properties[0] ?? null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text style={[styles.headline, { color: theme.text }]}>
            Où voulez-vous{'\n'}habiter ?
          </Text>

          <SearchBar value={query} onChangeText={setQuery} />

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Catégorie</Text>
            <CategoryChips
              options={PROPERTY_TYPE_OPTIONS}
              selected={type}
              onSelect={(value) => setType(value as PropertyType | '')}
            />
          </View>

          <FeaturedDestination property={featured} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                À découvrir
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                {properties.length} bien{properties.length > 1 ? 's' : ''}
              </Text>
            </View>

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : error ? (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <Text style={{ color: theme.danger, marginBottom: 8 }}>{error}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  Vérifiez que frontend-public tourne sur le port 3000 et que
                  EXPO_PUBLIC_API_URL est correct.
                </Text>
              </View>
            ) : properties.length === 0 ? (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <Text style={{ color: theme.textSecondary }}>
                  Aucun bien pour ces critères.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {properties.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    onPress={(item) => router.push(`/property/${item.id}`)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.four,
  },
  headline: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  section: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  list: {
    gap: Spacing.three,
  },
  centered: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  errorBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
  },
});
