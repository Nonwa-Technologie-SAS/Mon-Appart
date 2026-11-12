import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';

void main() {
  test('sanitizeNext n\'accepte que des chemins internes', () {
    expect(AppRoutes.sanitizeNext('/listings/abc'), '/listings/abc');
    expect(AppRoutes.sanitizeNext('https://evil.example'), isNull);
    expect(AppRoutes.sanitizeNext('//evil.example'), isNull);
    expect(AppRoutes.sanitizeNext('/login'), '/login');
    expect(AppRoutes.sanitizeNext(null), isNull);
  });

  test('loginWithNext encode le retour', () {
    expect(
      AppRoutes.loginWithNext('/listings/abc'),
      '/login?next=${Uri.encodeQueryComponent('/listings/abc')}',
    );
    expect(AppRoutes.loginWithNext('https://evil.example'), AppRoutes.login);
  });

  test('savedSearch construit le chemin d\'édition', () {
    expect(
      AppRoutes.savedSearch('cccccccc-cccc-cccc-cccc-cccccccccccc'),
      '/account/saved-searches/cccccccc-cccc-cccc-cccc-cccccccccccc',
    );
  });

  test('proLead construit la fiche prospect', () {
    expect(
      AppRoutes.proLead('12121212-1212-1212-1212-121212121212'),
      '/pro/leads/12121212-1212-1212-1212-121212121212',
    );
  });

  test('loginWithNext accepte une conversation interne', () {
    const next = '/conversations/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    expect(AppRoutes.sanitizeNext(next), next);
    expect(AppRoutes.loginWithNext(next), contains('next='));
  });
}
