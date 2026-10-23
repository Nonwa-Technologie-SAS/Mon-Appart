# CRM immobilier intégré

**Statut :** opérationnel sur Inquiry + Appointment + Conversation existants.  
**Ce n’est pas un second CRM.** Le CRM d’acquisition d’annonceurs (`SupplyLead`) reste distinct.

## Objets

| Objet                | Table                | Rôle                                                                     |
| -------------------- | -------------------- | ------------------------------------------------------------------------ |
| Demande / lead       | `inquiries`          | Contact ou visite reçu sur une annonce. Pipeline `stage`.                |
| Conversation         | `conversations`      | Échanges visibles des deux parties.                                      |
| Note interne         | `inquiry_notes`      | Visible uniquement des gestionnaires courants du bien.                   |
| Visite               | `appointments`       | Demande, proposition, confirmation. Jamais auto-confirmée.               |
| Conversion analytics | événements existants | `listing_contact_submitted`, `appointment_*`, `qualified_lead_recorded`. |

Une inscription, un favori ou une vue d’annonce **n’est pas** un lead.

## Accès

Côté annonce : `property_ownerships.is_current = true` pour l’appelant.  
Le prospect n’accède ni à `/inquiries` ni aux notes. Un identifiant connu d’une demande d’autrui renvoie 404.

## Interfaces

- Tableau de bord : `/espace`
- Boîte de réception : `/espace/demandes`
- Fiche lead : `/espace/demandes/[id]`
- Visites : `/espace/visites`
- Contact prospect : fiche annonce (message + demande de visite)

## Non livré

- Agenda de disponibilités en temps réel (créneaux publiés).
- Interface messagerie globale hors fiche lead.
- Attribution d’équipe multi-agences au-delà des gestionnaires courants du bien.
- SMS / WhatsApp payants (canaux existants seulement s’ils sont configurés).
