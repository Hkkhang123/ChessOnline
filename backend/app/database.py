import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DB_NAME = os.getenv("DB_NAME")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]

async def get_database():
    return db