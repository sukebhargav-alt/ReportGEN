from pydantic import BaseModel
from typing import Optional, Any, List

class StandardResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: str
    errors: List[str] = []

def success_response(data: Any = None, message: str = "Operation successful"):
    return StandardResponse(
        success=True,
        data=data,
        message=message,
        errors=[]
    ).model_dump()

def error_response(message: str = "Operation failed", errors: List[str] = [], status_code: int = 400):
    return StandardResponse(
        success=False,
        data=None,
        message=message,
        errors=errors
    ).model_dump()
