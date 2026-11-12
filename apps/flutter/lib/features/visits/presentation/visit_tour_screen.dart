import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../app/providers.dart';
import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_radii.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/search/geo_search.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/status_badge.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../compare/presentation/shortlist_providers.dart';
import '../../explore/presentation/explore_map_pane.dart';
import '../domain/external_maps.dart';
import '../domain/visit.dart';
import '../domain/visit_labels.dart';
import '../domain/visit_tour.dart';
import '../domain/visit_tour_rules.dart';
import 'visit_tour_providers.dart';
import 'visits_providers.dart';

class VisitTourScreen extends ConsumerStatefulWidget {
  const VisitTourScreen({super.key, this.initialVisitIds = const []});

  final List<String> initialVisitIds;

  @override
  ConsumerState<VisitTourScreen> createState() => _VisitTourScreenState();
}

class _VisitTourScreenState extends ConsumerState<VisitTourScreen> {
  @override
  void initState() {
    super.initState();
    if (widget.initialVisitIds.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }
        ref
            .read(visitTourSelectionProvider.notifier)
            .replace(widget.initialVisitIds);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).value;
    return Scaffold(
      appBar: AppBar(title: const Text('Tournée de visites')),
      body: session?.isAuthenticated != true
          ? AppEmptyState(
              icon: Icons.lock_outline,
              title: 'Connexion requise',
              message:
                  'Connectez-vous pour préparer une tournée à partir de vos visites. '
                  'Une demande n\'est pas un rendez-vous confirmé.',
              actionLabel: 'Se connecter',
              onAction: () =>
                  context.push(AppRoutes.loginWithNext(AppRoutes.visitTour)),
            )
          : const _TourBody(),
    );
  }
}

class _TourBody extends ConsumerWidget {
  const _TourBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visitsAsync = ref.watch(visitsControllerProvider);
    return visitsAsync.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement des visites'),
      error: (error, _) => AppErrorView(
        failure: error is AppFailure
            ? error
            : UnexpectedFailure(message: error.toString()),
        onRetry: () => ref.read(visitsControllerProvider.notifier).refresh(),
      ),
      data: (snapshot) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!context.mounted) {
            return;
          }
          ref
              .read(visitTourSelectionProvider.notifier)
              .autofillConfirmed(snapshot.items);
        });
        final tourable = [
          for (final visit in snapshot.items)
            if (VisitTourRules.canInclude(visit)) visit,
        ];
        if (tourable.isEmpty &&
            ref.watch(shortlistControllerProvider).isEmpty) {
          return AppEmptyState(
            icon: Icons.route_outlined,
            title: 'Aucune visite à organiser',
            message:
                'Demandez une visite depuis une fiche. '
                'Seules les demandes à venir peuvent entrer dans une tournée.',
            actionLabel: 'Mes visites',
            onAction: () => context.go(AppRoutes.visits),
          );
        }
        return ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.xxl,
          ),
          children: [
            Text(
              'Les horaires viennent des rendez-vous Nest. '
              'Aucune durée de trajet n\'est calculée : il n\'existe pas d\'API d\'itinéraire.',
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: AppColors.mutedForeground),
            ),
            const SizedBox(height: AppSpacing.md),
            Text('Visites', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.xs),
            for (final visit in tourable) _VisitChoice(visit: visit),
            if (ref.watch(shortlistControllerProvider).isNotEmpty)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Inclure la shortlist'),
                subtitle: const Text(
                  'Étapes prévisionnelles, sans rendez-vous confirmé.',
                ),
                value: ref.watch(visitTourIncludeShortlistProvider),
                onChanged: (value) => ref
                    .read(visitTourIncludeShortlistProvider.notifier)
                    .setValue(value),
              ),
            const SizedBox(height: AppSpacing.md),
            const _PlanSection(),
          ],
        );
      },
    );
  }
}

class _VisitChoice extends ConsumerWidget {
  const _VisitChoice({required this.visit});

  final Visit visit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(visitTourSelectionProvider).contains(visit.id);
    return CheckboxListTile(
      contentPadding: EdgeInsets.zero,
      value: selected,
      onChanged: (_) =>
          ref.read(visitTourSelectionProvider.notifier).toggle(visit.id),
      title: Text(visit.listingTitle),
      subtitle: Text(
        '${VisitLabels.dateTime(visit.scheduledAt)} · ${VisitLabels.status(visit.status)}',
      ),
      secondary: StatusBadge(
        label: VisitLabels.status(visit.status),
        tone: VisitLabels.tone(visit.status),
      ),
    );
  }
}

class _PlanSection extends ConsumerWidget {
  const _PlanSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(visitTourSelectionProvider);
    final includeShortlist = ref.watch(visitTourIncludeShortlistProvider);
    if (selected.isEmpty && !includeShortlist) {
      return const Text(
        'Sélectionnez au moins une visite pour préparer la tournée.',
      );
    }
    final async = ref.watch(visitTourPlanProvider);
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement des positions'),
      error: (error, _) => AppErrorView(
        failure: error is AppFailure
            ? error
            : UnexpectedFailure(message: error.toString()),
        onRetry: () => ref.invalidate(visitTourPlanProvider),
      ),
      data: (plan) => _PlanBody(plan: plan),
    );
  }
}

class _PlanBody extends ConsumerWidget {
  const _PlanBody({required this.plan});

