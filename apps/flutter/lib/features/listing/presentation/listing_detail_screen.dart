import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/offline/offline_messages.dart';
import '../../../core/listing/listing_summary.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/favorite_button.dart';
import '../../../core/widgets/price_label.dart';
import '../../../core/widgets/property_card.dart';
import '../../../core/widgets/section_header.dart';
import '../../../core/widgets/status_badge.dart';
import '../../compare/domain/shortlist_entry.dart';
import '../../compare/presentation/compare_actions.dart';
import '../../compare/presentation/shortlist_providers.dart';
import '../../favorites/presentation/favorite_actions.dart';
import '../../favorites/presentation/favorites_providers.dart';
import '../../visits/domain/external_maps.dart';
import '../../visits/domain/visit.dart';
import '../../offline/offline_banner.dart';
import '../../visits/presentation/visit_tour_providers.dart';
import '../domain/listing_detail.dart';
import '../domain/listing_page.dart';
import '../domain/listing_trust.dart';
import 'listing_contact_sheet.dart';
import 'listing_gallery.dart';
import 'listing_providers.dart';
import 'listing_viewer_screen.dart';
import 'listing_visit_sheet.dart';

class ListingDetailScreen extends ConsumerStatefulWidget {
  const ListingDetailScreen({super.key, required this.listingId});

  final String listingId;

  @override
  ConsumerState<ListingDetailScreen> createState() =>
      _ListingDetailScreenState();
}

class _ListingDetailScreenState extends ConsumerState<ListingDetailScreen> {
  final _galleryController = PageController();
  var _galleryIndex = 0;
  var _descriptionExpanded = false;

  @override
  void dispose() {
    _galleryController.dispose();
    super.dispose();
  }

  ListingController get _controller =>
      ref.read(listingControllerProvider(widget.listingId).notifier);

