/// Articles du centre d'aide. Ils décrivent l'application telle qu'elle est.
///
/// Ils ne viennent pas d'un CMS : Nest n'expose pas de contenus d'aide.
class HelpArticle {
  const HelpArticle({
    required this.id,
    required this.category,
    required this.title,
    required this.body,
  });

  final String id;
  final String category;
  final String title;
  final String body;
}

abstract final class HelpCatalog {
  static const categories = <String>[
    'Compte',
    'Recherche',
    'Annonces',
    'Publication',
    'Messagerie et visites',
    'Paiements',
    'Sécurité',
  ];

  static const articles = <HelpArticle>[
    HelpArticle(
      id: 'compte-connexion',
      category: 'Compte',
      title: 'Créer un compte et se connecter',
      body:
          'La consultation des annonces reste possible sans compte. '
          'Le profil, les favoris, les préférences, la messagerie et les '
          'signalements demandent une session. Le mot de passe oublié suit '
          'le parcours déjà présent dans l\'écran de connexion.',
    ),
    HelpArticle(
      id: 'compte-suppression',
      category: 'Compte',
      title: 'Supprimer un compte',
      body:
          'L\'application ne propose pas encore de suppression de compte : '
          'aucun endpoint utilisateur ne le permet. L\'écran Confidentialité '
          'le précise. Ne confiez pas de mot de passe ni de code de '
          'vérification dans un message.',
    ),
    HelpArticle(
      id: 'recherche-filtres',
      category: 'Recherche',
      title: 'Rechercher et filtrer',
      body:
          'Explorer affiche les annonces publiées. Les filtres et les '
          'recherches enregistrées reprennent les contrats Nest déjà branchés. '
          'Une alerte n\'est créée que si l\'enregistrement aboutit.',
    ),
    HelpArticle(
      id: 'recherche-recommandations',
      category: 'Recherche',
      title: 'Recommandations',
      body:
          'Les recommandations viennent de l\'API. Si aucune n\'est '
          'disponible, l\'écran le dit. L\'application n\'invente pas de bien.',
    ),
    HelpArticle(
      id: 'annonces-fiche',
      category: 'Annonces',
      title: 'Lire une annonce et ses badges',
      body:
          'Le prix, le lieu et les photos viennent de la fiche publiée. '
          'Les badges de confiance décrivent un examen de pièces. Ils ne '
          'garantissent ni le titre de propriété ni la disponibilité du bien. '
          'Une position marquée approximative n\'est pas l\'adresse exacte.',
    ),
    HelpArticle(
      id: 'annonces-favoris',
      category: 'Annonces',
      title: 'Favoris',
      body:
          'Un favori est enregistré sur le compte connecté. Hors ligne, '
          'l\'ajout peut attendre dans la file locale, dans la limite déjà '
          'prévue. Un favori n\'est pas une réservation.',
    ),
    HelpArticle(
      id: 'annonces-signalement',
      category: 'Annonces',
      title: 'Signaler une annonce',
      body:
          'Depuis la fiche, « Signaler cette annonce » envoie un signalement '
          'à la modération (POST /trust/reports). Cela ne suspend pas '
          'l\'annonce et n\'accuse personne. Un seul signalement ouvert est '
          'accepté par cible, avec une limite quotidienne. Le statut visible '
          'est Ouvert, En examen ou Examiné : l\'issue détaillée n\'est pas '
          'renvoyée au déclarant.',
    ),
    HelpArticle(
      id: 'publication',
      category: 'Publication',
      title: 'Publier un bien',
      body:
          'L\'espace de publication et l\'espace professionnel réutilisent '
          'les parcours déjà livrés. Une annonce n\'est pas en ligne tant '
          'que son statut publié n\'est pas confirmé par le serveur.',
    ),
    HelpArticle(
      id: 'messagerie',
      category: 'Messagerie et visites',
      title: 'Contacter et demander une visite',
      body:
          'Contacter ouvre la messagerie interne. Signaler, dans une '
          'conversation, concerne un message ou l\'échange, pas un ticket '
          'général. Une demande de visite reste en attente tant que '
          'l\'annonceur ne l\'a pas confirmée. Les coordonnées personnelles '
          'de l\'annonceur ne sont pas affichées sur la fiche.',
    ),
    HelpArticle(
      id: 'assistant',
      category: 'Recherche',
      title: 'Assistant de recherche',
      body:
          'L\'assistant aide à trouver des annonces publiées. Il ne connaît '
          'pas le statut d\'un signalement, d\'une vérification, d\'un '
          'paiement ou d\'une décision de modération. Il ne se présente pas '
          'comme un conseiller humain.',
    ),
    HelpArticle(
      id: 'paiements',
      category: 'Paiements',
      title: 'Paiements et abonnements',
      body:
          'Cette application ne encaisse pas un loyer et n\'affiche pas de '
          'facture. Les abonnements de services de plateforme, s\'ils '
          'existent, sont gérés hors de cet écran. Aucun remboursement ne '
          'peut être promis ici.',
    ),
    HelpArticle(
      id: 'securite-arnaques',
      category: 'Sécurité',
      title: 'Avant une visite ou un paiement',
      body:
          'Visitez le bien et vérifiez les documents. Ne versez pas d\'argent '
          'sur la seule base d\'une annonce. Un signalement décrit des faits. '
          'La suspension d\'une annonce ou d\'un compte reste une décision '
          'de modération, pas un effet automatique du formulaire.',
    ),
    HelpArticle(
      id: 'canaux',
      category: 'Compte',
      title: 'Téléphone et WhatsApp',
      body:
          'Les boutons n\'apparaissent que si SUPPORT_PHONE ou '
          'SUPPORT_WHATSAPP est configuré au moment de la compilation. '
          'Sans numéro, aucun contact n\'est inventé. Un appel ou un message '
          'WhatsApp n\'est pas recopié dans Mes signalements : ce n\'est pas '
          'une intégration WhatsApp Business.',
    ),
  ];

