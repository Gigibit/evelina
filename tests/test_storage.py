import pytest

pytest.importorskip("flask")
pytest.importorskip("dotenv")
pytest.importorskip("openai")
pytest.importorskip("PyPDF2")

import app


@pytest.fixture(autouse=True)
def temporary_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(app, "DATABASE_PATH", db_path)
    app.init_db()
    yield
    if db_path.exists():
        db_path.unlink()


def test_save_and_list_roundtrip():
    sample = {
        "Dati anagrafici": {
            "Nome": "Mario",
            "Cognome": "Rossi",
            "Codice fiscale": "RSSMRA80A01H501U",
        },
        "Dettagli atto": {"Tipo di atto": "Compravendita", "Data rogito": "2024-01-10"},
    }

    app.save_extraction(sample)
    stored = app.list_extractions()

    assert len(stored) == 1
    row = stored[0]
    assert row["codice_fiscale"] == "RSSMRA80A01H501U"
    assert row["nome"] == "Mario"
    assert row["cognome"] == "Rossi"
    assert row["tipo_atto"] == "Compravendita"
    assert row["data_rogito"] == "2024-01-10"


def test_missing_codice_fiscale_raises():
    sample = {"Dati anagrafici": {"Nome": "Nessuno"}}

    with pytest.raises(app.ExtractionError):
        app.save_extraction(sample)
