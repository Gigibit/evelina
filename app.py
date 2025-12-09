import json
import os
import sqlite3
from contextlib import closing
from io import BytesIO
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, flash, redirect, render_template, request, url_for
from openai import OpenAI
from PyPDF2 import PdfReader

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-me")
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", "extractions.db"))


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS extractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codice_fiscale TEXT UNIQUE,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
"""


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


def get_db_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(DATABASE_PATH))
    connection.row_factory = sqlite3.Row
    return connection


def _migrate_schema(connection: sqlite3.Connection) -> None:
    columns = connection.execute("PRAGMA table_info(extractions)").fetchall()

    if not columns:
        connection.execute(CREATE_TABLE_SQL)
        connection.commit()
        return

    column_names = {column[1] for column in columns}

    if "id" in column_names:
        return

    connection.executescript(
        """
        ALTER TABLE extractions RENAME TO extractions_old;
        CREATE TABLE extractions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codice_fiscale TEXT UNIQUE,
            data JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO extractions (codice_fiscale, data, created_at)
        SELECT codice_fiscale, data, created_at FROM extractions_old;
        DROP TABLE extractions_old;
        """
    )
    connection.commit()


def init_db() -> None:
    with closing(get_db_connection()) as connection:
        _migrate_schema(connection)


def _normalize_key(key: str) -> str:
    return key.strip().lower().replace(" ", "_")


def _get_value_by_keys(data: dict, keys: list[str]):
    if not isinstance(data, dict):
        return None

    normalized_mapping = {_normalize_key(k): v for k, v in data.items()}

    for key in keys:
        normalized_key = _normalize_key(key)
        if normalized_key in normalized_mapping:
            return normalized_mapping[normalized_key]

    return None


def extract_codice_fiscale(data: dict) -> str | None:
    codice = _get_value_by_keys(data, ["codice_fiscale", "codice fiscale"])

    if codice is None:
        anagrafica = _get_value_by_keys(
            data, ["dati_anagrafici", "dati anagrafici", "Dati anagrafici"]
        )
        if isinstance(anagrafica, dict):
            codice = _get_value_by_keys(
                anagrafica, ["codice_fiscale", "codice fiscale", "Codice fiscale"]
            )

    if isinstance(codice, str):
        codice = codice.strip()

    return codice


def save_extraction(data: dict) -> None:
    codice_fiscale = extract_codice_fiscale(data)

    serialized = json.dumps(data, ensure_ascii=False)

    with closing(get_db_connection()) as connection:
        if codice_fiscale:
            connection.execute(
                """
                INSERT INTO extractions (codice_fiscale, data, created_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(codice_fiscale) DO UPDATE SET
                    data=excluded.data,
                    created_at=CURRENT_TIMESTAMP
                """,
                (codice_fiscale, serialized),
            )
        else:
            connection.execute(
                """
                INSERT INTO extractions (data, created_at)
                VALUES (?, CURRENT_TIMESTAMP)
                """,
                (serialized,),
            )
        connection.commit()


def list_extractions() -> list[dict]:
    with closing(get_db_connection()) as connection:
        rows = connection.execute(
            """
            SELECT codice_fiscale, data, created_at
            FROM extractions
            ORDER BY datetime(created_at) DESC
            """
        ).fetchall()

    items = []
    for row in rows:
        payload = json.loads(row["data"])
        anagrafica = _get_value_by_keys(
            payload, ["dati_anagrafici", "dati anagrafici", "Dati anagrafici"]
        ) or {}
        dettagli_atto = _get_value_by_keys(
            payload, ["dettagli_atto", "dettagli atto", "Dettagli atto"]
        ) or {}
        dati_immobiliari = _get_value_by_keys(
            payload,
            ["dati_immobiliari", "dati immobiliari", "Dati immobiliari"],
        ) or {}

        items.append(
            {
                "codice_fiscale": row["codice_fiscale"],
                "nome": anagrafica.get("Nome"),
                "cognome": anagrafica.get("Cognome"),
                "indirizzo": dati_immobiliari.get("Indirizzo immobile"),
                "tipo_atto": dettagli_atto.get("Tipo di atto"),
                "data_rogito": dettagli_atto.get("Data rogito"),
                "updated_at": row["created_at"],
                "data": payload,
            }
        )

    return items


init_db()


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
    model = os.getenv("OPENAI_MODEL", "gpt-4o")

    completion = client.chat.completions.create(
        model=model,
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
    app.logger.info("Risposta OpenAI (raw): %s", content)

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:  # pragma: no cover - depends on external API
        raise ExtractionError("La risposta dell'AI non è in formato JSON valido.") from exc

    app.logger.info("Risposta OpenAI (parsed): %s", json.dumps(parsed, ensure_ascii=False, indent=2))

    return parsed


@app.route("/")
def index():
    records = list_extractions()
    return render_template("index.html", records=records)


@app.route("/estrai", methods=["POST"])
def extract():
    file_storage = request.files.get("atto")

    if not file_storage or file_storage.filename == "":
        flash("Carica un file PDF per procedere.")
        return redirect(url_for("index"))

    codice_fiscale = None
    try:
        document_text = read_pdf(file_storage)
        extracted = ask_gpt(document_text)
        codice_fiscale = extract_codice_fiscale(extracted)
        save_extraction(extracted)
    except ExtractionError as exc:
        flash(str(exc))
        return redirect(url_for("index"))

    extracted_json = json.dumps(extracted, ensure_ascii=False, indent=2)

    return render_template(
        "result.html",
        data=extracted,
        extracted_json=extracted_json,
        codice_fiscale=codice_fiscale,
        prompt=build_prompt(),
    )


if __name__ == "__main__":
    app.run(debug=True)