  final VisitTourPlan plan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (plan.mapped.isNotEmpty) ...[
          _TourMap(plan: plan),
          const SizedBox(height: AppSpacing.md),
        ],
        Text('Étapes', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.xs),
        for (var i = 0; i < plan.stops.length; i++)
          _StopCard(index: i + 1, stop: plan.stops[i]),
        if (plan.conflicts.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            'Conflits d\'horaires',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          for (final conflict in plan.conflicts)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text('• ${conflict.text}'),
            ),
        ],
        if (plan.legs.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            'Distances à vol d\'oiseau',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          for (final leg in plan.legs)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                '• ${leg.from.title} → ${leg.to.title} : '
                '${GeoSearch.formatNestDistance(leg.distanceKm)}',
              ),
            ),
        ],
        if (plan.gaps.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          for (final gap in plan.gaps) Text('• $gap'),
        ],
        if (plan.notes.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          for (final note in plan.notes)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Text(
                note,
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: AppColors.mutedForeground),
              ),
            ),
        ],
        const SizedBox(height: AppSpacing.md),
        AppButton(
          label: 'Ouvrir dans Maps',
          icon: Icons.directions_outlined,
          onPressed: plan.mapped.isNotEmpty
              ? () => _openTour(context, ref, plan)
              : null,
        ),
      ],
    );
  }

  Future<void> _openTour(
    BuildContext context,
    WidgetRef ref,
    VisitTourPlan plan,
  ) async {
    final points = [
      for (final stop in plan.mapped)
        (stop.listing!.location.latitude!, stop.listing!.location.longitude!),
    ];
    final uri = ExternalMaps.tour(points);
    if (uri == null) {
      return;
    }
    final opened = await ref.read(mapsLauncherProvider).open(uri);
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          opened
              ? 'Navigation ouverte dans une autre application. '
                    'Cela ne démarre pas un guidage dans Mon Appart.'
              : 'Aucune application de cartes n\'a pu être ouverte.',
        ),
      ),
    );
  }
}

class _StopCard extends ConsumerWidget {
  const _StopCard({required this.index, required this.stop});

  final int index;
  final TourStop stop;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Material(
        color: AppColors.card,
        shape: const RoundedRectangleBorder(
          borderRadius: AppRadii.card,
          side: BorderSide(color: AppColors.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('$index. ${stop.title}', style: theme.textTheme.titleSmall),
              if (stop.visit != null)
                Text(
                  '${VisitLabels.dateTime(stop.visit!.scheduledAt)} · ${VisitLabels.status(stop.visit!.status)}',
                )
              else
                const Text(
                  'Étape prévisionnelle (shortlist), sans rendez-vous.',
                ),
              Text(_locationCaption(stop), style: theme.textTheme.bodySmall),
              Wrap(
                spacing: AppSpacing.xs,
                children: [
                  TextButton(
                    onPressed: () =>
                        context.push(AppRoutes.listing(stop.listingId)),
                    child: const Text('Fiche'),
                  ),
                  if (stop.visit != null)
                    TextButton(
                      onPressed: () =>
                          context.push(AppRoutes.appointment(stop.visit!.id)),
                      child: const Text('Visite'),
                    ),
                  if (stop.hasMapPoint)
                    TextButton(
                      onPressed: () => _openStop(context, ref, stop),
                      child: const Text('Maps'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _locationCaption(TourStop stop) {
    return switch (stop.load) {
      TourStopLoad.unavailable => 'Annonce plus disponible',
      TourStopLoad.failed =>
        stop.errorMessage ?? 'Position impossible à charger',
      TourStopLoad.missingCoords =>
        stop.listing?.location.label ?? 'Localisation non renseignée',
      TourStopLoad.loaded =>
        stop.isApproximate
            ? '${stop.listing!.location.label} · position approximative'
            : stop.listing!.location.isExact
            ? '${stop.listing!.location.label} · position indiquée par l\'annonce'
            : stop.listing!.location.label,
    };
  }

  Future<void> _openStop(
    BuildContext context,
    WidgetRef ref,
    TourStop stop,
  ) async {
    final location = stop.listing!.location;
    final uri = ExternalMaps.destination(
      latitude: location.latitude!,
      longitude: location.longitude!,
    );
    if (uri == null) {
      return;
    }
    final opened = await ref.read(mapsLauncherProvider).open(uri);
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          opened
              ? 'Destination ouverte dans une autre application.'
              : 'Aucune application de cartes n\'a pu être ouverte.',
        ),
      ),
    );
  }
}

class _TourMap extends ConsumerWidget {
  const _TourMap({required this.plan});

  final VisitTourPlan plan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tilesEnabled = ref.watch(mapTilesEnabledProvider);
    final config = ref.watch(appConfigProvider);
    final mapped = plan.mapped;
    final first = mapped.first.listing!.location;
    return SizedBox(
      height: 220,
      child: ClipRRect(
        borderRadius: AppRadii.card,
        child: FlutterMap(
          options: MapOptions(
            initialCenter: LatLng(first.latitude!, first.longitude!),
            initialZoom: GeoSearch.defaultZoom,
            minZoom: GeoSearch.minZoom,
            maxZoom: GeoSearch.maxZoom,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
          ),
          children: [
            if (tilesEnabled)
              TileLayer(
                urlTemplate: config.resolvedMapTileUrl,
                userAgentPackageName: 'ci.monappart.mon_appart',
              ),
            if (mapped.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: [
                      for (final stop in mapped)
                        LatLng(
                          stop.listing!.location.latitude!,
                          stop.listing!.location.longitude!,
                        ),
                    ],
                    color: AppColors.primary,
                    strokeWidth: 2,
                  ),
                ],
              ),
            MarkerLayer(
              markers: [
                for (var i = 0; i < mapped.length; i++)
                  Marker(
                    point: LatLng(
                      mapped[i].listing!.location.latitude!,
                      mapped[i].listing!.location.longitude!,
                    ),
                    width: 32,
                    height: 32,
                    child: CircleAvatar(
                      backgroundColor: AppColors.primary,
                      child: Text(
                        '${i + 1}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
