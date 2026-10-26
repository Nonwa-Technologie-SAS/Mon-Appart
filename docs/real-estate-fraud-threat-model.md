# Modèle de menaces immobilières

Estimations **qualitatives** (probabilité / impact) pour prioriser les contrôles. Ce ne sont **pas** des statistiques de fraude sur le marché ivoirien.

Légende : P = probabilité perçue avec les données actuelles de la plateforme ; I = impact utilisateur ; signaux = observables déjà disponibles.

## 3.1 Annonces

| Scénario                                | P   | I   | Signaux observables                                                     | Contrôle                                 |
| --------------------------------------- | --- | --- | ----------------------------------------------------------------------- | ---------------------------------------- |
| Logement ou terrain inexistant          | M   | H   | Signalements `MISLEADING_INFORMATION`, incohérences, photos réutilisées | Revue humaine, `LISTING_CONSISTENCY`     |
| Photos volées / réutilisées hors agence | M   | H   | SHA-256 Media `DUPLICATE_MEDIA_CROSS_ACCOUNT`                           | Alerte, pas de fusion auto               |
| Annonce sans mandat                     | M   | H   | `OWNER_AUTHORIZATION`, `RELATION_NOT_ESTABLISHED`                       | Vérification, pas de publication forcée  |
| Bien déjà loué / vendu encore affiché   | H   | M   | `PROPERTY_NOT_AVAILABLE`, statuts RENTED/SOLD                           | Signalement + workflow Listing           |
| Faux prix d’appel                       | M   | M   | `PRICE_CHANGE_ANOMALY`, `INCORRECT_PRICE`                               | Revue ; pas de blocage sur un prix isolé |
| Doublons du même bien                   | H   | M   | `DUPLICATE_LISTING_SAME_PROPERTY`                                       | Distinguer agence légitime vs fraude     |
| Modification après vérification         | M   | H   | `MATERIAL_CHANGE_AFTER_VERIFICATION`                                    | Réévaluation, pas de révocation auto     |
| Usurpation d’agence / propriétaire      | F   | H   | `UNAUTHORIZED_LISTING`, documents dupliqués                             | Instruction TRUST_OFFICER                |

## 3.2 Contacts

| Scénario                                               | P   | I   | Signaux                                   | Contrôle                                     |
| ------------------------------------------------------ | --- | --- | ----------------------------------------- | -------------------------------------------- |
| Acompte / frais avant visite dans un contexte pressant | M   | H   | `PAYMENT_PRESSURE` (avertissement)        | Conseil utilisateur, signalement             |
| Phishing / OTP / mot de passe                          | F   | C   | `MESSAGE_CREDENTIAL_HARVEST`              | Alerte HIGH + banner, pas de blocage d’envoi |
| Faux support Mon Appart                                | F   | C   | `MESSAGE_FAKE_SUPPORT`                    | Idem                                         |
| Lien raccourci                                         | M   | M   | `PHISHING_LINK` (jamais une preuve seule) | Avertissement                                |
| Déport WhatsApp                                        | H   | F   | `OFF_PLATFORM` LOW                        | Conseil, pas d’interdiction                  |
| Faux intermédiaire                                     | M   | H   | Signalement conversation                  | Extrait borné au modérateur                  |

Un acompte, un numéro WhatsApp ou un lien externe **n’est pas** une fraude par défaut.

## 3.3 Abus de plateforme

| Scénario                    | P   | I   | Contrôle existant                             |
| --------------------------- | --- | --- | --------------------------------------------- |
| Création massive d’annonces | M   | M   | `ACCOUNT_BURST_ACTIVITY`                      |
| Spam de signalements        | M   | M   | Déduplication ouvert + quota quotidien        |
| Rate limit / énumération    | M   | H   | Throttle Nest, 404 uniforme                   |
| Téléversements malveillants | M   | H   | Magic bytes, taille, PDF, antivirus optionnel |
| Contournement de suspension | F   | H   | Identity statut + permissions relues          |

## 3.4 Risques internes

| Scénario                    | P   | I   | Contrôle                                            |
| --------------------------- | --- | --- | --------------------------------------------------- |
| Accès aux pièces d’identité | F   | C   | `verification:documents`, URL signée courte, audit  |
| Modification non traçable   | F   | H   | Historiques append-only                             |
| Export massif               | F   | C   | Pas d’export Trust grand public ; `user:pii` audité |
| Compte interne compromis    | F   | C   | Rôles, révocation de sessions, `admin:access` relu  |

C = critique, H = élevé, M = moyen, F = faible.

## Non-objectifs

- Ne pas contacter automatiquement les autorités ni les tiers.
- Ne pas entraîner un modèle ML sur des signalements non examinés.
- Ne pas qualifier un quartier ou un profil démographique de « risqué ».
