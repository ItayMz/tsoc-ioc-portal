from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from app.routes.parse import router as parse_router

MAX_REQUEST_SIZE_BYTES = 20 * 1024 * 1024
CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

app = FastAPI(title="TSOC IOC Automation Portal")
app.include_router(parse_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://tsoc-ioc-portal.vercel.app",
        "https://ioc-workbench.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _apply_security_headers(request: Request, response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY

    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response


@app.middleware("http")
async def harden_request_handling(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_SIZE_BYTES:
                return _apply_security_headers(
                    request,
                    JSONResponse(
                        status_code=413,
                        content={"detail": "Request exceeds the 20 MB maximum payload size."},
                    ),
                )
        except ValueError:
            pass

    body = await request.body()
    if len(body) > MAX_REQUEST_SIZE_BYTES:
        return _apply_security_headers(
            request,
            JSONResponse(
                status_code=413,
                content={"detail": "Request exceeds the 20 MB maximum payload size."},
            ),
        )

    response = await call_next(request)
    return _apply_security_headers(request, response)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "IOC Automation backend is running"}