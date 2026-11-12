import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/app/router/deep_link_resolver.dart';
import 'package:mon_appart/features/notifications/domain/notification_destination.dart';

void main() {
  const listingId = '11111111-1111-1111-1111-111111111111';
  const savedId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const conversationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const appointmentId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  final resolver = DeepLinkResolver(allowedHttpsHosts: {'www.example.test'});

  test('schéma app vers fiche, recherche et inbox', () {
    expect(
      resolver.resolveToLocation(Uri.parse('monappart://listings/$listingId')),
      AppRoutes.listing(listingId),
    );
    expect(
      resolver.resolveToLocation(
        Uri.parse('monappart:///account/saved-searches/$savedId'),
      ),
      AppRoutes.savedSearch(savedId),
    );
    expect(
      resolver.resolveToLocation(
        Uri.parse('monappart://explore?commune=COCODY'),
      ),
      '/explore?commune=COCODY',
    );
    expect(
      resolver.resolveToLocation(Uri.parse('monappart://notifications')),
      AppRoutes.notifications,
    );
  });

  test('hôte HTTPS allowlist mappe les chemins web', () {
    expect(
      resolver.resolveToLocation(
        Uri.parse('https://www.example.test/biens/$listingId'),
      ),
      AppRoutes.listing(listingId),
    );
    expect(
      resolver.resolveToLocation(
        Uri.parse('https://www.example.test/recherche?commune=COCODY'),
      ),
      '/explore?commune=COCODY',
    );
    expect(
      resolver.resolveToLocation(Uri.parse('https://www.example.test/favoris')),
      AppRoutes.favorites,
    );
  });

  test('rejette les URL non autorisées et les identifiants invalides', () {
    expect(
      resolver.resolveToLocation(
        Uri.parse('https://evil.example/biens/$listingId'),
      ),
      isNull,
    );
    expect(
      resolver.redirect(Uri.parse('https://evil.example/biens/$listingId')),
      isNull,
    );
    expect(
      resolver.resolveToLocation(Uri.parse('monappart://listings/pas-un-uuid')),
      isNull,
    );
    expect(
      resolver.redirect(Uri.parse('monappart://listings/pas-un-uuid')),
      AppRoutes.invalidLink,
    );
    expect(
      resolver.resolveToLocation(Uri.parse('javascript:alert(1)')),
      isNull,
    );
  });

  test('rejette les jetons d\'accès dans la query', () {
    expect(
      resolver.resolveToLocation(
        Uri.parse('monappart://explore?access_token=secret'),
      ),
      isNull,
    );
    expect(
      resolver.resolveToLocation(
        Uri.parse('https://www.example.test/recherche?next=https://evil.test'),
      ),
      isNull,
    );
  });

  test('reset-password conserve le jeton de réinitialisation seulement', () {
    expect(
      resolver.resolveToLocation(
        Uri.parse('https://www.example.test/reset-password?token=abc'),
      ),
      '/reset-password?token=abc',
    );
    expect(
      resolver.resolveToLocation(Uri.parse('monappart://explore?token=abc')),
      isNull,
    );
  });

  test(
    'le schéma monappart ne transporte pas le jeton de réinitialisation',
    () {
      expect(
        resolver.resolveToLocation(
          Uri.parse('monappart://reset-password?token=abc'),
        ),
        '/reset-password',
      );
      expect(
        resolver.resolveToLocation(
          Uri.parse('http://www.example.test/reset-password?token=abc'),
        ),
        '/reset-password',
      );
    },
  );

  test('conversation et visite exigent un UUID', () {
    expect(
      resolver.resolveToLocation(
        Uri.parse('monappart://conversations/$conversationId'),
      ),
      AppRoutes.conversation(conversationId),
    );
    expect(
      resolver.resolveToLocation(
        Uri.parse('monappart://appointments/$appointmentId'),
      ),
      AppRoutes.appointment(appointmentId),
    );
  });

  test('locationFor ignore les destinations inconnues', () {
    expect(resolver.locationFor(NotificationDestination.unknown()), isNull);
    expect(
      resolver.locationFor(NotificationDestination.listing(listingId)),
      AppRoutes.listing(listingId),
    );
  });

  test('URL publique de fiche uniquement avec hôte et UUID', () {
    expect(
      DeepLinkResolver.publicListingUrl(
        host: 'www.example.test',
        listingId: listingId,
      ),
      'https://www.example.test/biens/$listingId',
    );
    expect(
      DeepLinkResolver.publicListingUrl(host: null, listingId: listingId),
      isNull,
    );
    expect(
      DeepLinkResolver.publicListingUrl(
        host: 'www.example.test',
        listingId: 'x',
      ),
      isNull,
    );
  });

  test('localhost n\'est pas un lien externe', () {
    expect(
      resolver.redirect(Uri.parse('http://localhost/listings/$listingId')),
      isNull,
    );
  });
}
