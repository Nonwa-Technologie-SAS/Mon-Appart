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
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Email et mot de passe requis');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants invalides');
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
        <Text style={[styles.title, { color: theme.text }]}>Connexion</Text>
        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          Accédez à votre espace pour publier et gérer vos biens.
        </Text>

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
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
        />

        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

        <PrimaryButton label="Se connecter" onPress={() => void handleSubmit()} loading={loading} />
        <PrimaryButton
          label="Créer un compte propriétaire"
          variant="ghost"
          onPress={() => router.replace('/register')}
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
