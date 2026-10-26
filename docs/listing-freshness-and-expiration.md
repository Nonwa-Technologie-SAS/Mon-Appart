# Fraîcheur, reconfirmation et expiration des annonces

**Date :** 2026-10-22

---

## 1. Capacités produit

| Mécanisme                                        | État                                                          |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `Listing.expiresAt` + index expiry               | Code présent                                                  |
| Statuts EXPIRED, PAUSED, SUSPENDED, RENTED, SOLD | Enums + transitions                                           |
| Job d’expiration automatique                     | `ListingExpiryRunner` (SKIP LOCKED, outbox `listing.expired`) |
| Rappels notif reconfirmation                     | Dépend providers notifications                                |
| Badge « fraîchement vérifié »                    | Ne pas afficher sans confirmation récente                     |

---

## 2. Règles ops proposées (pilote location LD)

| Signal                                     | Action                              |
| ------------------------------------------ | ----------------------------------- |
| Annonceur ne répond pas 2 contacts 48–72 h | Demande confirmation ; sinon PAUSED |
| Bien plus dispo                            | RENTED / SOLD / ARCHIVED selon cas  |
| Prix incohérent / photos douteuses         | PENDING_REVIEW ou SUSPENDED         |
| Doublon quasi identique                    | Fusion / rejet                      |
| Signalements répétés                       | Escalade Trust                      |
| Compte suspect                             | Suspension compte + listings        |

Cadence reconfirmation location LD (hypothèse) : **14–30 jours** selon vélocité zone — à calibrer.  
Vente : cadence plus longue possible.  
Courte durée : plus fréquente si activée plus tard.

Une annonce non reconfirmée **ne doit pas** être présentée comme « fraîchement vérifiée ».

---

## 3. Rappels

1. J-3 avant `expiresAt` (si notif OK)
2. À l’échéance → EXPIRED ou job
3. Relance SupplyLead si partenaire inactif → `CHURN_RISK`
