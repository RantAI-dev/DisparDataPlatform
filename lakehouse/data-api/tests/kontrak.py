"""Validasi respons terhadap `openapi.yaml` (dipakai tes `contract/`)."""

from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

SPEC = yaml.safe_load((Path(__file__).resolve().parents[1] / "openapi.yaml").read_text())
REGISTRY = Registry().with_resource("urn:kontrak", Resource.from_contents(SPEC, default_specification=DRAFT202012))


def _pointer(*bagian: str) -> str:
    return "/".join(str(b).replace("~", "~0").replace("/", "~1") for b in bagian)


def validasi(path: str, metode: str, status: int, isi, media: str = "application/json") -> None:
    respons = SPEC["paths"][path][metode]["responses"][str(status)]
    if "$ref" in respons:
        nama = respons["$ref"].rsplit("/", 1)[1]
        ptr = _pointer("components", "responses", nama, "content", media, "schema")
    else:
        ptr = _pointer("paths", path, metode, "responses", str(status), "content", media, "schema")
    v = Draft202012Validator({"$ref": f"urn:kontrak#/{ptr}"}, registry=REGISTRY)
    galat = sorted(v.iter_errors(isi), key=lambda e: list(e.path))
    assert not galat, [f"{list(e.path)}: {e.message}" for e in galat[:5]]
