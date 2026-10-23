# Playbook d’acquisition de la demande

**Statut :** préparé · **Aucune campagne payante déployée** · **Date :** 2026-10-22  
Réutilise : [acquisition-channels.md](./acquisition-channels.md), [seo-performance-organic-growth.md](./seo-performance-organic-growth.md), [growth-events-and-attribution.md](./growth-events-and-attribution.md).

---

## 1. Objectif

Attirer des personnes avec une **intention immobilière réelle** dans les zones où l’offre est déjà pertinente — pas maximiser le trafic vide.

Funnel cible :  
`Visite → Recherche → Fiche → Pertinence OK → Contact → Réponse annonceur → Visite / suite`

---

## 2. Canaux organiques

| Canal                                 | Pertinence       | Prérequis                         | Action                                           |
| ------------------------------------- | ---------------- | --------------------------------- | ------------------------------------------------ |
| SEO pages catégorie × localisation    | Haute long terme | Offre réelle zone                 | Réutiliser SEO existant ; **pas de pages vides** |
| Fiches biens partageables             | Haute            | URLs + OG tags                    | Encourager partage propriétaire                  |
| Contenus pratiques (guides location)  | Moyenne          | Temps rédaction                   | 2–4 guides utiles post-pilote                    |
| Alertes nouveaux biens                | Haute rétention  | Notifications réelles configurées | **Bloqué** si providers absents                  |
| Reco / assistant                      | Différenciation  | Flags + qualité                   | Pilote seulement                                 |
| Bouche-à-oreille / parrainage         | Haute            | Règles anti-abus                  | Après preuve valeur                              |
| Partenaires (agences → leurs clients) | Moyenne          | Accords                           | Co-marketing prudent                             |

---

## 3. Canaux payants (évaluation — non lancés)

| Canal           | Segment                               | Intention    | Message type      | Landing                | Conversion             | Budget pilote                            | Succès                          | Stop                                 |
| --------------- | ------------------------------------- | ------------ | ----------------- | ---------------------- | ---------------------- | ---------------------------------------- | ------------------------------- | ------------------------------------ |
| Meta (FB/IG)    | Locataires 22–45 Abidjan              | Location LD  | Budget + quartier | Search préfiltrée zone | Contact ou save search | **À approuver** (scénario intermédiaire) | CPA contact qualifié vs plafond | CPA &gt; plafond 7 j ou CTR trop bas |
| Google Search   | Requêtes « louer appartement Cocody » | Haute        | Annonce claire    | Fiche / search         | Contact                | **À approuver**                          | Même                            | Idem + Quality Score                 |
| TikTok / autres | —                                     | Faible–moyen | —                 | —                      | —                      | Non prioritaire J0                       | —                               | —                                    |

**Règle :** zéro dépense sans autorisation explicite. Coûts réels **inconnus** jusqu’à test.

---

## 4. Parcours de conversion — frictions connues / suspectées

| Étape     | Friction possible    | Amélioration mesurable     | Statut         |
| --------- | -------------------- | -------------------------- | -------------- |
| Visite    | Landing générique    | Landing zone + budget      | Recommandé     |
| Recherche | 0 résultat           | Seed supply d’abord        | Bloquant       |
| Fiche     | Infos incomplètes    | Checklist qualité          | Process        |
| Contact   | Auth / friction form | Simplifier champs          | À tester UX    |
| Réponse   | Annonceur silencieux | SLA + relance propriétaire | Ops            |
| Notif     | Pas d’e-mail réel    | Config providers           | Bloqué externe |

---

## 5. Growth loops (évaluation)

| Loop                         | Déclencheur             | Bénéfice user        | Parcours                 | Events à suivre               | Risque abus   | Coût ops         | Métrique             |
| ---------------------------- | ----------------------- | -------------------- | ------------------------ | ----------------------------- | ------------- | ---------------- | -------------------- |
| Partage annonce propriétaire | Publish / bouton share  | Plus de vues         | Share → visite → contact | share_clicked, visit, contact | Spam liens    | Faible           | Contacts / share     |
| Partage bien par demandeur   | « Envoyer à un proche » | Aide décision        | Share → visite           | idem                          | Faible        | Faible           | Visites referral     |
| Alerte nouveau bien          | Nouveau listing match   | Gain temps           | Notif → fiche → contact  | alert_sent, open, contact     | Fatigue notif | Config + contenu | Contact rate alertés |
| Parrainage agence            | Lead utile              | Nouveaux partenaires | Invite code              | partner_referred              | Gaming leads  | Modération       | Partenaires activés  |
| Favoris + retour             | Save                    | Suivi                | Favori → revisit         | favorite, session             | —             | Faible           | D7 return            |

Parrainage monétisé : uniquement avec règles, plafond, et modèle économique validé — **non lancé**.

---

## 6. Séquence recommandée

1. Supply seed zones pilotes.
2. Inviter demandeurs **fermés** (amis, communautés ciblées, listes waitlist).
3. Mesurer contact + réponse.
4. Contenu organique léger.
5. **Puis** demander budget pour micro-campagnes.

---

## 7. Interdits

- Spam WhatsApp non consenti.
- Import contacts non autorisé.
- Pub nationale avant densité locale.
- Promesses « trouvez en 24 h ».
