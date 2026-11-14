# Sécurité mobile — Mon Appart

Ce document décrit l’audit du client Flutter (`apps/flutter`, Flutter 3.47.8, Dart 3.13.7) et les protections réellement présentes après le lot 19. Ce n’est pas un test d’intrusion, ni une certification de conformité.

Le backend Nest reste l’autorité pour l’authentification, les autorisations, la validation des fichiers et les quotas. Une modification Flutter ne corrige pas une faille serveur.

## Architecture réutilisée

| Sujet         | Mécanisme déjà en place                                                                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jetons        | `SecureSessionStore` via `flutter_secure_storage` 11.2.0. Android : stockage chiffré du plugin. iOS : Keychain `first_unlock_this_device`, non synchronisé (valeur par défaut du plugin).                            |
| Session       | Refresh uniquement sur `TOKEN_EXPIRED`. Un seul refresh en vol. 401 `TOKEN_INVALID`, `SESSION_REVOKED` ou `UNAUTHENTICATED` efface le trousseau. Les POST messagerie, visites, biens et uploads ne sont pas rejoués. |
| Mots de passe | Jamais stockés. Les journaux masquent `password`, `token`, `code`, `otp`, `Authorization`.                                                                                                                           |
| Production    | `API_BASE_URL` HTTPS obligatoire. Les logs réseau sont forcés à off.                                                                                                                                                 |
| Comptes       | `logout` et `logout-all` appellent Nest puis effacent la session locale même si le réseau échoue.                                                                                                                    |
| Fichiers      | Les photos d’annonce sont refusées côté client si le type réel n’est pas JPEG, PNG, WebP ou AVIF, ou si elles dépassent 15 Mo. Nest reste l’autorité.                                                                |
| Conversations | Pas de copie disque. L’accès à un fil exige un UUID et un `GET` autorisé par Nest.                                                                                                                                   |
| Énumération   | L’écran « mot de passe oublié » affiche le même texte que le compte existe ou non. Le serveur doit conserver cette neutralité.                                                                                       |

## Menaces retenues

