import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/section_header.dart';
import '../domain/help_catalog.dart';
import '../domain/support_channels.dart';
import 'support_providers.dart';

class HelpScreen extends ConsumerStatefulWidget {
  const HelpScreen({super.key});

  @override
  ConsumerState<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends ConsumerState<HelpScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final config = ref.watch(appConfigProvider);
    final results = HelpCatalog.search(_query);
    final filtering = _query.trim().length >= 2;
    final body = Theme.of(context).textTheme.bodyMedium;
    return Scaffold(
      appBar: AppBar(title: const Text('Centre d\'aide')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          TextField(
            decoration: const InputDecoration(
              labelText: 'Rechercher une question',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) => setState(() => _query = value),
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Contacter'),
          Text(
            'Aucun conseiller n\'est indiqué comme disponible. '
            'L\'assistant de recherche ne traite pas les dossiers.',
            style: body,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Mes signalements',
            variant: AppButtonVariant.outline,
            onPressed: () => context.push(AppRoutes.myReports),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Assistant de recherche',
            variant: AppButtonVariant.outline,
            onPressed: () => context.push(AppRoutes.assistant),
          ),
          const SizedBox(height: AppSpacing.sm),
          _ChannelButtons(
            phone: SupportChannels.phoneUri(config.supportPhone),
            whatsapp: SupportChannels.whatsappUri(config.supportWhatsapp),
            onOpen: (uri) async {
              final opened = await ref.read(supportLauncherProvider).open(uri);
              if (!opened && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Ce canal n\'a pas pu être ouvert. Le signalement dans l\'application reste disponible.',
                    ),
                  ),
                );
              }
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          if (filtering && results.isEmpty)
            const AppEmptyState(
              compact: true,
              title: 'Aucun article',
              message:
                  'Aucun texte du centre d\'aide ne correspond. '
                  'Vous pouvez déposer un signalement si le sujet concerne une annonce ou une conversation.',
            )
          else
            for (final category in HelpCatalog.categories)
              if (results.any((article) => article.category == category)) ...[
                SectionHeader(title: category),
                for (final article in results)
                  if (article.category == category)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(article.title),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () =>
                          context.push(AppRoutes.helpArticle(article.id)),
                    ),
              ],
        ],
      ),
    );
  }
}

class _ChannelButtons extends StatelessWidget {
  const _ChannelButtons({
    required this.phone,
    required this.whatsapp,
    required this.onOpen,
  });

  final Uri? phone;
  final Uri? whatsapp;
  final Future<void> Function(Uri uri) onOpen;

  @override
  Widget build(BuildContext context) {
    if (phone == null && whatsapp == null) {
      return Text(
        'Aucun numéro de téléphone ni de WhatsApp n\'est configuré. '
        'Aucun numéro de remplacement n\'est proposé.',
        style: Theme.of(context).textTheme.bodyMedium,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Un appel ou un WhatsApp n\'est pas recopié dans Mes signalements.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        if (phone != null) ...[
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Appeler le support',
            variant: AppButtonVariant.outline,
            onPressed: () => onOpen(phone!),
          ),
        ],
        if (whatsapp != null) ...[
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Écrire sur WhatsApp',
            variant: AppButtonVariant.outline,
            onPressed: () => onOpen(whatsapp!),
          ),
        ],
      ],
    );
  }
}
