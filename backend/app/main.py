from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.db import engine
from app.routers import dashboard, products, workspace

app = FastAPI(title="AutoNegotiater API", root_path="/api", docs_url="/docs", openapi_url="/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(dashboard.router)
app.include_router(workspace.router)


@app.get("/health")
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db = "ok"
    except Exception:
        db = "down"
    return {"status": "ok", "db": db}

# Authentication applies to the existing contracts as well as the new integration.
from app.integration_auth import router as auth_router, identity, check_origin
from starlette.responses import JSONResponse
from urllib.parse import parse_qsl, urlencode
app.include_router(auth_router)
@app.middleware("http")
async def authenticated_workspace(request,call_next):
    private=request.url.path.startswith(("/workspace","/dashboard")) or request.url.path.startswith("/integration/") and request.url.path!="/integration/catalog"
    if private:
        try:check_origin(request)
        except Exception:return JSONResponse({"detail":"Request origin is not permitted."},status_code=403)
        user=await identity(request)
        if not user:return JSONResponse({"detail":"Sign in to continue."},status_code=401)
        if request.url.path=="/workspace/users/register":return JSONResponse({"detail":"Use authenticated registration."},status_code=410)
        if request.url.path=="/dashboard/admin" and user["role"]!="admin":return JSONResponse({"detail":"Admin access required."},status_code=403)
        if request.url.path=="/dashboard/seller" and user["role"]!="seller":return JSONResponse({"detail":"Seller access required."},status_code=403)
        if request.url.path=="/dashboard/buyer" and user["role"]!="buyer":return JSONResponse({"detail":"Buyer access required."},status_code=403)
        request.state.authenticated_user=user
        request.scope["headers"]=[(k,v) for k,v in request.scope["headers"] if k.lower()!=b"x-viewer-id"]+[(b"x-viewer-id",str(user["id"]).encode())]
        params=[(k,v) for k,v in parse_qsl(request.scope["query_string"].decode()) if k not in ("viewer_id","buyer_id","seller_id")]
        if request.url.path=="/workspace/bootstrap":params.append(("viewer_id",str(user["id"])))
        if request.url.path=="/dashboard/seller":params.append(("seller_id",str(user["id"])))
        if request.url.path=="/dashboard/buyer":params.append(("buyer_id",str(user["id"])))
        request.scope["query_string"]=urlencode(params).encode()
    response=await call_next(request)
    if private or request.url.path.startswith("/auth"):
        response.headers["Cache-Control"]="no-store"
    return response

from app.routers.integration import router as integration_router
app.include_router(integration_router)