| Risque                                 | Gravité                   | Scénario                                                                                                                                    | Protection avant ce lot                                                             | Mesure                                                                                                                                                                                                                      | Responsable                                        |
| -------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Extraction du cache hors ligne         | Élevé                     | Le JSON `offline-cache.json` contient le profil, les favoris, les visites et les préférences. La sauvegarde Android est activée par défaut. | Jetons hors de ce fichier. Purge partielle à la déconnexion.                        | Sauvegarde et transfert Android exclus. E-mail et téléphone retirés du disque. Purge du compte à la déconnexion, à la révocation et au changement de compte.                                                                | Mobile                                             |
| Jeton de reset volé via `monappart://` | Élevé                     | Une autre application peut enregistrer le même schéma et recevoir `?token=`.                                                                | Les jetons d’accès dans l’URL sont rejetés. Le reset HTTPS allowlisté est conservé. | Le schéma applicatif et le HTTP ouvrent l’écran sans le jeton. Seul un lien HTTPS d’un hôte autorisé le conserve.                                                                                                           | Mobile                                             |
| Session d’un compte précédent          | Élevé                     | Après un 401 ou une connexion d’un autre compte, `user/<id>/` restait sur le disque.                                                        | `clearUser` seulement si l’identifiant était connu au moment du logout.             | Le profil en cache est effacé dès qu’il n’y a plus de jeton, et l’ancien compte est effacé après une connexion réussie d’un autre identifiant.                                                                              | Mobile                                             |
| Aperçu des écrans sensibles            | Moyen                     | Le sélecteur d’applications peut montrer un mot de passe, un OTP ou une conversation.                                                       | Aucun masquage.                                                                     | Android : `FLAG_SECURE` tant qu’un écran sensible est ouvert. Android et iOS : voile opaque quand l’application quitte le premier plan.                                                                                     | Mobile                                             |
| HTTP en production                     | Moyen                     | Une URL ou des tuiles en clair.                                                                                                             | API de production déjà en HTTPS.                                                    | Config réseau Android : clair interdit en release. Debug et profil : seulement `localhost`, `127.0.0.1`, `10.0.2.2`. Tuiles HTTP ignorées hors environnement local. Identifiants `user:motdepasse@` retirés de l’URL d’API. | Mobile                                             |
| Force brute de connexion               | Moyen                     | Tentatives répétées depuis l’appareil.                                                                                                      | Le serveur a un throttle (`AuthThrottle`).                                          | Le mobile émet un incident local `auth.repeated_failure` à partir de 5 échecs, sans identifiant. Il ne bloque pas le compte : seul Nest peut le faire.                                                                      | Backend pour le quota, mobile pour le signal       |
| Appareil déverrouillé volé             | Moyen                     | La session reste valide jusqu’à expiration ou révocation.                                                                                   | Refresh token en trousseau. Logout all côté Nest.                                   | Inchangé. Pas de blocage des appareils rootés : le signal n’est pas fiable et Nest ne vérifie pas d’attestation.                                                                                                            | Backend (révocation), processus (durée des jetons) |
| Rétro-ingénierie                       | Moyen                     | Le binaire Flutter est lisible.                                                                                                             | Aucun secret dans les `--dart-define`.                                              | Aucune obfuscation activée tant que les symboles ne sont pas archivés. L’obfuscation ne remplace pas l’absence de secret.                                                                                                   | Processus de release                               |
| Signature release debug                | Élevé pour la publication | `build.gradle.kts` signe encore la release avec la clé debug.                                                                               | Documenté, non changé.                                                              | Ne pas régénérer de clé ici. Play App Signing et un keystore hors dépôt sont requis avant publication.                                                                                                                      | Processus                                          |
| Push et contenu de message             | Moyen                     | Une notification OS pourrait afficher un message privé.                                                                                     | Pas de FCM/APNs dans l’application. L’inbox est in-app après authentification.      | Aucun texte de conversation n’est mis dans une notification locale, parce qu’il n’y en a pas. Le jour où le push existera, le payload OS devra rester générique.                                                            | Backend + mobile, plus tard                        |
| Pinning TLS                            | Faible en l’état          | Un proxy sur un appareil compromis peut lire le TLS s’il a installé une CA.                                                                 | HTTPS sans pinning.                                                                 | Pinning non activé : sans procédure de rotation et certificat de secours, il bloquerait les utilisateurs au renouvellement.                                                                                                 | Infra, plus tard                                   |
| Suppression de compte                  | Moyen, juridique          | L’utilisateur ne peut pas demander la suppression depuis l’app.                                                                             | L’écran le dit. Aucune purge locale simulée.                                        | Inchangé. Il faut un endpoint Identity réel, puis seulement une confirmation.                                                                                                                                               | Backend + validation juridique                     |

## Données locales

| Catégorie          | Exemples                                               | Stockage                                                   |
| ------------------ | ------------------------------------------------------ | ---------------------------------------------------------- |
| Secret             | Access token, refresh token, jeton push                | Trousseau uniquement                                       |
| Personnel          | E-mail, téléphone                                      | Mémoire le temps de la session réseau. Pas le JSON disque. |
| Personnel résiduel | Prénom, nom, favoris, visites, préférences, recherches | JSON applicatif, purgé avec le compte                      |
| Public             | Fiches et accueil                                      | JSON applicatif, conservé                                  |
| Conversation       | Messages                                               | Mémoire seulement                                          |

Le fichier n’est pas chiffré. Le chiffrer avec un algorithme maison, sans bibliothèque déjà présente, n’a pas été retenu. Un vol d’appareil déverrouillé ou une extraction root peut encore lire le JSON. La sauvegarde cloud Android ne l’emporte plus.

## Écrans masqués

Connexion, inscription, mot de passe oublié, nouveau mot de passe, vérification OTP, changement de mot de passe, fil de conversation.

Le presse-papiers n’est pas rempli automatiquement. Les champs mot de passe et OTP désactivent l’apprentissage du clavier (`enableIMEPersonalizedLearning: false`).

## Android

`AndroidManifest.xml` principal :

- `allowBackup=false`
- règles `backup_rules.xml` et `data_extraction_rules.xml` qui excluent fichiers, bases, préférences et stockage externe
- `usesCleartextTraffic=false`
- `network_security_config.xml` sans trafic en clair

Les manifests debug et profil ne déclarent pas de composants exportés supplémentaires. Leur configuration réseau autorise le HTTP uniquement vers la boucle locale et l’hôte émulateur `10.0.2.2`.

