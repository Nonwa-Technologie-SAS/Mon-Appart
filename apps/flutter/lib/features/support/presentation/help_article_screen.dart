import 'package:flutter/material.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../domain/help_catalog.dart';

class HelpArticleScreen extends StatelessWidget {
  const HelpArticleScreen({super.key, required this.articleId});

  final String articleId;

  @override
  Widget build(BuildContext context) {
    final article = HelpCatalog.byId(articleId);
    return Scaffold(
      appBar: AppBar(title: Text(article?.title ?? 'Article')),
      body: article == null
          ? const AppEmptyState(
              title: 'Article introuvable',
              message: 'Ce texte ne fait pas partie du centre d\'aide.',
            )
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Text(
                  article.category,
                  style: Theme.of(context).textTheme.labelLarge,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  article.body,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ],
            ),
    );
  }
}
