# Playbook prospection terrain — Mon Appart

**Statut :** prêt à l’emploi · **Exécution externe :** autorisation requise · **Date :** 2026-10-22  
Suivi : admin **Acquisition offre** (`SupplyLead`) ou sheet temporaire si offline.

---

## Étape 1 — Identification (légale)

Sources autorisées : site web de l’agence, cartes de visite remises, intros, annuaires publics avec usage conforme, événements, recommandations partenaires **existants** (aucun inventé).

**Interdit :** scraping massif, contournement login concurrents, achat de fichiers douteux, spam.

Créer un `SupplyLead` stage `IDENTIFIED` / `TO_CONTACT` avec zone + segment.

---

## Étape 2 — Qualification (grille)

| Champ               | Valeur / à vérifier         |
| ------------------- | --------------------------- |
| Type (segment)      | OWNER / SMALL_AGENCY / …    |
| Zone d’activité     | Codes communes              |
| Catégories biens    | Location LD, vente…         |
| Nb annonces approx. | Nombre ou « à vérifier »    |
| Fréquence MAJ       |                             |
| Outils actuels      | WhatsApp, portail X…        |
| Difficultés         | Leads non qualifiés, temps… |
| Décideur            | Nom / rôle                  |
| Intérêt             | 1–5 ou texte                |
| Next action         | Date + action               |

---

## Étape 3 — Scripts

### Appel (3 min)

1. Salutation + permission (« 2 minutes ? »).
2. Contexte : Mon Appart aide à publier clairement budget/quartier à [zone].
3. Bénéfice : accompagnement publication, contacts plus ciblés — **sans volume garanti**.
4. Qualif : biens dispo maintenant ? photos ?
5. Close : RDV démo 10 min ou WhatsApp guide.

### WhatsApp

> Bonjour [Prénom], je suis [Nom] de Mon Appart. On aide les [propriétaires/agences] à publier des annonces claires (budget, quartier) pour [Cocody/Marcory]. Seriez-vous disponible 10 minutes pour une démo sans engagement ?

### E-mail

Objet : Publier vos biens à [quartier] sur Mon Appart (pilote)  
Corps : 5 lignes — qui / quoi / zones / sans engagement / CTA créneau.

### Visite

Carte + téléphone + checklist démo + fiche visite (voir [supply-operations-checklist.md](./supply-operations-checklist.md)).

### Relance post-démo (J+2)

Rappeler le prochain pas concret (créer compte / première annonce) ; 1 seul CTA.

### Relance inscription incomplète

> Votre compte est créé ; il reste [photos / prix / localisation]. On peut finaliser ensemble en 15 min.

---

## Étape 4 — Démo 5–10 min (fonctionnalités réelles seulement)

1. Mon Appart en une phrase.
2. Recherche d’un bien (staging avec annonces seed **si** disponibles).
3. Fiche annonce.
4. Confiance : badges / vérif **tels qu’implémentés** — expliquer les limites.
5. Publication espace OWNER/AGENCY.
6. Outils utiles : gestion annonces, demandes (si visibles).
7. Next step daté + journaliser interaction `DEMO` sur le lead.

**Ne pas présenter :** paiements live, estimation m² type concurrent, import auto non appliqué, IA magique.

---

## Étape 5 — Pipeline

```
IDENTIFIED → TO_CONTACT → CONTACTED → QUALIFIED → DEMO
→ REGISTERED → LISTINGS_SUBMITTED → VERIFICATION
→ FIRST_PUBLISHED → ACTIVATED → NURTURE
(REFUSED / CHURN_RISK)
```

**ACTIVATED** exige ≥1 annonce active renseignée sur le lead (contrôle API).

Mapping Partner : après accord, lier `partnerPublicId` ; statut commercial Partner reste PROSPECT/ACTIVE (registre technique).
