import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { requestPropertyVisit } from '@/lib/api';

const VISIT_HOURS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

function upcomingDays(count = 14) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const value = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');

    const label =
      index === 0
        ? 'Aujourd’hui'
        : index === 1
          ? 'Demain'
          : date.toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });

    return { value, label };
  });
}

function combineVisitAt(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

type VisitRequestFormProps = {
  propertyId: string;
};

export function VisitRequestForm({ propertyId }: VisitRequestFormProps) {
  const theme = useTheme();
  const days = useMemo(() => upcomingDays(), []);
  const [dateValue, setDateValue] = useState(days[0]?.value ?? '');
  const [timeValue, setTimeValue] = useState('10:00');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!dateValue || !timeValue) {
      setError('Choisissez une date et une heure');
      return;
    }

    const visitAt = combineVisitAt(dateValue, timeValue);
    if (visitAt.getTime() < Date.now() - 60_000) {
      setError('Choisissez un créneau à venir');
      return;
    }

    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length < 8) {
      setError('Indiquez un numéro WhatsApp valide');
      return;
    }

    setLoading(true);
    try {
      await requestPropertyVisit(propertyId, {
        visitAt: visitAt.toISOString(),
        whatsapp: digits,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’envoyer la demande');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View
        style={[
          styles.box,
          {
            backgroundColor: theme.backgroundSelected,
            borderColor: theme.secondary,
          },
        ]}>
        <Text style={[styles.title, { color: theme.text }]}>Demande envoyée</Text>
        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          Le propriétaire a reçu votre créneau et votre numéro WhatsApp. Il pourra
          vous recontacter.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <Text style={[styles.title, { color: theme.text }]}>Demander une visite</Text>
      <Text style={[styles.lead, { color: theme.textSecondary }]}>
        Indiquez le jour, l’heure et votre WhatsApp pour que le propriétaire
        vous contacte.
      </Text>

      <Text style={[styles.label, { color: theme.text }]}>Date</Text>
      <View style={styles.chips}>
        {days.map((day) => {
          const active = day.value === dateValue;
          return (
            <Pressable
              key={day.value}
              onPress={() => setDateValue(day.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.secondary : theme.background,
                  borderColor: active ? theme.secondary : theme.border,
                },
              ]}>
              <Text
                style={[
                  styles.chipText,
                  { color: active ? theme.secondaryForeground : theme.text },
                ]}>
                {day.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: theme.text }]}>Heure</Text>
      <View style={styles.chips}>
        {VISIT_HOURS.map((hour) => {
          const active = hour === timeValue;
          return (
            <Pressable
              key={hour}
              onPress={() => setTimeValue(hour)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.secondary : theme.background,
                  borderColor: active ? theme.secondary : theme.border,
                },
              ]}>
              <Text
                style={[
                  styles.chipText,
                  { color: active ? theme.secondaryForeground : theme.text },
                ]}>
                {hour}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FormField
        label="Numéro WhatsApp"
        value={whatsapp}
        onChangeText={setWhatsapp}
        placeholder="+225 07 00 00 00 00"
        keyboardType="phone-pad"
        autoCapitalize="none"
        autoComplete="tel"
      />

      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

      <PrimaryButton
        label="Envoyer la demande"
        variant="secondary"
        loading={loading}
        onPress={() => void handleSubmit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: Spacing.four,
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.one,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
