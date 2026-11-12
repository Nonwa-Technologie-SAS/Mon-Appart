import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_radii.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/listing_summary.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/property_card.dart';
import '../../compare/domain/shortlist_entry.dart';
import '../../compare/presentation/shortlist_providers.dart';
import '../../favorites/domain/favorites_snapshot.dart';
import '../../favorites/presentation/favorite_actions.dart';
import '../../favorites/presentation/favorites_providers.dart';
import '../domain/assistant_models.dart';
import 'assistant_providers.dart';

const _starterPrompts = <String>[
  'Maison 3 chambres à louer à Cocody, budget 250 000 FCFA par mois',
  'Studio meublé à Abidjan pour moins de 150 000 FCFA',
  'Terrain à Bingerville, budget 10 millions',
  'Appartement à louer à Yopougon avec parking',
];

class AssistantScreen extends ConsumerStatefulWidget {
  const AssistantScreen({super.key, this.initialQuery});

  final String? initialQuery;

  @override
  ConsumerState<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends ConsumerState<AssistantScreen> {
  late final TextEditingController _controller;
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialQuery ?? '');
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) {
        return;
      }
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _submit(String raw, {bool forceSearch = false}) async {
    final text = raw.trim();
    if (text.isEmpty) {
      return;
    }
    _controller.clear();
    await ref
        .read(assistantControllerProvider.notifier)
        .send(text, forceSearch: forceSearch);
    _scrollToEnd();
  }

  void _openExplore(AssistantTurn turn) {
    context.go(turn.exploreQuery.toLocation());
  }

  void _openListing(ListingSummary listing) {
    context.push(AppRoutes.listing(listing.listingId));
  }

  Future<void> _onFavorite(ListingSummary listing) {
    return toggleFavoriteFromCard(
      context: context,
      ref: ref,
      listing: listing,
      loginNext: AppRoutes.assistant,
    );
  }

  Future<void> _handleSuggestion(String suggestion, AssistantTurn turn) {
    switch (suggestionKind(suggestion)) {
      case AssistantSuggestionKind.classic:
        _openExplore(turn);
        return Future.value();
      case AssistantSuggestionKind.forceSearch:
        return _submit(suggestion, forceSearch: true);
      case AssistantSuggestionKind.message:
        return _submit(suggestion);
    }
  }

  @override
  Widget build(BuildContext context) {
    final thread = ref.watch(assistantControllerProvider);
    final favorites = ref.watch(favoritesControllerProvider).value;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    ref.listen(assistantControllerProvider, (previous, next) {
      if (next.rows.length != previous?.rows.length || next.pending) {
        _scrollToEnd();
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Assistant immobilier'),
        actions: [
          IconButton(
            tooltip: 'Nouvelle conversation',
            onPressed: thread.rows.isEmpty
                ? null
                : () => ref.read(assistantControllerProvider.notifier).reset(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.md,
              ),
              children: [
                const _IntroCard(),
                if (thread.rows.isEmpty) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'Suggestions',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      for (final prompt in _starterPrompts)
                        ActionChip(
                          label: Text(prompt),
                          onPressed: thread.pending
                              ? null
                              : () => _submit(prompt),
                        ),
                    ],
                  ),
                ],
                for (final row in thread.rows) ...[
                  const SizedBox(height: AppSpacing.md),
                  if (row.isUser)
                    _UserBubble(text: row.text!)
                  else
                    _AssistantTurnBlock(
                      turn: row.turn!,
                      compareIds: thread.compareIds,
                      pending: thread.pending,
                      favorites: favorites,
                      onSuggestion: (suggestion) =>
                          _handleSuggestion(suggestion, row.turn!),
                      onForceSearch: () => ref
                          .read(assistantControllerProvider.notifier)
                          .forceSearchFromLastTurn(),
                      onOpenExplore: () => _openExplore(row.turn!),
                      onOpenListing: _openListing,
                      onFavorite: _onFavorite,
                      onToggleCompare: (id) => ref
                          .read(assistantControllerProvider.notifier)
                          .toggleCompare(id),
                      onFeedback: (rating) => ref
                          .read(assistantControllerProvider.notifier)
                          .sendFeedback(rating),
                      onFillComposer: (chip) {
                        final current = _controller.text.trim();
                        _controller.text = current.isEmpty
                            ? chip
                            : '$current $chip';
                        _controller.selection = TextSelection.collapsed(
                          offset: _controller.text.length,
                        );
                      },
                    ),
                ],
                if (thread.pending) ...[
                  const SizedBox(height: AppSpacing.md),
                  const _PendingBanner(),
                ],
                if (thread.error != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _ErrorBanner(
                    failure: thread.error is AppFailure
                        ? thread.error! as AppFailure
                        : UnexpectedFailure(message: '${thread.error}'),
                    onRetry: () =>
                        ref.read(assistantControllerProvider.notifier).retry(),
                    onExplore: () => context.go(AppRoutes.explore),
                  ),
                ],
                if (thread.compareIds.length >= 2) ...[
                  const SizedBox(height: AppSpacing.md),
                  AppButton(
                    label: 'Comparer ${thread.compareIds.length} biens',
                    icon: Icons.compare_arrows,
                    onPressed: thread.pending
                        ? null
                        : () => ref
                              .read(assistantControllerProvider.notifier)
                              .compareSelected(),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  AppButton(
                    label: 'Tableau de comparaison',
                    variant: AppButtonVariant.outline,
                    icon: Icons.table_chart_outlined,
                    onPressed: thread.pending
                        ? null
                        : () {
                            final listings = thread.lastTurn?.listings ?? [];
                            ref
                                .read(shortlistControllerProvider.notifier)
                                .replaceWith([
                                  for (final id in thread.compareIds)
                                    ShortlistEntry(
                                      listingId: id,
                                      title: _titleFor(listings, id),
                                      propertyId: _propertyIdFor(listings, id),
                                    ),
                                ]);
                            context.push(AppRoutes.compare);
                          },
                  ),
                ],
              ],
            ),
          ),
          Material(
            elevation: 4,
            color: Theme.of(context).colorScheme.surface,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.sm + bottomInset,
              ),
              child: _Composer(
                controller: _controller,
                enabled: !thread.pending,
                onSubmit: _submit,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _IntroCard extends StatelessWidget {
  const _IntroCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.accent,
        borderRadius: AppRadii.card,
        border: Border.all(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Décrivez le logement en français',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Lieu, budget en F CFA, type de bien. L\'assistant clarifie si besoin, puis affiche uniquement des annonces publiées sur Mon Appart. Aucun bien n\'est inventé.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.mutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 320),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: AppColors.primary,
            borderRadius: AppRadii.card,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: AppColors.primaryForeground),
            ),
          ),
        ),
      ),
    );
  }
}

