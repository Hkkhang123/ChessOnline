import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
from jose import jwt
from dotenv import load_dotenv
from app.database import db

from app.routers import auth
from app.cores.websocket_manager import manager
print(f"[MAIN.PY] Địa chỉ bộ nhớ của manager: {id(manager)}")
load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

app = FastAPI(title="Chess Online API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

# Vòng lặp chạy ngầm để cập nhật đồng hồ đếm ngược và gửi về client mỗi giây
async def timer_broadcast_task(game_id: str):
    while game_id in manager.game_instances:
        # Nếu không còn ai trong phòng đấu nữa, tắt task chạy ngầm này ngay lập tức
        if game_id not in manager.active_games or len(manager.active_games[game_id]) == 0:
            print(f"Dừng task đếm ngược của trận đấu {game_id} do không còn người chơi.")
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
async def websocket_queue(websocket: WebSocket):
    # Hàm add_to_queue sẽ tự quản lý việc giữ kết nối mở và bắt cặp
    await manager.add_to_queue(websocket)

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
            
            # Xử lý khi bấm nút "Rời phòng"
            if message.get("type") == "leave_game":
                is_actively_leaving = True
                print(f"[DEBUG] Nhận được yêu cầu leave_game từ người chơi.")
                
                # 1. Phát thông báo ngay cho người còn lại trong phòng
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
        print(f"[DEBUG] WebSocket ngắt kết nối tại game {game_id}")
    finally:
        # Ngắt kết nối socket của người vừa thoát
        manager.disconnect(websocket, game_id)

        # Trường hợp rớt mạng/mất kết nối đột ngột
        if not is_actively_leaving:
            await asyncio.sleep(2)
            remaining = manager.active_games.get(game_id, [])
            if len(remaining) > 0:
                print(f"[DEBUG] Phát thông báo mất kết nối đột ngột tới đối thủ.")
                await manager.broadcast_to_others(game_id, {
                    "type": "opponent_left",
                    "payload": {"message": "Đối thủ đã mất kết nối đột ngột!"}
                }, sender_socket=websocket)

        # Xóa ván đấu nếu không còn ai
        remaining = manager.active_games.get(game_id, [])
        if len(remaining) == 0 and game_id in manager.game_instances:
            del manager.game_instances[game_id]
            print(f"[DEBUG] Đã xóa trận đấu trống {game_id}")