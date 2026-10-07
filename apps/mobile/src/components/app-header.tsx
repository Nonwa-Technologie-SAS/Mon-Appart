import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchOwnerVisits } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { canPublishListings } from '@/lib/types';

export function AppHeader() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const initial = user?.name?.trim().charAt(0).toUpperCase() ?? null;
  const isOwner = canPublishListings(user?.role);
  const [pendingCount, setPendingCount] = useState(0);

  const loadPending = useCallback(async () => {
    if (!isOwner) {
      setPendingCount(0);
      return;
    }
    try {
      const result = await fetchOwnerVisits();
      setPendingCount(result.pendingCount);
    } catch {
      setPendingCount(0);
    }
  }, [isOwner]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
        },
      ]}>
      <Text style={styles.brand} numberOfLines={1}>
        <Text style={{ color: theme.primary }}>Mon </Text>
        <Text style={{ color: theme.secondary }}>Appart</Text>
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/notifications')}
          style={[styles.iconBtn, { backgroundColor: theme.secondary }]}
          accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={20} color={theme.secondaryForeground} />
          {pendingCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => router.push('/account')}
          style={[
            styles.iconBtn,
            {
              backgroundColor: isOwner ? theme.primary : theme.backgroundElement,
            },
          ]}
          accessibilityLabel="Profil propriétaire">
          {user?.image ? (
            <Image source={{ uri: user.image }} style={styles.avatar} contentFit="cover" />
          ) : initial ? (
            <Text
              style={[
                styles.initial,
                { color: isOwner ? theme.primaryForeground : theme.primary },
              ]}>
              {initial}
            </Text>
          ) : (
            <Ionicons
              name="person-outline"
              size={20}
              color={isOwner ? theme.primaryForeground : theme.text}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: 1,
    gap: Spacing.three,
  },
  brand: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  initial: {
    fontSize: 16,
    fontWeight: '700',
  },
});
