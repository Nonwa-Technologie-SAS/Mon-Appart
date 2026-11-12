import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../errors/app_failure.dart';
import 'app_empty_state.dart';
import 'app_error_view.dart';
import 'property_card_skeleton.dart';

class InlineAsyncSection<T> extends StatelessWidget {
  const InlineAsyncSection({
    super.key,
    required this.asyncValue,
    required this.onRetry,
    required this.data,
    this.emptyTitle = 'Aucun résultat',
    this.emptyMessage = 'Aucune annonce disponible pour cette sélection.',
    this.isEmpty,
  });

  final AsyncValue<T> asyncValue;
  final VoidCallback onRetry;
  final Widget Function(T value) data;
  final String emptyTitle;
  final String emptyMessage;
  final bool Function(T value)? isEmpty;

  @override
  Widget build(BuildContext context) {
    return asyncValue.when(
      skipLoadingOnReload: true,
      loading: () => const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          PropertyCardSkeleton(),
          SizedBox(height: 12),
          PropertyCardSkeleton(),
        ],
      ),
      error: (error, _) {
        final failure = error is AppFailure
            ? error
            : UnexpectedFailure(message: error.toString());
        return AppErrorView(
          failure: failure,
          onRetry: onRetry,
          title: 'Chargement impossible',
          compact: true,
        );
      },
      data: (value) {
        if (isEmpty?.call(value) ?? false) {
          return AppEmptyState(
            title: emptyTitle,
            message: emptyMessage,
            compact: true,
          );
        }
        return data(value);
      },
    );
  }
}