  Future<void> _openViewer(ListingPage page, int index) async {
    final items = page.gallery;
    if (items.isEmpty) {
      return;
    }
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => ListingViewerScreen(items: items, initialIndex: index),
      ),
    );
  }

  Future<void> _onFavorite() async {
    await _controller.toggleFavorite();
    if (!mounted) {
      return;
    }
    final failure = ref
        .read(listingControllerProvider(widget.listingId))
        .value
        ?.actionError;
    if (failure is FavoriteNeedsAuthFailure) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failure.message)));
      await context.push(
        AppRoutes.loginWithNext(AppRoutes.listing(widget.listingId)),
      );
    } else if (failure != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failure.message)));
    } else if (ref
            .read(favoritesControllerProvider)
            .value
            ?.isQueued(widget.listingId) ??
        false) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(OfflineMessages.queuedFavorite)),
      );
    }
  }

  Future<void> _openDirections(ListingDetail listing) async {
    final location = listing.location;
    final uri = ExternalMaps.destination(
      latitude: location.latitude!,
      longitude: location.longitude!,
    );
    if (uri == null) {
      return;
    }
    final opened = await ref.read(mapsLauncherProvider).open(uri);
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          opened
              ? listing.location.isApproximate
                    ? 'Position approximative ouverte dans une autre application. Ce n\'est pas l\'adresse du logement.'
                    : 'Destination ouverte dans une autre application. Cela ne démarre pas un guidage dans Mon Appart.'
              : 'Aucune application de cartes n\'a pu être ouverte.',
        ),
      ),
    );
  }

  Future<void> _onShare() async {
    try {
      await _controller.share();
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Le partage n\'a pas pu aboutir.')),
      );
    }
  }

  Future<void> _onContact() async {
    final message = await showListingContactSheet(context);
    if (message == null || !mounted) {
      return;
    }
    try {
      final started = await _controller.sendContact(message);
      if (!mounted || started == null) {
        return;
      }
      await context.push(AppRoutes.conversation(started.conversation.id));
    } on NeedsAuthFailure catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
      await context.push(
        AppRoutes.loginWithNext(AppRoutes.listing(widget.listingId)),
      );
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _onVisit() async {
    final draft = await showListingVisitSheet(context);
    if (draft == null || !mounted) {
      return;
    }
    try {
      final result = await _controller.sendVisit(
        draft.scheduledAt,
        draft.notes,
      );
      if (!mounted || result == null) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_visitSubmittedMessage(result))));
      await context.push(AppRoutes.appointment(result.visit.id));
    } on AppointmentAlreadyActiveFailure catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
      if (error.existingId != null) {
        await context.push(AppRoutes.appointment(error.existingId!));
      }
    } on NeedsAuthFailure catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
      await context.push(
        AppRoutes.loginWithNext(AppRoutes.listing(widget.listingId)),
      );
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  static String _visitSubmittedMessage(VisitRequestResult result) {
    if (result.alreadyExisted) {
      return 'Une visite est déjà en cours pour cette annonce.';
    }
    if (result.visit.status != 'PENDING') {
      return 'Demande enregistrée. Ce n\'est pas une confirmation automatique.';
    }
    return 'Demande de visite envoyée. Elle n\'est pas confirmée '
        'tant que l\'annonceur n\'a pas répondu.';
  }

  @override
  Widget build(BuildContext context) {
    final asyncPage = ref.watch(listingControllerProvider(widget.listingId));
    final favorites = ref.watch(favoritesControllerProvider).value;
    final inCompare = ref
        .watch(shortlistControllerProvider)
        .any((entry) => entry.listingId == widget.listingId);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Annonce'),
        actions: [
          IconButton(
            tooltip: 'Partager',
            onPressed: asyncPage.hasValue ? _onShare : null,
            icon: const Icon(Icons.share_outlined),
          ),
          if (asyncPage.value case final page?)
            IconButton(
              tooltip: inCompare
                  ? 'Retirer de la comparaison'
                  : 'Ajouter à la comparaison',
              onPressed: () => toggleShortlistWithFeedback(
                context: context,
                ref: ref,
                entry: ShortlistEntry.fromDetail(page.listing),
              ),
              icon: Icon(
                inCompare
                    ? Icons.compare_arrows
                    : Icons.compare_arrows_outlined,
              ),
            ),
          if (asyncPage.value case final page?)
            FavoriteButton(
              isFavorite: page.favorited,
              enabled: !(favorites?.isBusy(widget.listingId) ?? false),
              onPressed: _onFavorite,
            ),
        ],
      ),
      body: asyncPage.when(
        skipLoadingOnReload: true,
        skipLoadingOnRefresh: asyncPage.hasValue,
        loading: () => const AppLoading(label: 'Chargement de l\'annonce'),
        error: (error, _) {
          final failure = error is AppFailure
              ? error
              : UnexpectedFailure(message: error.toString());
          final unavailable =
              failure is ListingUnavailableFailure ||
              failure is InvalidListingIdFailure;
          return AppErrorView(
            failure: failure,
            title: unavailable
                ? 'Annonce indisponible'
                : 'Fiche impossible à charger',
            onRetry: unavailable
                ? null
                : () {
                    ref
                        .read(
                          listingControllerProvider(widget.listingId).notifier,
                        )
                        .retry();
                  },
          );
        },
        data: (page) => _ListingBody(
          page: page,
          galleryController: _galleryController,
          galleryIndex: _galleryIndex,
          descriptionExpanded: _descriptionExpanded,
          onGalleryIndex: (index) => setState(() => _galleryIndex = index),
          onToggleDescription: () {
            setState(() => _descriptionExpanded = !_descriptionExpanded);
          },
          onOpenViewer: (index) => _openViewer(page, index),
          onRetryMedia: _controller.retry,
          onOpenListing: (listing) {
            context.push(AppRoutes.listing(listing.listingId));
          },
          onFavoriteListing: (listing) {
            toggleFavoriteFromCard(
              context: context,
              ref: ref,
              listing: listing,
              loginNext: AppRoutes.listing(widget.listingId),
            );
          },
          onOpenDirections: page.listing.location.hasPublicMapPoint
              ? () => _openDirections(page.listing)
              : null,
          isFavoriteListing: (id) => favorites?.contains(id) ?? false,
          isFavoriteBusy: (id) => favorites?.isBusy(id) ?? false,
        ),
      ),
      bottomNavigationBar: asyncPage.maybeWhen(
        data: (page) => _ActionBar(
          submitting: page.contactSubmitting || page.visitSubmitting,
          onContact: _onContact,
          onVisit: _onVisit,
        ),
        orElse: () => null,
      ),
    );
  }
}

