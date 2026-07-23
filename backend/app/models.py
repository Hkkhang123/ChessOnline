from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime

# Schema cho User trong Database
class UserModel(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    email: EmailStr
    hashed_password: str
    elo: int = 1200 
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "username": "player1",
                "email": "player1@example.com",
                "elo": 1200
            }
        }

# Schema lưu lịch sử trận đấu
class GameHistoryModel(BaseModel):
    white_player_id: str
    black_player_id: str
    result: str  # "white", "black", hoặc "draw"
    reason: str  # "checkmate", "stalemate", "timeout", "resignation"
    moves: List[str]  # Mảng lưu danh sách nước đi dạng UCI (e2e4, e7e5,...)
    played_at: datetime = Field(default_factory=datetime.now)