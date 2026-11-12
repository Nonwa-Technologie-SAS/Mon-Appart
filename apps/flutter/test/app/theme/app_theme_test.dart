import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/theme/app_colors.dart';
import 'package:mon_appart/app/theme/app_theme.dart';

void main() {
  test('réutilise la palette du site web', () {
    expect(AppColors.primary, const Color(0xFF1565C0));
    expect(AppColors.secondary, const Color(0xFFF5B400));
    expect(AppColors.background, const Color(0xFFF3F6F9));
    expect(AppColors.foreground, const Color(0xFF1A2332));
  });

  test('le thème clair Material 3 expose les tokens de marque', () {
    final theme = AppTheme.light();
    expect(theme.useMaterial3, isTrue);
    expect(theme.colorScheme.primary, AppColors.primary);
    expect(theme.textTheme.titleMedium?.fontWeight, FontWeight.w600);
  });
}
