import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';

import { CategoryChips } from '@/components/home/category-chips';
import { PropertyCard } from '@/components/home/property-card';
import { PrimaryButton } from '@/components/primary-button';
import { AppHeader } from '@/components/app-header';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchMyProperties, updatePropertyStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  AVAILABILITY_OPTIONS,
  canPublishListings,
  formatPropertyStatus,
  type PropertyListItem,
  type PropertyStatus,
} from '@/lib/types';

export default function AccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isPending, signOut } = useAuth();
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPublish = canPublishListings(user?.role);

  const loadProperties = useCallback(async () => {
    if (!canPublish) {
      setProperties([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyProperties();
      setProperties(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [canPublish]);

  useFocusEffect(
    useCallback(() => {
      void loadProperties();
    }, [loadProperties])
  );

  async function handleSignOut() {
    await signOut();
    setProperties([]);
  }

  async function handleStatusChange(
    id: string,
    status: Extract<PropertyStatus, 'AVAILABLE' | 'ARCHIVED'>
  ) {
    setError(null);
    setUpdatingId(id);
    try {
      const updated = await updatePropertyStatus(id, status);
      setProperties((current) =>
        current.map((property) => (property.id === id ? { ...property, ...updated } : property))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour le statut');
    } finally {
      setUpdatingId(null);
    }
  }

  if (isPending) {
    return (
      <View style={[styles.centeredScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <AppHeader />
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <Text style={[styles.headline, { color: theme.text }]}>
              Publiez votre{'\n'}maison
            </Text>
            <Text style={[styles.lead, { color: theme.textSecondary }]}>
              Créez un compte propriétaire pour mettre vos biens en ligne et les
              gérer depuis l’application.
            </Text>

            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}>
              <Ionicons name="home-outline" size={28} color={theme.primary} />
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                Espace propriétaire
              </Text>
              <Text style={[styles.heroText, { color: theme.textSecondary }]}>
                Inscription gratuite, publication en quelques minutes.
              </Text>
            </View>

            <PrimaryButton
              label="Créer un compte propriétaire"
              onPress={() => router.push('/register')}
            />
            <PrimaryButton
              label="J’ai déjà un compte"
              variant="secondary"
              onPress={() => router.push('/login')}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            canPublish ? (
              <RefreshControl refreshing={loading} onRefresh={() => void loadProperties()} />
            ) : undefined
          }>
          <View style={styles.topBar}>
            <View style={styles.locationBlock}>
              <Text style={[styles.kicker, { color: theme.secondary }]}>Mon compte</Text>
              <Text style={[styles.headline, { color: theme.text }]}>{user.name}</Text>
              <Text style={[styles.lead, { color: theme.textSecondary }]}>
                {user.email}
              </Text>
            </View>
            <Pressable
              onPress={() => void handleSignOut()}
              style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}
              accessibilityLabel="Se déconnecter">
              <Ionicons name="log-out-outline" size={18} color={theme.text} />
            </Pressable>
          </View>

          {canPublish ? (
            <>
              <PrimaryButton
                label="Publier un bien"
                onPress={() => router.push('/publish/new')}
              />

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Mes annonces
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {properties.length} bien{properties.length > 1 ? 's' : ''}
                  </Text>
                </View>

                {error ? (
                  <Text style={{ color: theme.danger }}>{error}</Text>
                ) : null}

                {loading && properties.length === 0 ? (
                  <View style={styles.centered}>
                    <ActivityIndicator color={theme.primary} />
                  </View>
                ) : properties.length === 0 ? (
                  <View
                    style={[
                      styles.emptyBox,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.border,
                      },
                    ]}>
                    <Text style={{ color: theme.textSecondary }}>
                      Vous n’avez pas encore publié de bien.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.list}>
                    {properties.map((property) => (
                      <OwnerListing
                        key={property.id}
                        property={property}
                        updating={updatingId === property.id}
                        onOpen={(item) => router.push(`/property/${item.id}`)}
                        onChangeStatus={(status) =>
                          void handleStatusChange(property.id, status)
                        }
                      />
                    ))}
                  </View>
                )}
              </View>
            </>
          ) : (
            <View
              style={[
                styles.emptyBox,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}>
              <Text style={{ color: theme.text }}>
                Ce compte n’est pas un compte propriétaire.
              </Text>
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>
                Créez un compte propriétaire pour publier vos maisons.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function listingAvailability(
  status?: PropertyStatus
): Extract<PropertyStatus, 'AVAILABLE' | 'ARCHIVED'> {
  return status === 'AVAILABLE' ? 'AVAILABLE' : 'ARCHIVED';
}

function OwnerListing({
  property,
  updating,
  onOpen,
  onChangeStatus,
}: {
  property: PropertyListItem;
  updating: boolean;
  onOpen: (property: PropertyListItem) => void;
  onChangeStatus: (status: Extract<PropertyStatus, 'AVAILABLE' | 'ARCHIVED'>) => void;
}) {
  const selected = listingAvailability(property.status);

  return (
    <View style={styles.listing}>
      <PropertyCard
        property={property}
        badge={formatPropertyStatus(selected)}
        onPress={onOpen}
      />
      <CategoryChips
        options={AVAILABILITY_OPTIONS}
        selected={selected}
        onSelect={(value) => {
          if (updating || value === selected) return;
          onChangeStatus(value as Extract<PropertyStatus, 'AVAILABLE' | 'ARCHIVED'>);
        }}
      />
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
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.four,
  },
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  locationBlock: {
    flex: 1,
    gap: Spacing.one,
  },
  kicker: {
    fontSize: 14,
    fontWeight: '600',
  },
  headline: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  heroText: {
    fontSize: 14,
    lineHeight: 20,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
  listing: {
    gap: Spacing.two,
  },
  centered: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
  },
});
