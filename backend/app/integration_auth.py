"""Opaque HttpOnly sessions. Client-provided viewer IDs never authenticate a user."""
import hashlib, secrets, os, time
from datetime import datetime,timedelta,timezone
from collections import defaultdict
from urllib.parse import urlsplit
from fastapi import APIRouter,Request,Response,HTTPException,Depends
from pydantic import BaseModel,Field
from sqlalchemy import Table,Column,String,BigInteger,DateTime,ForeignKey,select,insert,delete
from app.db import Base,SessionLocal,get_session
from app.models import User
from app.security import verify_password,hash_password
router=APIRouter(prefix="/auth",tags=["authentication"])
COOKIE="autoneg_session"
sessions=Table("web_auth_sessions",Base.metadata,Column("token_hash",String(64),primary_key=True),Column("user_id",BigInteger,ForeignKey("users.id",ondelete="CASCADE"),nullable=False),Column("expires_at",DateTime(timezone=True),nullable=False))
_failures=defaultdict(list)
def public_user(u):return {"id":u.id,"name":f"{u.first_name} {u.last_name}".strip(),"email":u.email,"role":u.role,"active":u.is_active}
def check_origin(request):
    if request.method in ("GET","HEAD","OPTIONS"):return
    allowed=set(os.getenv("AUTH_ALLOWED_ORIGINS","https://autonegotiater.com,https://www.autonegotiater.com").split(","))
    if request.headers.get("origin") not in allowed:raise HTTPException(403,"Request origin is not permitted.")
async def identity(request):
    token=request.cookies.get(COOKIE,"")
    if not token or len(token)>256:return None
    async with SessionLocal() as db:
        uid=await db.scalar(select(sessions.c.user_id).where(sessions.c.token_hash==hashlib.sha256(token.encode()).hexdigest(),sessions.c.expires_at>datetime.now(timezone.utc)))
        user=await db.get(User,uid) if uid else None
        return public_user(user) if user and user.is_active else None
async def current_user(request:Request):
    user=getattr(request.state,"authenticated_user",None) or await identity(request)
    if not user:raise HTTPException(401,"Sign in to continue.")
    return user
class Login(BaseModel):
    email:str=Field(min_length=3,max_length=100)
    password:str=Field(min_length=1,max_length=256)
class Register(Login):
    name:str=Field(min_length=2,max_length=100)
    role:str
async def set_cookie(user_id,response,db):
    token=secrets.token_urlsafe(48)
    await db.execute(insert(sessions).values(token_hash=hashlib.sha256(token.encode()).hexdigest(),user_id=user_id,expires_at=datetime.now(timezone.utc)+timedelta(hours=8)))
    await db.commit()
    response.set_cookie(COOKIE,token,httponly=True,secure=os.getenv("AUTH_COOKIE_SECURE","true")=="true",samesite="lax",max_age=28800,path="/")
@router.post("/login")
async def login(payload:Login,request:Request,response:Response,db=Depends(get_session)):
    check_origin(request)
    if payload.password in ("Demo@1234","change-me","password","admin"):
        raise HTTPException(403,"This existing account requires activation with a private password by the site owner.")
    key=request.client.host if request.client else "unknown";cut=time.monotonic()-900
    _failures[key]=[v for v in _failures[key] if v>cut]
    if len(_failures[key])>=20:raise HTTPException(429,"Too many sign-in attempts. Please try again later.")
    u=await db.scalar(select(User).where(User.email==payload.email.strip().lower()))
    valid=False
    if u and u.is_active:
        try:valid=verify_password(payload.password,u.password_hash)
        except Exception:pass
    if not valid:
        _failures[key].append(time.monotonic());raise HTTPException(401,"Email or password is incorrect.")
    _failures.pop(key,None)
    old=request.cookies.get(COOKIE)
    if old:await db.execute(delete(sessions).where(sessions.c.token_hash==hashlib.sha256(old.encode()).hexdigest()))
    await set_cookie(u.id,response,db);return public_user(u)
@router.post("/register")
async def register(payload:Register,request:Request,response:Response,db=Depends(get_session)):
    check_origin(request)
    if payload.role not in ("buyer","seller") or len(payload.password)<12:raise HTTPException(400,"Choose Buyer or Seller and a password of at least 12 characters.")
    email=payload.email.strip().lower()
    if "@" not in email or await db.scalar(select(User.id).where(User.email==email)):raise HTTPException(400,"Use a valid, available email address.")
    parts=payload.name.strip().split(None,1)
    if not parts:raise HTTPException(400,"Enter your name.")
    u=User(first_name=parts[0][:50],last_name=(parts[1] if len(parts)>1 else "")[:50],email=email,password_hash=hash_password(payload.password),role=payload.role,is_active=True)
    db.add(u);await db.flush();await set_cookie(u.id,response,db);return public_user(u)
@router.get("/me")
async def me(user=Depends(current_user)):return user
@router.post("/logout")
async def logout(request:Request,response:Response,db=Depends(get_session)):
    check_origin(request);token=request.cookies.get(COOKIE,"")
    if token:await db.execute(delete(sessions).where(sessions.c.token_hash==hashlib.sha256(token.encode()).hexdigest()));await db.commit()
    response.delete_cookie(COOKIE,path="/",secure=os.getenv("AUTH_COOKIE_SECURE","true")=="true",httponly=True,samesite="lax");return {"ok":True}
