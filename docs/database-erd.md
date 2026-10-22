# Diagramme entité-association

Modèle physique v1. Les colonnes `created_at`, `updated_at` et `deleted_at` sont omises sauf quand elles portent une règle. Détails et contraintes : [database.md](./database.md).

## Vue d'ensemble

```mermaid
erDiagram
    users ||--o{ user_roles : "a"
    users ||--o{ auth_sessions : "se connecte"
    roles ||--o{ user_roles : "attribué"
    roles ||--o{ role_permissions : "accorde"
    permissions ||--o{ role_permissions : "incluse"

    countries ||--o{ districts : "contient"
    districts ||--o{ cities : "contient"
    cities ||--o{ communes : "contient"
    communes ||--o{ neighborhoods : "contient"

    property_types ||--o{ properties : "type"
    neighborhoods ||--o{ properties : "situe"
    properties ||--o{ property_ownerships : "historique"
    users ||--o{ property_ownerships : "possède"
    properties ||--o{ property_amenities : "équipé"
    amenities ||--o{ property_amenities : "équipe"

    properties ||--o{ listings : "proposé par"
    users ||--o{ listings : "publie"
    listings ||--o{ listing_prices : "prix"
    listings ||--o{ listing_status_history : "statuts"

    properties ||--o{ media : "illustré"

    users ||--o{ favorites : "aime"
    properties ||--o{ favorites : "aimé"
    properties ||--o{ property_views : "vu"
    listings ||--o{ inquiries : "concerne"
    listings ||--o{ appointments : "concerne"
    users ||--o{ inquiries : "envoie / reçoit"
    users ||--o{ appointments : "demande / reçoit"

    users ||--o{ searches : "cherche"

    users ||--o| user_preferences : "déclare"
    users ||--o| user_behavior_profiles : "profil déduit"
    users ||--o{ recommendations : "reçoit"
    properties ||--o{ recommendations : "recommandé"

    users ||--o{ verifications : "vérifié"
    users ||--o| trust_scores : "score"
    users ||--o{ notifications : "notifié"
    users ||--o{ audit_logs : "agit"
    users ||--o{ user_events : "émet"
```

## Identity

```mermaid
erDiagram
    users {
        bigint id PK
        uuid public_id UK
        citext email "unique si deleted_at IS NULL"
        varchar phone "E.164, unique si deleted_at IS NULL"
        varchar password_hash "Argon2id, nullable (OTP)"
        user_status status
        timestamptz deleted_at
    }
    roles {
        int id PK
        varchar code UK "CUSTOMER, OWNER, ..."
    }
    permissions {
        int id PK
        varchar code UK "ressource:action"
    }
    user_roles {
        bigint user_id PK, FK
        int role_id PK, FK
        bigint granted_by_id FK "SET NULL"
    }
    role_permissions {
        int role_id PK, FK
        int permission_id PK, FK
    }
    auth_sessions {
        bigint id PK
        uuid public_id UK
        bigint user_id FK "CASCADE"
        uuid family_id "session logique exposée"
        char token_hash UK "HMAC-SHA256 du refresh token"
        timestamptz expires_at
        timestamptz revoked_at "renseigné avec revoked_reason"
        varchar revoked_reason "ROTATED, LOGOUT, REUSE_DETECTED, ..."
    }
    password_reset_tokens {
        bigint id PK
        bigint user_id FK "CASCADE"
        char token_hash UK "HMAC-SHA256"
        timestamptz expires_at
        timestamptz used_at
    }
    otp_challenges {
        bigint id PK
        uuid public_id UK
        bigint user_id FK "CASCADE, nullable"
        otp_channel channel "SMS, EMAIL"
        otp_purpose purpose
        char destination_hash "HMAC-SHA256"
        char code_hash "HMAC-SHA256"
        smallint attempts "0..max_attempts"
        timestamptz expires_at
        timestamptz consumed_at
    }
    users ||--o{ user_roles : ""
    roles ||--o{ user_roles : ""
    roles ||--o{ role_permissions : ""
    permissions ||--o{ role_permissions : ""
    users ||--o{ auth_sessions : ""
    users ||--o{ password_reset_tokens : ""
    users ||--o{ otp_challenges : ""
```

## Location

```mermaid
erDiagram
    countries {
        int id PK
        char code UK "ISO 3166-1, CI"
    }
    districts {
        int id PK
        int country_id FK
        varchar code "unique par pays"
    }
    cities {
        int id PK
        int district_id FK
        varchar code "unique par district"
    }
    communes {
        int id PK
        int city_id FK
        varchar code "COCODY, PORT_BOUET, ..."
    }
    neighborhoods {
        int id PK
        int commune_id FK
        varchar code "RIVIERA, ZONE_4, ..."
    }
    countries ||--o{ districts : ""
    districts ||--o{ cities : ""
    cities ||--o{ communes : ""
    communes ||--o{ neighborhoods : ""
```

## Property, Listing, Media

