import pytest

pytest.importorskip("flask")
pytest.importorskip("dotenv")
pytest.importorskip("openai")
pytest.importorskip("PyPDF2")

from app import DATA_FIELDS, build_prompt


def test_build_prompt_contains_all_fields():
    prompt = build_prompt()

    for section, fields in DATA_FIELDS.items():
        assert section in prompt
        for field in fields:
            assert field in prompt
