# Terraform

Réservé à l’infrastructure cloud (réseau, PostgreSQL managé, Redis, stockage objet, secrets, DNS).

## Statut

**Aucun module Terraform n’est écrit** tant que l’hébergeur et les environnements staging / production ne sont pas choisis. Ajouter du HCL non appliqué donnerait une fausse impression de plateforme déployable.

Décision d’architecture et options : [docs/deployment-architecture.md](../../docs/deployment-architecture.md).

## Quand démarrer

Après validation humaine de :

1. Fournisseur compute (API/workers)
2. Postgres PostGIS managé
3. Redis
4. Object storage (R2/S3)
5. Compte DNS

Alors créer des modules séparés (`network`, `data`, `compute`, `storage`, `observability`) avec state distant verrouillé (S3/GCS + DynamoDB/Consul, etc.), workspaces `staging` / `production`, et revue de `terraform plan` obligatoire avant `apply`.

## Interdits

- `terraform apply` / `destroy` sans autorisation explicite
- Secrets dans le code ou les outputs
- State dans un dépôt Git public