```mermaid
erDiagram
    properties {
        bigint id PK
        uuid public_id UK
        int property_type_id FK
        int neighborhood_id FK
        numeric surface "m²"
        numeric latitude
        numeric longitude
        geography geo_point "générée, GIST"
        location_visibility location_visibility "EXACT, APPROXIMATE, HIDDEN"
        jsonb attributes "objet, clés sur liste blanche"
        property_status status
        timestamptz deleted_at
    }
    property_types {
        int id PK
        varchar code UK
        property_category category
        boolean is_active
    }
    amenities {
        int id PK
        varchar code UK
        amenity_category category
    }
    property_ownerships {
        bigint id PK
        bigint property_id FK
        bigint owner_id FK
        ownership_type ownership_type "SOLE, JOINT, USUFRUCT, AGENT, MANAGER"
        timestamptz started_at
        timestamptz ended_at
        boolean is_current "= (ended_at IS NULL)"
    }
    listings {
        bigint id PK
        uuid public_id UK
        bigint property_id FK
        bigint created_by_id FK
        listing_type listing_type
        listing_status status "1 vivante par (bien, type)"
        timestamptz published_at
        timestamptz expires_at
        timestamptz deleted_at
    }
    listing_prices {
        bigint id PK
        bigint listing_id FK
        numeric amount "NUMERIC(14,2), > 0"
        char currency "ISO 4217, XOF"
        price_period period
        timestamptz valid_to "NULL = prix courant"
    }
    listing_status_history {
        bigint id PK
        bigint listing_id FK
        listing_status old_status
        listing_status new_status
        bigint changed_by_id FK "SET NULL"
    }
    media {
        bigint id PK
        uuid public_id UK
        bigint property_id FK
        media_type type
        storage_provider storage_provider
        varchar storage_key "unique par fournisseur"
        bigint file_size
        media_status status
        timestamptz deleted_at
    }
    property_types ||--o{ properties : ""
    neighborhoods ||--o{ properties : ""
    properties ||--o{ property_ownerships : ""
    properties ||--o{ property_amenities : ""
    amenities ||--o{ property_amenities : ""
    properties ||--o{ listings : ""
    listings ||--o{ listing_prices : ""
    listings ||--o{ listing_status_history : ""
    properties ||--o{ media : ""
```

## Interaction et Search

```mermaid
erDiagram
    favorites {
        bigint id PK
        bigint user_id FK "unique avec property_id"
        bigint property_id FK
    }
    property_views {
        bigint id PK
        timestamptz created_at PK "partition future"
        bigint user_id FK "nullable"
        bigint property_id FK
        traffic_source source
    }
    inquiries {
        bigint id PK
        uuid public_id UK
        bigint user_id FK
        bigint owner_id FK "destinataire figé"
        bigint listing_id FK "composite avec property_id"
        bigint property_id FK
        inquiry_type type
        inquiry_status status
    }
    appointments {
        bigint id PK
        uuid public_id UK
        bigint user_id FK
        bigint owner_id FK
        bigint listing_id FK "composite avec property_id"
        bigint property_id FK
        timestamptz scheduled_at
        appointment_status status
    }
    searches {
        bigint id PK
        timestamptz created_at PK "partition future"
        bigint user_id FK "nullable"
        numeric min_price
        numeric max_price
        int radius_m "1..100000"
        jsonb filters
    }
    listings ||--o{ inquiries : "(id, property_id)"
    listings ||--o{ appointments : "(id, property_id)"
    properties ||--o{ favorites : ""
    properties ||--o{ property_views : ""
    neighborhoods ||--o{ searches : ""
    property_types ||--o{ searches : ""
```

## Recommendation, Trust, Communication, Audit, Events

```mermaid
erDiagram
    user_preferences {
        bigint user_id PK, FK
        numeric min_budget
        numeric max_budget
        listing_type_array preferred_listing_types
    }
    user_preferred_communes {
        bigint user_id PK, FK
        int commune_id PK, FK
    }
    user_behavior_profiles {
        bigint user_id PK, FK
        jsonb preferred_locations
        float price_sensitivity "0..1"
        varchar model_version
    }
    recommendations {
        bigint id PK
        bigint user_id FK
        bigint property_id FK
        float score "0..1"
        varchar algorithm_version
        timestamptz expires_at
    }
    verifications {
        bigint id PK
        bigint user_id FK
        bigint property_id FK "requis pour PROPERTY_OWNERSHIP"
        verification_type type
        verification_status status
        varchar document_reference "clé S3/R2"
        bigint verified_by_id FK "SET NULL"
    }
    trust_scores {
        bigint id PK
        bigint user_id UK, FK
        numeric score "0..100"
        varchar algorithm_version
    }
    notifications {
        bigint id PK
        bigint user_id FK
        notification_type type
        timestamptz read_at "index des non lues"
    }
    audit_logs {
        bigint id PK
        timestamptz created_at PK "append-only"
        bigint actor_id FK "SET NULL"
        varchar entity_type
        varchar entity_id "sans clé étrangère"
        inet ip_address
        varchar request_id
    }
    user_events {
        bigint id PK
        timestamptz created_at PK "partition future"
        bigint user_id FK "SET NULL"
        user_event_type event_type
        timestamptz occurred_at "horloge client"
        jsonb metadata
    }
    user_preferences ||--o{ user_preferred_communes : ""
    communes ||--o{ user_preferred_communes : ""
```

Les tables `user_preferred_property_types`, `user_preferred_amenities` et `user_preferred_neighborhoods` suivent le même modèle que `user_preferred_communes`.
