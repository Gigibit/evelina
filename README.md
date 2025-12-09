# Estrazione dati da atti notarili

Applicazione Flask con template Jinja per caricare un PDF di un atto notarile ed estrarre i dati strutturati utilizzando un modello OpenAI (predefinito `gpt-4o`).

## Setup

1. Creare un file `.env` partendo da `.env.example` e compilare `OPENAI_API_KEY`, `OPENAI_MODEL` (opzionale, default `gpt-4o`) e `FLASK_SECRET_KEY`.
Applicazione Flask con template Jinja per caricare un PDF di un atto notarile ed estrarre i dati strutturati utilizzando il modello `gpt-5o` di OpenAI.

## Setup

1. Creare un file `.env` partendo da `.env.example` e compilare `OPENAI_API_KEY` e `FLASK_SECRET_KEY`.
2. Installare le dipendenze:
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt  # per test e lint
   ```

## Esecuzione

```bash
flask --app app run --debug
```

## Test e lint

```bash
ruff check .
pytest
```

> Il PDF caricato viene elaborato in memoria: il testo viene estratto localmente e inviato al modello insieme al prompt di estrazione.
