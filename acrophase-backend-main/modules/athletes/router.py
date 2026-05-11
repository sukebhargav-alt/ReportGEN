from fastapi import APIRouter, status
from datetime import date
from uuid import UUID
from modules.common.supabase import supabase_request
from modules.athletes.models import AthleteCreate, AthleteUpdate
from modules.common.responses import success_response, error_response
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

def athlete_helper(athlete) -> dict:
    return {
        "id": str(athlete["id"]),
        "first_name": athlete["first_name"],
        "last_name": athlete["last_name"],
        "sport": athlete["sport"],
        "date_of_birth": athlete["date_of_birth"],
        "gender": athlete["gender"],
        "external_id": athlete["external_id"],
        "created_at": athlete["created_at"]
    }

def is_valid_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except ValueError:
        return False

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_athlete(athlete: AthleteCreate):
    try:
        # Check if external_id already exists
        existing_result = await supabase_request(
            "GET",
            "athletes",
            params={"select": "id", "external_id": f"eq.{athlete.external_id}", "limit": "1"},
        )
        existing = existing_result[0] if existing_result else None
        if existing:
            return JSONResponse(
                status_code=400,
                content=error_response(message="Athlete creation failed", errors=["External ID already registered"])
            )
        
        athlete_dict = athlete.model_dump()
        if isinstance(athlete_dict.get("date_of_birth"), date):
            athlete_dict["date_of_birth"] = athlete_dict["date_of_birth"].isoformat()
        
        insert_result = await supabase_request(
            "POST",
            "athletes",
            json=athlete_dict,
            prefer="return=representation",
        )
        created_athlete = insert_result[0] if insert_result else None
        if not created_athlete:
            return JSONResponse(
                status_code=500,
                content=error_response(message="Athlete creation failed", errors=["Created athlete could not be retrieved"])
            )
        data = athlete_helper(created_athlete)
        return success_response(data=data, message="Athlete created successfully")
    except Exception as e:
        logger.error(f"Error creating athlete: {str(e)}")
        return JSONResponse(
            status_code=400,
            content=error_response(message="Invalid data format or database error", errors=[str(e)])
        )

@router.get("/", response_model=dict)
async def get_athletes():
    try:
        result = await supabase_request(
            "GET",
            "athletes",
            params={"select": "*", "order": "created_at.desc"},
        )
        athletes = [athlete_helper(athlete) for athlete in result]
        return success_response(data=athletes, message="Athletes retrieved successfully")
    except Exception as e:
        logger.error(f"Error fetching athletes: {str(e)}")
        return JSONResponse(
            status_code=500,
            content=error_response(message="Error retrieving athletes from database", errors=[str(e)])
        )

@router.get("/{id}", response_model=dict)
async def get_athlete(id: str):
    try:
        if not is_valid_uuid(id):
            return JSONResponse(
                status_code=400,
                content=error_response(message="Invalid ID format", errors=[f"ID {id} is not a valid UUID"])
            )
        
        result = await supabase_request(
            "GET",
            "athletes",
            params={"select": "*", "id": f"eq.{id}", "limit": "1"},
        )
        athlete = result[0] if result else None
        if not athlete:
            return JSONResponse(
                status_code=404,
                content=error_response(message="Athlete not found", errors=[f"No athlete found with ID {id}"])
            )
        return success_response(data=athlete_helper(athlete), message="Athlete retrieved successfully")
    except Exception as e:
        logger.error(f"Error fetching athlete {id}: {str(e)}")
        return JSONResponse(
            status_code=500,
            content=error_response(message="Error retrieving athlete", errors=[str(e)])
        )

@router.put("/{id}", response_model=dict)
async def update_athlete(id: str, athlete_update: AthleteUpdate):
    try:
        if not is_valid_uuid(id):
            return JSONResponse(
                status_code=400,
                content=error_response(message="Invalid ID format", errors=[f"ID {id} is not a valid UUID"])
            )
        
        update_data = {k: v for k, v in athlete_update.model_dump().items() if v is not None}
        
        if "date_of_birth" in update_data and isinstance(update_data["date_of_birth"], date):
            update_data["date_of_birth"] = update_data["date_of_birth"].isoformat()
        
        if len(update_data) >= 1:
            update_result = await supabase_request(
                "PATCH",
                "athletes",
                params={"id": f"eq.{id}"},
                json=update_data,
                prefer="return=representation",
            )
            if not update_result:
                return JSONResponse(
                    status_code=404,
                    content=error_response(message="Athlete update failed", errors=[f"No athlete found with ID {id}"])
                )
                
        result = await supabase_request(
            "GET",
            "athletes",
            params={"select": "*", "id": f"eq.{id}", "limit": "1"},
        )
        updated_athlete = result[0] if result else None
        if not updated_athlete:
             return JSONResponse(
                status_code=404,
                content=error_response(message="Athlete update failed", errors=["Updated athlete could not be retrieved"])
            )
        return success_response(data=athlete_helper(updated_athlete), message="Athlete updated successfully")
    except Exception as e:
        logger.error(f"Error updating athlete {id}: {str(e)}")
        return JSONResponse(
            status_code=400,
            content=error_response(message="Error updating athlete", errors=[str(e)])
        )

@router.delete("/{id}", response_model=dict)
async def delete_athlete(id: str):
    try:
        if not is_valid_uuid(id):
            return JSONResponse(
                status_code=400,
                content=error_response(message="Invalid ID format", errors=[f"ID {id} is not a valid UUID"])
            )
        
        existing_result = await supabase_request(
            "GET",
            "athletes",
            params={"select": "id", "id": f"eq.{id}", "limit": "1"},
        )
        if not existing_result:
            return JSONResponse(
                status_code=404,
                content=error_response(message="Athlete deletion failed", errors=[f"No athlete found with ID {id}"])
            )
        await supabase_request("DELETE", "athletes", params={"id": f"eq.{id}"})
        return success_response(message="Athlete deleted successfully")
    except Exception as e:
        logger.error(f"Error deleting athlete {id}: {str(e)}")
        return JSONResponse(
            status_code=500,
            content=error_response(message="Error deleting athlete", errors=[str(e)])
        )
