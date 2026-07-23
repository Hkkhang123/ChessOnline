import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status, Query
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
from jose import jwt, JWTError
from dotenv import load_dotenv
from app.database import db

from app.routers import auth
from app.cores.websocket_manager import manager

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

app = FastAPI(title="Chess Online API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Mở rộng để không bị chặn Handshake từ origin khác khi test
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.head("/")
async def root():
    return {"status": "ok", "message": "Chess Backend Server is running!"}

# Route test tối giản
@app.websocket("/ws/echo")
async def websocket_echo(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text("Hello from Render WebSocket!")
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Server nhận: {data}")
    except Exception:
        pass

app.include_router(auth.router)

# Vòng lặp đếm ngược timer
async def timer_broadcast_task(game_id: str):
    while game_id in manager.game_instances:
        if game_id not in manager.active_games or len(manager.active_games[game_id]) == 0:
            break

        game = manager.game_instances[game_id]
        is_timeout = game.update_timer()
        
        if is_timeout:
            current_turn = "white" if game.board.turn else "black"
            winner = "black" if current_turn == "white" else "white"
            await manager.broadcast_to_game(game_id, {
                "type": "game_over",
                "payload": {"winner": winner, "reason": "timeout"}
            })
            break
            
        try:
            await manager.broadcast_to_game(game_id, {
                "type": "time_update",
                "payload": game.get_game_state()["time_left"]
            })
        except Exception as e:
            print(f"Lỗi gửi time_update: {e}")
            
        await asyncio.sleep(1)


@app.websocket("/ws/queue")
async def websocket_queue(websocket: WebSocket, token: str = Query(...)):
    # await websocket.accept()
    
    user_id = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError as e:
        print(f"Lỗi JWT Decode: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    except Exception as e:
        print(f"Lỗi Auth WebSocket khác: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    try:
        await websocket.send_json({"type": "QUEUE_JOINED", "message": "Đã vào hàng chờ!"})
        
        await manager.add_to_queue(websocket)
        
        # Duy trì kết nối WebSocket luôn sống
        while True:
            data = await websocket.receive_text()

    except WebSocketDisconnect:
        print(f"User {user_id} đã ngắt kết nối WebSocket")
    except Exception as e:
        print(f"Lỗi duy trì WebSocket queue: {e}")


@app.websocket("/ws/game/{game_id}")
async def websocket_game(websocket: WebSocket, game_id: str):
    game_instance = manager.game_instances.get(game_id)
    if not game_instance:
        await websocket.close(code=4004)
        return

    await manager.connect(websocket, game_id)
    is_actively_leaving = False

    try:
        if websocket.client_state.value == 1:
            await websocket.send_text(json.dumps({
                "type": "init_state",
                "payload": game_instance.get_game_state()
            }))

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "leave_game":
                is_actively_leaving = True
                await manager.broadcast_to_others(game_id, {
                    "type": "opponent_left",
                    "payload": {"message": "Đối thủ đã rời phòng đấu!"}
                }, sender_socket=websocket)
                break

            elif message.get("type") == "move":
                move_uci = message["payload"].get("move")
                error = game_instance.make_move(move_uci)
                
                if error:
                    if websocket.client_state.value == 1:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": error
                        }))
                else:
                    state = game_instance.get_game_state() 
                    await manager.broadcast_to_game(game_id, {
                        "type": "game_update",
                        "payload": state
                    })
                    
    except WebSocketDisconnect:
        print(f"WebSocket ngắt kết nối tại game {game_id}")
    finally:
        manager.disconnect(websocket, game_id)

        if not is_actively_leaving:
            await asyncio.sleep(2)
            remaining = manager.active_games.get(game_id, [])
            if len(remaining) > 0:
                await manager.broadcast_to_others(game_id, {
                    "type": "opponent_left",
                    "payload": {"message": "Đối thủ đã mất kết nối"}
                }, sender_socket=websocket)

        remaining = manager.active_games.get(game_id, [])
        if len(remaining) == 0 and game_id in manager.game_instances:
            del manager.game_instances[game_id]
            print(f"Đã xóa trận đấu trống {game_id}")