class _PendingBanner extends StatelessWidget {
  const _PendingBanner();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            'Analyse et recherche en cours…',
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: AppColors.mutedForeground),
          ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({
    required this.failure,
    required this.onRetry,
    required this.onExplore,
  });

  final AppFailure failure;
  final VoidCallback onRetry;
  final VoidCallback onExplore;

  @override
  Widget build(BuildContext context) {
    final title = failure.statusCode == 503
        ? 'Assistant indisponible'
        : failure is NetworkFailure || failure is TimeoutFailure
        ? 'Connexion impossible'
        : 'La demande n\'a pas abouti';
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.destructive.withValues(alpha: 0.06),
        borderRadius: AppRadii.card,
        border: Border.all(color: AppColors.destructive.withValues(alpha: 0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: AppSpacing.xxs),
            Text(failure.message, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              children: [
                AppButton(
                  label: 'Réessayer',
                  expand: false,
                  onPressed: onRetry,
                ),
                AppButton(
                  label: 'Recherche classique',
                  variant: AppButtonVariant.outline,
                  expand: false,
                  onPressed: onExplore,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AssistantTurnBlock extends StatelessWidget {
  const _AssistantTurnBlock({
    required this.turn,
    required this.compareIds,
    required this.pending,
    required this.favorites,
    required this.onSuggestion,
    required this.onForceSearch,
    required this.onOpenExplore,
    required this.onOpenListing,
    required this.onFavorite,
    required this.onToggleCompare,
    required this.onFeedback,
    required this.onFillComposer,
  });

  final AssistantTurn turn;
  final Set<String> compareIds;
  final bool pending;
  final FavoritesSnapshot? favorites;
  final ValueChanged<String> onSuggestion;
  final VoidCallback onForceSearch;
  final VoidCallback onOpenExplore;
  final ValueChanged<ListingSummary> onOpenListing;
  final Future<void> Function(ListingSummary listing) onFavorite;
  final ValueChanged<String> onToggleCompare;
  final ValueChanged<AssistantFeedbackRating> onFeedback;
  final ValueChanged<String> onFillComposer;

  @override
  Widget build(BuildContext context) {
    final chips = turn.criteria.chips;
    final hints = turn.criteria.unverifiableHints;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DecoratedBox(
          decoration: const BoxDecoration(
            color: AppColors.muted,
            borderRadius: AppRadii.card,
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Text(
              turn.message,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ),
        if (chips.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              for (final chip in chips)
                InputChip(
                  label: Text(chip),
                  onPressed: pending ? null : () => onFillComposer(chip),
                ),
            ],
          ),
        ],
        if (hints.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Mentions non filtrables : ${hints.join(', ')}',
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: AppColors.mutedForeground),
          ),
        ],
        if (turn.mode == AssistantMode.clarify ||
            turn.mode == AssistantMode.empty ||
            turn.mode == AssistantMode.error) ...[
          const SizedBox(height: AppSpacing.sm),
          _ModeActions(
            turn: turn,
            pending: pending,
            onForceSearch: onForceSearch,
            onOpenExplore: onOpenExplore,
          ),
        ],
        if (turn.listings.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${turn.listings.length} annonce${turn.listings.length > 1 ? 's' : ''} issue${turn.listings.length > 1 ? 's' : ''} de la recherche',
            style: Theme.of(context).textTheme.labelMedium
                ?.copyWith(color: AppColors.mutedForeground),
          ),
          const SizedBox(height: AppSpacing.xs),
          for (final listing in turn.listings) ...[
            PropertyCard(
              listing: listing.asSummary,
              onTap: () => onOpenListing(listing.asSummary),
              onFavorite: () => onFavorite(listing.asSummary),
              isFavorite: favorites?.contains(listing.listingId) ?? false,
              favoriteEnabled: !(favorites?.isBusy(listing.listingId) ?? false),
            ),
            if (listing.matchReasons.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(
                  top: AppSpacing.xxs,
                  bottom: AppSpacing.sm,
                ),
                child: Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    for (final reason in listing.matchReasons)
                      Chip(
                        visualDensity: VisualDensity.compact,
                        label: Text(reason),
                        avatar: const Icon(
                          Icons.check_circle_outline,
                          size: 16,
                        ),
                      ),
                  ],
                ),
              )
            else
              const SizedBox(height: AppSpacing.sm),
            if (turn.listings.length >= 2)
              Align(
                alignment: Alignment.centerLeft,
                child: FilterChip(
                  label: Text(
                    compareIds.contains(listing.listingId)
                        ? 'Retirer de la comparaison'
                        : 'Comparer',
                  ),
                  selected: compareIds.contains(listing.listingId),
                  onSelected: pending
                      ? null
                      : (_) => onToggleCompare(listing.listingId),
                ),
              ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
        if (turn.suggestions.isNotEmpty) ...[
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              for (final suggestion in turn.suggestions)
                ActionChip(
                  label: Text(suggestion),
                  onPressed: pending ? null : () => onSuggestion(suggestion),
                ),
            ],
          ),
        ],
        if (turn.searchParams.isNotEmpty && turn.mode == AssistantMode.results)
          TextButton(
            onPressed: onOpenExplore,
            child: const Text('Voir ces filtres en recherche classique'),
          ),
        if (turn.mode == AssistantMode.results)
          Row(
            children: [
              IconButton(
                tooltip: 'Utile',
                onPressed: () => onFeedback(AssistantFeedbackRating.helpful),
                icon: const Icon(Icons.thumb_up_outlined),
              ),
              IconButton(
                tooltip: 'Pas utile',
                onPressed: () => onFeedback(AssistantFeedbackRating.notHelpful),
                icon: const Icon(Icons.thumb_down_outlined),
              ),
            ],
          ),
      ],
    );
  }
}

