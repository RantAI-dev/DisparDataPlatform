"""Bentuk error tunggal SPEC §3.3: `{"error": {"code", "message", "detail"}}`."""

from __future__ import annotations


class ApiError(Exception):
    status = 500
    code = "UPSTREAM_UNAVAILABLE"

    def __init__(self, message: str, detail: str | None = None):
        super().__init__(message)
        self.message = message
        self.detail = detail

    def isi(self) -> dict:
        return {"error": {"code": self.code, "message": self.message, "detail": self.detail}}


class NotFound(ApiError):
    status, code = 404, "NOT_FOUND"


class InvalidParam(ApiError):
    status, code = 400, "INVALID_PARAM"


class InvalidFilter(ApiError):
    status, code = 400, "INVALID_FILTER"


class TooLarge(ApiError):
    status, code = 413, "TOO_LARGE"


class Unauthorized(ApiError):
    status, code = 401, "UNAUTHORIZED"


class Upstream(ApiError):
    status, code = 503, "UPSTREAM_UNAVAILABLE"
