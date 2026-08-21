import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { CategoryChips } from '@/components/home/category-chips';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import {
  PropertyImagePicker,
  type PickedPropertyImage,
} from '@/components/property-image-picker';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createProperty } from '@/lib/api';
import { PROPERTY_TYPE_CHOICES, AVAILABILITY_OPTIONS, type PropertyType } from '@/lib/types';

export default function PublishPropertyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<PropertyType>('HOUSE');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [surface, setSurface] = useState('');
  const [images, setImages] = useState<PickedPropertyImage[]>([]);
  const [status, setStatus] = useState<'AVAILABLE' | 'ARCHIVED'>('AVAILABLE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const parsedPrice = Number(price.replace(/\s/g, ''));
    if (!title.trim() || title.trim().length < 3) {
      setError('Le titre est trop court');
      return;
    }
    if (description.trim().length < 10) {
      setError('La description est trop courte');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Indiquez un prix valide');
      return;
    }
    if (location.trim().length < 2) {
      setError('La localisation est requise');
      return;
    }
    if (images.length === 0) {
      setError('Ajoutez au moins une photo depuis votre galerie');
      return;
    }

    setLoading(true);
    try {
      await createProperty({
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        type,
        location: location.trim(),
        images,
        beds: beds.trim() || undefined,
        baths: baths.trim() || undefined,
        surface: surface.trim() || undefined,
        status,
      });
      router.replace('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de publier le bien');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.text }]}>Nouveau bien</Text>
        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          Renseignez les informations de votre maison pour la mettre en ligne.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Type de bien</Text>
          <CategoryChips
            options={PROPERTY_TYPE_CHOICES}
            selected={type}
            onSelect={(value) => setType(value as PropertyType)}
          />
        </View>

        <FormField
          label="Titre"
          value={title}
          onChangeText={setTitle}
          placeholder="Maison familiale avec jardin"
        />
        <FormField
          label="Ville / quartier"
          value={location}
          onChangeText={setLocation}
          placeholder="Abidjan, Cocody"
        />
        <FormField
          label="Prix (F CFA)"
          value={price}
          onChangeText={setPrice}
          placeholder="250000"
          keyboardType="numeric"
        />
        <FormField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Décrivez le bien, le quartier, les points forts…"
          multiline
        />
        <FormField
          label="Chambres (optionnel)"
          value={beds}
          onChangeText={setBeds}
          placeholder="3"
          keyboardType="numeric"
        />
        <FormField
          label="Salles de bain (optionnel)"
          value={baths}
          onChangeText={setBaths}
          placeholder="2"
          keyboardType="numeric"
        />
        <FormField
          label="Surface (optionnel)"
          value={surface}
          onChangeText={setSurface}
          placeholder="120 m²"
        />
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Statut</Text>
          <CategoryChips
            options={AVAILABILITY_OPTIONS}
            selected={status}
            onSelect={(value) => setStatus(value as 'AVAILABLE' | 'ARCHIVED')}
          />
        </View>
        <PropertyImagePicker
          images={images}
          onChange={(next) => {
            setImages(next);
            setError(null);
          }}
          onError={setError}
        />

        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

        <PrimaryButton
          label="Publier l’annonce"
          onPress={() => void handleSubmit()}
          loading={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
