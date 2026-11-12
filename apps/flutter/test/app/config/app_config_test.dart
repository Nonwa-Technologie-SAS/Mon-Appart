import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/app_config.dart';
import 'package:mon_appart/app/config/app_environment.dart';

void main() {
  group('AppEnvironment.parse', () {
    test('accepte les alias documentés', () {
      expect(AppEnvironment.parse('local'), AppEnvironment.local);
      expect(AppEnvironment.parse('DEV'), AppEnvironment.local);
      expect(AppEnvironment.parse('recette'), AppEnvironment.staging);
      expect(AppEnvironment.parse('prod'), AppEnvironment.production);
    });

    test('rejette une valeur inconnue', () {
      expect(() => AppEnvironment.parse('qa'), throwsFormatException);
    });
  });

  group('AppConfig.parseApiBaseUrl', () {
    test('retourne null si vide', () {
      expect(
        AppConfig.parseApiBaseUrl('', environment: AppEnvironment.local),
        isNull,
      );
    });

    test('normalise une URL locale sans slash final superflue', () {
      final uri = AppConfig.parseApiBaseUrl(
        'http://10.0.2.2:4000/',
        environment: AppEnvironment.local,
      );
      expect(uri, Uri.parse('http://10.0.2.2:4000'));
    });

    test('refuse un schéma non HTTP', () {
      expect(
        () => AppConfig.parseApiBaseUrl(
          'ftp://example.com',
          environment: AppEnvironment.local,
        ),
        throwsFormatException,
      );
    });

    test('exige HTTPS en production', () {
      expect(
        () => AppConfig.parseApiBaseUrl(
          'http://api.example.com',
          environment: AppEnvironment.production,
        ),
        throwsFormatException,
      );
    });

    test('retire un identifiant embarqué dans l\'URL', () {
      final uri = AppConfig.parseApiBaseUrl(
        'https://user:secret@api.example.com/v1',
        environment: AppEnvironment.production,
      );
      expect(uri, Uri.parse('https://api.example.com/v1'));
      expect(uri?.userInfo, isEmpty);
    });

    test('accepte HTTPS en production', () {
      final uri = AppConfig.parseApiBaseUrl(
        'https://api.example.com/v1/',
        environment: AppEnvironment.production,
      );
      expect(uri, Uri.parse('https://api.example.com/v1'));
    });
  });

  group('AppConfig.parseBoolFlag', () {
    test('utilise la valeur par défaut si vide', () {
      expect(AppConfig.parseBoolFlag('', defaultValue: true), isTrue);
    });

    test('parse true/false', () {
      expect(AppConfig.parseBoolFlag('true', defaultValue: false), isTrue);
      expect(AppConfig.parseBoolFlag('0', defaultValue: true), isFalse);
    });

    test('rejette une valeur invalide', () {
      expect(
        () => AppConfig.parseBoolFlag('maybe', defaultValue: false),
        throwsFormatException,
      );
    });
  });

  group('AppConfig.parsePublicWebHost', () {
    test('retourne null si vide ou localhost', () {
      expect(AppConfig.parsePublicWebHost(''), isNull);
      expect(AppConfig.parsePublicWebHost('localhost'), isNull);
      expect(AppConfig.parsePublicWebHost('http://127.0.0.1:3000'), isNull);
    });

    test('extrait l\'hôte d\'une URL publique', () {
      expect(
        AppConfig.parsePublicWebHost('https://www.example.test/chemin'),
        'www.example.test',
      );
      expect(
        AppConfig.parsePublicWebHost('WWW.Example.TEST'),
        'www.example.test',
      );
    });
  });

  group('AppConfig.parseMapTileUrl', () {
    test('ignore un gabarit vide ou incomplet', () {
      expect(AppConfig.parseMapTileUrl(''), isNull);
      expect(
        AppConfig.parseMapTileUrl('https://tiles.example/z/x/y.png'),
        isNull,
      );
    });

    test('refuse le HTTP hors environnement local', () {
      expect(
        AppConfig.parseMapTileUrl(
          'http://tiles.example/{z}/{x}/{y}.png',
          environment: AppEnvironment.production,
        ),
        isNull,
      );
    });

    test('accepte un gabarit OSM ou fournisseur HTTPS', () {
      expect(
        AppConfig.parseMapTileUrl(
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        ),
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      );
    });
  });
}