class _ModeActions extends StatelessWidget {
  const _ModeActions({
    required this.turn,
    required this.pending,
    required this.onForceSearch,
    required this.onOpenExplore,
  });

  final AssistantTurn turn;
  final bool pending;
  final VoidCallback onForceSearch;
  final VoidCallback onOpenExplore;

  @override
  Widget build(BuildContext context) {
    final forceLabel = turn.mode == AssistantMode.empty
        ? 'Relancer sans filtre strict'
        : 'Lancer la recherche';
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        if (turn.mode != AssistantMode.error)
          AppButton(
            label: forceLabel,
            expand: false,
            onPressed: pending ? null : onForceSearch,
          ),
        AppButton(
          label: 'Recherche classique',
          variant: AppButtonVariant.outline,
          expand: false,
          onPressed: onOpenExplore,
        ),
      ],
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.enabled,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool enabled;
  final ValueChanged<String> onSubmit;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            enabled: enabled,
            minLines: 1,
            maxLines: 4,
            textInputAction: TextInputAction.send,
            onSubmitted: enabled ? onSubmit : null,
            inputFormatters: [
              LengthLimitingTextInputFormatter(assistantMaxMessageLength),
            ],
            decoration: const InputDecoration(
              hintText: 'Ex. maison 3 chambres à Cocody, 250 000 F CFA / mois',
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        IconButton.filled(
          tooltip: 'Envoyer',
          onPressed: enabled ? () => onSubmit(controller.text) : null,
          icon: const Icon(Icons.send),
        ),
      ],
    );
  }
}

String _titleFor(List<AssistantListingCard> listings, String id) {
  for (final listing in listings) {
    if (listing.listingId == id) {
      return listing.title;
    }
  }
  return 'Annonce';
}

String _propertyIdFor(List<AssistantListingCard> listings, String id) {
  for (final listing in listings) {
    if (listing.listingId == id) {
      return listing.propertyId;
    }
  }
  return id;
}