`MainActivity` est exportée parce qu’elle est l’activité lanceur et le schéma `monappart`. Aucun receiver, service ou provider ajouté. `FLAG_SECURE` est posé par le canal `ci.monappart/screen_privacy`.

La signature release debug n’a pas été remplacée.

## iOS

`NSAllowsLocalNetworking` reste activé pour le développement sur le réseau local. Il n’autorise pas le HTTP arbitraire vers Internet : il n’y a pas de `NSAllowsArbitraryLoads`.

Les textes de permission caméra, photos, localisation « en cours d’utilisation » et notifications correspondent aux fonctions réelles. Pas de localisation en arrière-plan, pas de microphone, pas de contacts.

Le voile d’arrière-plan est dessiné par Flutter. Il n’y a pas de flou natif supplémentaire dans `AppDelegate` : ce voile n’a pas été vérifié sur un appareil iOS (pas de compilation iOS sur cette machine).

Aucun entitlement Associated Domains : les Universal Links ne sont pas configurés.

## Observabilité

Les échecs de connexion répétés produisent un incident local `auth.repeated_failure` (gravité haute, compteur seulement). Les incidents sont effacés à la déconnexion et au changement de compte. Ils ne partent pas vers un serveur : aucun DSN n’est configuré. Les règles de masquage du lot 18 restent en vigueur.

## Ce qui n’est pas fait

- Pas de Play Integrity, App Attest ou DeviceCheck. Nest ne vérifie pas ces attestations. La décision de confiance ne doit pas vivre seulement dans Flutter.
- Pas de détection root ou jailbreak, et pas de blocage de ces appareils.
- Pas d’obfuscation Dart dans la CI. Commande de release, quand les symboles seront archivés hors du dépôt : `flutter build appbundle --obfuscate --split-debug-info=<répertoire hors git>`.
- Pas de pinning.
- Pas de nouvelle dépendance.
- Pas de conformité déclarée à la loi n° 2013-450, aux règles Play Data safety ni à Apple Privacy Nutrition Labels. Un juriste doit valider la politique de confidentialité, les durées de conservation, les sous-traitants et le droit de suppression avant publication.
- La compilation iOS et un APK release signé n’ont pas été produits ici.

## Diagnostiquer un incident de session

1. Demander la version (`1.0.0+1` aujourd’hui) et la plateforme, pas le mot de passe ni le jeton.
2. Vérifier si l’écran était connexion, conversation ou un autre écran masqué.
3. Côté Nest, chercher `request_id` (en-tête `X-Request-ID`) dans les logs Pino. Le mobile ne journalise pas le corps.
4. Un 401 `TOKEN_EXPIRED` doit renouveler une fois. Un 401 de révocation doit ramener à l’écran déconnecté et vider le cache privé.
5. Cinq échecs de mot de passe produisent un incident local, pas un blocage. Le quota réel est `AuthThrottle` côté API.

## Plan restant

| Priorité | Risque                         | Action                                                                                       | Responsable          |
| -------- | ------------------------------ | -------------------------------------------------------------------------------------------- | -------------------- |
| P0       | Signature release debug        | Keystore hors dépôt et Play App Signing avant tout envoi Play                                | Processus            |
| P0       | Durée et rotation des jetons   | Vérifier en production la rotation du refresh et la révocation à la réutilisation            | Backend              |
| P1       | Suppression de compte          | Endpoint réel, puis bouton qui n’affiche un succès qu’après la réponse Nest                  | Backend, puis mobile |
| P1       | Politique de confidentialité   | URL publique, durées, sous-traitants, contact données personnelles                           | Juridique            |
| P1       | App Links / Universal Links    | Domaine vérifié avant de transporter un jeton de reset en HTTPS                              | Infra + mobile       |
| P2       | Chiffrement du JSON hors ligne | Bibliothèque maintenue et clé en trousseau, si le résidu prénom/visites devient inacceptable | Mobile               |
| P2       | Push                           | Payload OS générique, détail chargé après ouverture authentifiée                             | Backend + mobile     |
| P2       | Obfuscation                    | Activer `--obfuscate` seulement avec archivage des symboles                                  | Processus            |
| P3       | Pinning                        | Deux certificats et une procédure de rotation, sinon ne pas l’activer                        | Infra                |
| P3       | Play Integrity / App Attest    | Uniquement le jour où Nest vérifie l’attestation                                             | Backend + mobile     |
