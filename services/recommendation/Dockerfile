# syntax=docker/dockerfile:1.7
# Service FastAPI de recommandation (optionnel — moteur rules côté Nest par défaut).

ARG PYTHON_VERSION=3.12

FROM python:${PYTHON_VERSION}-slim AS builder
WORKDIR /build
COPY services/recommendation/requirements.txt requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:${PYTHON_VERSION}-slim AS runner
RUN groupadd --system --gid 1001 monappart \
  && useradd --system --uid 1001 --gid monappart --home /app monappart
WORKDIR /app
COPY --from=builder /install /usr/local
COPY services/recommendation/app app
USER monappart
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
