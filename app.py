import json
import os
from io import BytesIO

from dotenv import load_dotenv
from flask import Flask, flash, redirect, render_template, request, url_for
from openai import OpenAI
from PyPDF2 import PdfReader

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-me")


DATA_FIELDS = {
    "Dati anagrafici": [
        "Nome",
        "Cognome",
        "Codice fiscale",
        "Data di nascita",
        "Indirizzo",
    ],
    "Dati catastali": [
        "Foglio",
        "Particella",
        "Subalterno",
        "Categoria catastale",
        "Rendita",
    ],
    "Dati immobiliari": [
        "Indirizzo immobile",
        "Tipologia immobile",
        "Quote di proprietà",
    ],
    "Dettagli atto": [
        "Tipo di atto",
        "Notaio",
        "Data rogito",
        "Repertorio / raccolta",
    ],
}


class ExtractionError(Exception):
    """Raised when data extraction fails."""


def build_prompt() -> str:
    parts = [
        "Estrai i seguenti dati dall'atto allegato e restituiscili in JSON.",
        "Se un dato non è presente, restituisci null per quel campo.",
    ]

    for section, fields in DATA_FIELDS.items():
        parts.append(section + ":")
        for field in fields:
            parts.append(f"- {field}")

    return "\n".join(parts)


@app.context_processor
def _inject_helpers():
    return {"build_prompt": build_prompt}


def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ExtractionError(
            "OPENAI_API_KEY non configurata. Aggiungi la chiave al file .env o alle variabili d'ambiente."
        )
    return OpenAI(api_key=api_key)


def read_pdf(file_storage) -> str:
    try:
        pdf_bytes = file_storage.read()
        pdf_reader = PdfReader(BytesIO(pdf_bytes))
        text = "\n".join(page.extract_text() or "" for page in pdf_reader.pages)
    except Exception as exc:  # pragma: no cover - logged via flash and re-raised
        raise ExtractionError("Impossibile leggere il PDF caricato.") from exc

    if not text.strip():
        raise ExtractionError("Il PDF non contiene testo estraibile.")

    return text


def ask_gpt(document_text: str) -> dict:
    client = get_openai_client()
    prompt = build_prompt()

    completion = client.chat.completions.create(
        model="gpt-5o",
        messages=[
            {
                "role": "system",
                "content": "Sei un assistente che estrae dati strutturati da atti notarili.",
            },
            {
                "role": "user",
                "content": f"{prompt}\n\nAtto notarile:\n{document_text}",
            },
        ],
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content or "{}"

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:  # pragma: no cover - depends on external API
        raise ExtractionError("La risposta dell'AI non è in formato JSON valido.") from exc


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/estrai", methods=["POST"])
def extract():
    file_storage = request.files.get("atto")

    if not file_storage or file_storage.filename == "":
        flash("Carica un file PDF per procedere.")
        return redirect(url_for("index"))

    try:
        document_text = read_pdf(file_storage)
        extracted = ask_gpt(document_text)
    except ExtractionError as exc:
        flash(str(exc))
        return redirect(url_for("index"))

    return render_template(
        "result.html",
        data=extracted,
        prompt=build_prompt(),
    )


if __name__ == "__main__":
    app.run(debug=True)
