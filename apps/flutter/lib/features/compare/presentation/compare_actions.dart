import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../domain/shortlist_entry.dart';
import 'shortlist_providers.dart';

String shortlistMessage(ShortlistChange change, int count) {
  return switch (change) {
    ShortlistChange.added =>
      'Ajouté à la comparaison ($count/${ShortlistLimits.maxItems}). '
          'Sélection locale, non synchronisée entre appareils.',
    ShortlistChange.removed => 'Retiré de la comparaison.',
    ShortlistChange.duplicate => 'Cette annonce est déjà dans la comparaison.',
    ShortlistChange.full =>
      'La comparaison est limitée à ${ShortlistLimits.maxItems} annonces.',
    ShortlistChange.invalid => 'Identifiant d\'annonce invalide.',
  };
}

ShortlistChange toggleShortlist(WidgetRef ref, ShortlistEntry entry) {
  return ref.read(shortlistControllerProvider.notifier).toggle(entry);
}

Future<void> toggleShortlistWithFeedback({
  required BuildContext context,
  required WidgetRef ref,
  required ShortlistEntry entry,
  bool offerOpen = true,
}) async {
  final change = toggleShortlist(ref, entry);
  final count = ref.read(shortlistControllerProvider).length;
  if (!context.mounted) {
    return;
  }
  final messenger = ScaffoldMessenger.of(context);
  messenger.clearSnackBars();
  messenger.showSnackBar(
    SnackBar(
      content: Text(shortlistMessage(change, count)),
      action:
          offerOpen &&
              (change == ShortlistChange.added ||
                  change == ShortlistChange.duplicate)
          ? SnackBarAction(
              label: 'Voir',
              onPressed: () => context.push(AppRoutes.compare),
            )
          : null,
    ),
  );
}