class _ListingBody extends StatelessWidget {
  const _ListingBody({
    required this.page,
    required this.galleryController,
    required this.galleryIndex,
    required this.descriptionExpanded,
    required this.onGalleryIndex,
    required this.onToggleDescription,
    required this.onOpenViewer,
    required this.onRetryMedia,
    required this.onOpenListing,
    required this.onFavoriteListing,
    required this.isFavoriteListing,
    required this.isFavoriteBusy,
    this.onOpenDirections,
  });

  final ListingPage page;
  final PageController galleryController;
  final int galleryIndex;
  final bool descriptionExpanded;
  final ValueChanged<int> onGalleryIndex;
  final VoidCallback onToggleDescription;
  final ValueChanged<int> onOpenViewer;
  final VoidCallback onRetryMedia;
  final ValueChanged<ListingSummary> onOpenListing;
  final ValueChanged<ListingSummary> onFavoriteListing;
  final bool Function(String listingId) isFavoriteListing;
  final bool Function(String listingId) isFavoriteBusy;
  final VoidCallback? onOpenDirections;

  @override
  Widget build(BuildContext context) {
    final listing = page.listing;
    return ListView(
      padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
      children: [
        ListingGallery(
          items: page.gallery,
          controller: galleryController,
          index: galleryIndex,
          onIndexChanged: onGalleryIndex,
          onOpenViewer: onOpenViewer,
          failed: page.mediaFailed,
          onRetry: onRetryMedia,
        ),
        Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (page.fromCache || page.stale)
                StaleNotice(
                  cachedAt: page.cachedAt,
                  fromCache: page.fromCache || page.stale,
                ),
              if (page.fromCache || page.stale)
                const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  StatusBadge(label: listing.listingTypeLabel),
                  StatusBadge(
                    label: listing.propertyTypeName,
                    tone: StatusBadgeTone.neutral,
                  ),
                  if (!listing.isPublished)
                    StatusBadge(
                      label: listing.status,
                      tone: StatusBadgeTone.warning,
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                listing.title,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: AppSpacing.xs),
              PriceLabel(price: listing.price),
              const SizedBox(height: AppSpacing.xs),
              Text(listing.location.label),
              if (listing.location.isApproximate)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xxs),
                  child: Text(
                    'Position approximative (environ 1 km). '
                    'L\'adresse exacte n\'est pas publique.',
                    style: Theme.of(context).textTheme.bodySmall
                        ?.copyWith(color: AppColors.mutedForeground),
                  ),
                ),
              if (listing.location.hasPublicAddress)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xxs),
                  child: Text(listing.location.address!),
                ),
              if (listing.publishedAt != null)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xs),
                  child: Text(
                    'Publiée le ${DateFormat('dd/MM/yyyy').format(listing.publishedAt!.toLocal())}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(title: 'Caractéristiques'),
              _Specs(listing: listing),
              if (listing.description != null) ...[
                const SizedBox(height: AppSpacing.lg),
                const SectionHeader(title: 'Description'),
                _Description(
                  text: listing.description!,
                  expanded: descriptionExpanded,
                  onToggle: onToggleDescription,
                ),
              ],
              if (listing.amenities.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                const SectionHeader(title: 'Équipements'),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    for (final amenity in listing.amenities)
                      Chip(label: Text(amenity.name)),
                  ],
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(
                title: 'Localisation',
                subtitle: 'Seules les informations publiques du contrat Nest sont affichées.',
              ),
              Text(listing.location.label),
              if (onOpenDirections != null) ...[
                const SizedBox(height: AppSpacing.sm),
                AppButton(
                  label: listing.location.isApproximate
                      ? 'Ouvrir la zone (approximative)'
                      : 'Itinéraire',
                  variant: AppButtonVariant.outline,
                  icon: Icons.directions_outlined,
                  onPressed: onOpenDirections,
                ),
              ] else
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xs),
                  child: Text(
                    'Pas de coordonnées publiques : aucun marqueur ni itinéraire n\'est proposé.',
                    style: Theme.of(context).textTheme.bodySmall
                        ?.copyWith(color: AppColors.mutedForeground),
                  ),
                ),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(
                title: 'Confiance',
                subtitle: 'Les badges décrivent un examen de pièces, pas une garantie du bien.',
              ),
              _TrustBlock(trust: page.trust),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(title: 'Annonceur'),
              Text(
                'Les coordonnées personnelles ne sont pas publiées. '
                'Utilisez Contacter pour passer par la messagerie interne.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(title: 'Avant une visite ou un paiement'),
              Text(
                'Visitez le bien et vérifiez les documents. Mon Appart ne '
                'certifie pas le titre de propriété et ne traite aucun paiement '
                'sur cette fiche.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              if (page.similar.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                const SectionHeader(
                  title: 'Annonces similaires',
                  subtitle: 'Sélection Nest, même type d\'offre et catégorie.',
                ),
                for (final item in page.similar)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: PropertyCard(
                      listing: item,
                      onTap: () => onOpenListing(item),
                      onFavorite: () => onFavoriteListing(item),
                      isFavorite: isFavoriteListing(item.listingId),
                      favoriteEnabled: !isFavoriteBusy(item.listingId),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Specs extends StatelessWidget {
  const _Specs({required this.listing});

  final ListingDetail listing;

  @override
  Widget build(BuildContext context) {
    final items = <(IconData, String)>[
      if (listing.bedrooms != null)
        (Icons.bed_outlined, '${listing.bedrooms} chambres'),
      if (listing.bathrooms != null)
        (Icons.bathtub_outlined, '${listing.bathrooms} salles de bain'),
      if (listing.rooms != null)
        (Icons.meeting_room_outlined, '${listing.rooms} pièces'),
      if (!listing.isLand && listing.surface != null)
        (Icons.square_foot, '${listing.surface} m²'),
      if (listing.landSurface != null)
        (Icons.landscape_outlined, '${listing.landSurface} m² de terrain'),
    ];
    if (items.isEmpty) {
      return Text(
        'Aucune caractéristique chiffrée n\'est renseignée.',
        style: Theme.of(context).textTheme.bodyMedium,
      );
    }
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.sm,
      children: [
        for (final item in items)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(item.$1, size: 20, color: AppColors.primary),
              const SizedBox(width: AppSpacing.xxs),
              Text(item.$2),
            ],
          ),
      ],
    );
  }
}

