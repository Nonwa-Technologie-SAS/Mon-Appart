import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';
import 'app_radii.dart';
import 'app_spacing.dart';
import 'app_typography.dart';

abstract final class AppTheme {
  static ThemeData light() => _build(
    brightness: Brightness.light,
    primary: AppColors.primary,
    onPrimary: AppColors.primaryForeground,
    secondary: AppColors.secondary,
    onSecondary: AppColors.secondaryForeground,
    background: AppColors.background,
    foreground: AppColors.foreground,
    card: AppColors.card,
    muted: AppColors.muted,
    mutedForeground: AppColors.mutedForeground,
    border: AppColors.border,
    error: AppColors.destructive,
    accent: AppColors.accent,
  );

  static ThemeData dark() => _build(
    brightness: Brightness.dark,
    primary: AppColors.darkPrimary,
    onPrimary: AppColors.darkPrimaryForeground,
    secondary: AppColors.secondary,
    onSecondary: AppColors.darkPrimaryForeground,
    background: AppColors.darkBackground,
    foreground: AppColors.darkForeground,
    card: AppColors.darkCard,
    muted: AppColors.darkMuted,
    mutedForeground: AppColors.darkMutedForeground,
    border: AppColors.darkBorder,
    error: AppColors.destructive,
    accent: AppColors.darkAccent,
  );

  static ThemeData _build({
    required Brightness brightness,
    required Color primary,
    required Color onPrimary,
    required Color secondary,
    required Color onSecondary,
    required Color background,
    required Color foreground,
    required Color card,
    required Color muted,
    required Color mutedForeground,
    required Color border,
    required Color error,
    required Color accent,
  }) {
    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: primary,
      onPrimary: onPrimary,
      secondary: secondary,
      onSecondary: onSecondary,
      error: error,
      onError: onPrimary,
      surface: card,
      onSurface: foreground,
      tertiary: accent,
      onTertiary: foreground,
      outline: border,
      surfaceContainerHighest: muted,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: background,
      visualDensity: VisualDensity.standard,
    );

    return base.copyWith(
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: foreground,
        elevation: 0,
        centerTitle: false,
        systemOverlayStyle: brightness == Brightness.dark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
        titleTextStyle: TextStyle(
          color: foreground,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.card,
          side: BorderSide(color: border),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(
            AppSpacing.touchTarget,
            AppSpacing.touchTarget,
          ),
          backgroundColor: primary,
          foregroundColor: onPrimary,
          elevation: 0,
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.button),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(
            AppSpacing.touchTarget,
            AppSpacing.touchTarget,
          ),
          foregroundColor: primary,
          side: BorderSide(color: primary),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.button),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(
            AppSpacing.touchTarget,
            AppSpacing.touchTarget,
          ),
          backgroundColor: secondary,
          foregroundColor: onSecondary,
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.button),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadii.field,
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadii.field,
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadii.field,
          borderSide: BorderSide(color: primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadii.field,
          borderSide: BorderSide(color: error),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: card,
        indicatorColor: accent,
        height: 72,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? primary : mutedForeground,
          );
        }),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: foreground,
        contentTextStyle: TextStyle(color: card),
      ),
      dividerColor: border,
      textTheme: AppTypography.textTheme(
        base: base.textTheme,
        foreground: foreground,
        muted: mutedForeground,
      ),
    );
  }
}
