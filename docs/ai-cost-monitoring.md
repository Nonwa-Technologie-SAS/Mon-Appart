# Coûts des systèmes IA

**Aucun coût fournisseur n’est collecté dans Prometheus ni Analytics.** Le dashboard admin affiche explicitement `estimated: null`.

Estimations possibles hors plateforme : facture OpenAI (tokens) si `AI_ASSISTANT_PROVIDER=openai`. Le mode `rules` n’a pas de coût LLM.

Leviers déjà en place : cache reco Redis, timeout remote 800 ms, `maxTokens` assistant, Search SQL avant toute reformulation, kill-switch provider.

Ne pas afficher un « coût par conversion » tant que la facturation tokens n’est pas branchée.
