import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchOwnerVisits } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  canPublishListings,
  formatVisitDateTime,
  formatVisitStatus,
  whatsappUrl,
  type OwnerVisitRequest,
} from '@/lib/types';

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isPending } = useAuth();
  const [visits, setVisits] = useState<OwnerVisitRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = canPublishListings(user?.role);

  const load = useCallback(async () => {
    if (!isOwner) {
      setVisits([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchOwnerVisits();
      setVisits(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (isPending || loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.secondary} />
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={36} color={theme.secondary} />
          <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
          <Text style={[styles.lead, { color: theme.textSecondary }]}>
            Les demandes de visite apparaîtront ici pour les propriétaires.
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background, padding: Spacing.four }]}>
        <Text style={{ color: theme.danger, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (visits.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={36} color={theme.secondary} />
          <Text style={[styles.title, { color: theme.text }]}>Aucune demande</Text>
          <Text style={[styles.lead, { color: theme.textSecondary }]}>
            Quand un client voudra visiter l’un de vos biens, la demande
            s’affichera ici avec son WhatsApp.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.list}>
      {visits.map((visit) => (
        <View
          key={visit.id}
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.status,
                {
                  backgroundColor:
                    visit.status === 'PENDING' ? theme.secondary : theme.backgroundSelected,
                },
              ]}>
              <Text style={{ color: theme.secondaryForeground, fontWeight: '700', fontSize: 12 }}>
                {formatVisitStatus(visit.status)}
              </Text>
            </View>
          </View>

          <Pressable onPress={() => router.push(`/property/${visit.property.id}`)}>
            <Text style={[styles.property, { color: theme.text }]}>{visit.property.title}</Text>
            <Text style={{ color: theme.textSecondary }}>{visit.property.location}</Text>
          </Pressable>

          <Text style={[styles.when, { color: theme.text }]}>
            {formatVisitDateTime(visit.visitDate)}
          </Text>
          <Text style={{ color: theme.textSecondary }}>WhatsApp {visit.visitorWhatsapp}</Text>

          <Pressable
            onPress={() => void Linking.openURL(whatsappUrl(visit.visitorWhatsapp))}
            style={[styles.whatsappBtn, { backgroundColor: theme.secondary }]}>
            <Ionicons name="logo-whatsapp" size={18} color={theme.secondaryForeground} />
            <Text style={{ color: theme.secondaryForeground, fontWeight: '700' }}>
              Contacter sur WhatsApp
            </Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  property: {
    fontSize: 17,
    fontWeight: '700',
  },
  when: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  whatsappBtn: {
    marginTop: Spacing.one,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
