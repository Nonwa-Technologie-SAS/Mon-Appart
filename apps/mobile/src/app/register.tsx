import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';

import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { registerOwnerAccount } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (name.trim().length < 2) {
      setError('Le nom doit contenir au moins 2 caractères');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);
    try {
      await registerOwnerAccount({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      await signIn(email.trim(), password);
      router.replace('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer le compte');
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
        <Text style={[styles.title, { color: theme.text }]}>
          Compte propriétaire
        </Text>
        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          Créez un compte pour publier vos maisons sur la plateforme.
        </Text>

        <FormField
          label="Nom complet"
          value={name}
          onChangeText={setName}
          placeholder="Jean Dupont"
          autoCapitalize="words"
          autoComplete="name"
        />
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="vous@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <FormField
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          placeholder="8 caractères minimum"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
        />

        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

        <PrimaryButton
          label="Créer mon compte"
          onPress={() => void handleSubmit()}
          loading={loading}
        />
        <PrimaryButton
          label="J’ai déjà un compte"
          variant="ghost"
          onPress={() => router.replace('/login')}
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
});
