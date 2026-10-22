# Kubernetes

Prévu quand un seul hôte Docker ne suffit plus, ou quand il faut plusieurs replicas de l'API et des workers.

Les sondes sont déjà définies côté application : `/health/live` et `/health/ready`. Les manifests viendront avec le premier cluster, pas avant.
