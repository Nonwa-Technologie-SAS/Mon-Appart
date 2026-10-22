# Protocole d’expérimentation

## Principe

Pas de framework A/B productisé tant que le volume consentant est insuffisant. Préférer analyses de parcours, tests d’utilisabilité et comparaisons hors ligne. Voir aussi [recommendation-evaluation.md](./recommendation-evaluation.md).

## Fiche d’expérience (obligatoire)

1. Problème observé (avec métrique baseline).
2. Hypothèse.
3. Population (rôle, appareil, zone).
4. Contrôle / variante.
5. Métrique principale (ex. taux contact soumis / vue détail).
6. Garde-fous (signalements, erreurs, spam contacts, temps de réponse).
7. Durée ou N minimal.
8. Conditions d’arrêt.
9. Résultat + limites (pas de « gagnant » sans données).

## Exemples adaptés au volume actuel

- Reformulation CTA visite (mesure `listing_contact_started` → soumissions).
- Ordre des actions empty-state.
- Présence du bloc confiance anti-arnaque près du CTA.

## Interdits

- Expériences qui se chevauchent sans plan.
- Variante qui augmente les clics en dégradant la qualité des contacts.
- Déclaration de significativité statistique sans taille d’échantillon.
