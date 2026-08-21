import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AuthProvider } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="property/[id]"
            options={{
              headerShown: true,
              title: 'Détail du bien',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="login"
            options={{
              headerShown: true,
              title: 'Connexion',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="register"
            options={{
              headerShown: true,
              title: 'Inscription',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="publish/new"
            options={{
              headerShown: true,
              title: 'Publier un bien',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              headerShown: true,
              title: 'Notifications',
              presentation: 'card',
            }}
          />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
