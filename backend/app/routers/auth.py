from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.database import get_database
from app.models import UserModel
from app.cores.auth import get_password_hash, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Schema tiếp nhận dữ liệu từ client gửi lên
class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@router.post("/register")
async def register(payload: RegisterRequest, db = Depends(get_database)):
    # 1. Kiểm tra Email đã tồn tại chưa
    existing_email = await db.users.find_one({"email": payload.email})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email đã được đăng ký sử dụng."
        )
    
    # 2. Kiểm tra Username đã tồn tại chưa
    existing_username = await db.users.find_one({"username": payload.username})
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Tên người dùng đã được sử dụng."
        )
    
    # 3. Mã hóa mật khẩu và chuẩn bị dữ liệu lưu trữ
    hashed_pwd = get_password_hash(payload.password)
    new_user = UserModel(
        username=payload.username,
        email=payload.email,
        hashed_password=hashed_pwd
    )
    
    # 4. Chèn vào MongoDB collection 'users'
    # dict() chuyển pydantic model sang dict để lưu vào Mongo
    user_dict = new_user.model_dump() 
    await db.users.insert_one(user_dict)
    
    return {"message": "Đăng ký tài khoản thành công!"}

@router.post("/login")
async def login(payload: LoginRequest, db = Depends(get_database)):
    # 1. Tìm user theo Email
    user = await db.users.find_one({"email": payload.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Email hoặc mật khẩu không chính xác."
        )
    
    # 2. Kiểm tra mật khẩu
    if not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Email hoặc mật khẩu không chính xác."
        )
    
    # 3. Tạo JWT Token chứa ID (dưới dạng string) và Username của người dùng
    token_data = {
        "sub": str(user["_id"]),
        "username": user["username"],
        "elo": user["elo"]
    }
    access_token = create_access_token(data=token_data)
    
    # 4. Trả về token
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "elo": user["elo"]
        }
    }