  static HelpArticle? byId(String id) {
    for (final article in articles) {
      if (article.id == id) {
        return article;
      }
    }
    return null;
  }

  static List<HelpArticle> inCategory(String category) {
    return [
      for (final article in articles)
        if (article.category == category) article,
    ];
  }

  /// Recherche locale. Une requête vide ne filtre pas.
  static List<HelpArticle> search(String raw) {
    final tokens = _tokens(raw);
    if (tokens.isEmpty) {
      return articles;
    }
    final direct = _match(tokens);
    if (direct.isNotEmpty) {
      return direct;
    }
    final relaxed = [
      for (final token in tokens)
        token.length >= 5 ? token.substring(0, token.length - 1) : token,
    ];
    if (relaxed.join(' ') == tokens.join(' ')) {
      return const [];
    }
    return _match(relaxed);
  }

  static List<HelpArticle> _match(List<String> tokens) {
    return [
      for (final article in articles)
        if (tokens.every((token) => _haystack(article).contains(token)))
          article,
    ];
  }

  static List<String> _tokens(String raw) {
    return _fold(raw)
        .split(RegExp(r'\s+'))
        .where((token) => token.length >= 2)
        .toList(growable: false);
  }

  static String _haystack(HelpArticle article) {
    return _fold('${article.category} ${article.title} ${article.body}');
  }

  static String _fold(String value) {
    const from = 'àáâäãåèéêëìíîïòóôöõùúûüýÿçñœæ';
    const to = 'aaaaaaeeeeiiiiooooouuuuyycnoa';
    assert(from.length == to.length);
    final buffer = StringBuffer();
    for (final rune in value.toLowerCase().runes) {
      final char = String.fromCharCode(rune);
      final index = from.indexOf(char);
      buffer.write(index >= 0 ? to[index] : char);
    }
    return buffer.toString();
  }
}
