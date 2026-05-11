from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date

class AthleteBase(BaseModel):
    first_name: str
    last_name: str
    sport: str
    date_of_birth: date
    gender: str
    external_id: str

class AthleteCreate(AthleteBase):
    pass

class AthleteUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    sport: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    external_id: Optional[str] = None

class AthleteInDB(AthleteBase):
    id: str = Field(..., alias="_id")
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }
