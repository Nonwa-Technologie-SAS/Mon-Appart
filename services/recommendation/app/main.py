from fastapi import FastAPI

app = FastAPI(
    title="Mon Appart Recommendation",
    version="0.1.0",
    description="Socle du service de recommandation. Le moteur n'est pas encore implémenté.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "recommendation"}
