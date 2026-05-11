from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from modules.common.supabase import supabase_request
from modules.common.responses import success_response, error_response
from fastapi.responses import JSONResponse
import bcrypt
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

@router.post("/login", response_model=dict)
async def login(request: LoginRequest):
    try:
        result = await supabase_request(
            "GET",
            "users",
            params={"select": "*", "email": f"eq.{request.email}", "limit": "1"},
        )
        user = result[0] if result else None
        
        if not user:
            return JSONResponse(
                status_code=401,
                content=error_response(message="Login failed", errors=["Invalid email or password"])
            )

        stored_password = user.get("hashed_password")
        if isinstance(stored_password, str):
            stored_password = stored_password.encode('utf-8')

        if not verify_password(request.password, stored_password):
            return JSONResponse(
                status_code=401,
                content=error_response(message="Login failed", errors=["Invalid email or password"])
            )

        if not user.get("is_active", True):
            return JSONResponse(
                status_code=403,
                content=error_response(message="Account disabled", errors=["This account has been deactivated"])
            )

        data = {
            "email": user["email"],
            "full_name": user.get("full_name"),
            "is_admin": user.get("is_admin", False)
        }
        return success_response(data=data, message="Login successful")

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content=error_response(message="Internal server error", errors=[str(e)])
        )