class _Description extends StatelessWidget {
  const _Description({
    required this.text,
    required this.expanded,
    required this.onToggle,
  });

  final String text;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final long = text.length > 280;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          text,
          maxLines: expanded || !long ? null : 6,
          overflow: expanded || !long ? null : TextOverflow.ellipsis,
        ),
        if (long)
          TextButton(
            onPressed: onToggle,
            child: Text(expanded ? 'Réduire' : 'Lire la suite'),
          ),
      ],
    );
  }
}

class _TrustBlock extends StatelessWidget {
  const _TrustBlock({required this.trust});

  final ListingTrust trust;

  @override
  Widget build(BuildContext context) {
    if (!trust.hasContent) {
      return Text(
        'Aucun badge de confiance n\'est publié pour cette annonce.',
        style: Theme.of(context).textTheme.bodyMedium,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (trust.listingBadges.isNotEmpty) ...[
          Text('Annonce', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              for (final badge in trust.listingBadges)
                StatusBadge(label: badge.label, tone: StatusBadgeTone.success),
            ],
          ),
        ],
        if (trust.publisherBadges.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text('Annonceur', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              for (final badge in trust.publisherBadges)
                StatusBadge(label: badge.label, tone: StatusBadgeTone.accent),
            ],
          ),
        ],
        if (trust.verificationInProgress)
          const Padding(
            padding: EdgeInsets.only(top: AppSpacing.sm),
            child: Text('Un dossier de vérification est en cours d\'examen.'),
          ),
        if (trust.disclaimer != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              trust.disclaimer!,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: AppColors.mutedForeground),
            ),
          ),
      ],
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.submitting,
    required this.onContact,
    required this.onVisit,
  });

  final bool submitting;
  final VoidCallback onContact;
  final VoidCallback onVisit;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 8,
      color: AppColors.card,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.sm,
          ),
          child: Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Contacter',
                  icon: Icons.chat_bubble_outline,
                  onPressed: submitting ? null : onContact,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppButton(
                  label: 'Visite',
                  icon: Icons.event_available_outlined,
                  variant: AppButtonVariant.outline,
                  onPressed: submitting ? null : onVisit,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
