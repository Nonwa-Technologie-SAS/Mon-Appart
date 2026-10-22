# Expérimentation et A/B testing

Réutilise [growth-experimentation.md](./growth-experimentation.md) (protocole déjà défini).

## Position

**Pas de framework A/B productisé** tant que le volume consentant est insuffisant. Préférer :

- Tests utilisateurs / qualitative
- Eval hors ligne (reco, assistant)
- Comparaisons avant/après avec baseline analytics

## Quand un A/B a du sens

- Trafic suffisant + consentement
- Une hypothèse + une métrique principale + garde-fous
- Pas de chevauchement d’expériences

## Intégration technique future

- Flags (`FF_*`) pour variantes UI
- Events analytics existants (tracker web / Nest)
- Pas de second outil analytics

## Interdits

- Déclarer un gagnant sans N minimal
- Optimiser les clics au détriment de la qualité des contacts
- Inventer des résultats dans la doc
