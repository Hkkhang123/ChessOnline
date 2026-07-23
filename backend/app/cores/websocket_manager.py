import os
import token

from fastapi import WebSocket
from typing import Dict, List
import json
import uuid
from jose import jwt
from dotenv import load_dotenv
from app.cores.chess_game import ChessGame

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

class ConnectionManager:

    def __init__(self):
        self.active_games: Dict[str, List[WebSocket]] = {}
        self.game_instances: Dict[str, ChessGame] = {} 
        self.matchmaking_queue: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, game_id: str):
        await websocket.accept()
        if game_id not in self.active_games:
            self.active_games[game_id] = []
        
        if len(self.active_games[game_id]) < 2:
            self.active_games[game_id].append(websocket)
        else:
            await websocket.close(code=4001, reason="Phòng đã đầy")

    def disconnect(self, websocket: WebSocket, game_id: str):
        if websocket in self.matchmaking_queue:
            self.matchmaking_queue.remove(websocket)
        if game_id in self.active_games and websocket in self.active_games[game_id]:
            self.active_games[game_id].remove(websocket)
            if not self.active_games[game_id]:
                # Xóa game instance nếu không còn ai trong phòng
                if game_id in self.game_instances:
                    del self.game_instances[game_id]
                del self.active_games[game_id]

    async def broadcast_to_game(self, game_id: str, message: dict):
        if game_id not in self.active_games:
            return

        # Tạo danh sách các socket bị lỗi để dọn dẹp sau
        dead_sockets = []
        
        for connection in self.active_games[game_id]:
            try:
                # Chỉ gửi khi trạng thái kết nối vẫn đang mở (OPEN = 1)
                if connection.client_state.value == 1: 
                    await connection.send_text(json.dumps(message))
                else:
                    dead_sockets.append(connection)
            except Exception:
                dead_sockets.append(connection)

        # Dọn dẹp các socket đã chết để tránh rác bộ nhớ
        for dead in dead_sockets:
            self.disconnect(dead, game_id)

    async def broadcast_to_others(self, game_id: str, message: dict, sender_socket: WebSocket):
        if game_id not in self.active_games:
            print(f"[DEBUG] Không tìm thấy game_id {game_id} trong active_games")
            return

        connections = self.active_games[game_id]
        print(f"[DEBUG] Số kết nối đang có trong phòng {game_id}: {len(connections)}")
        
        for connection in connections:
            # Gửi tin nhắn cho tất cả kết nối TRỪ người bấm nút thoát
            if connection != sender_socket:
                try:
                    await connection.send_text(json.dumps(message))
                    print(f"[DEBUG] Đã gửi thông báo '{message['type']}' thành công tới đối thủ!")
                except Exception as e:
                    print(f"[ERROR] Lỗi gửi thông báo cho đối thủ: {e}")
                    
    async def add_to_queue(self, websocket: WebSocket):
        """Thêm người chơi vào hàng đợi và giữ kết nối mở"""
        await websocket.accept()
        
        token = websocket.query_params.get("token")
        user_info = {"id": f"guest_{uuid.uuid4().hex[:6]}", "username": "Guest"}
        
        if token and token not in ["null", "undefined", ""]:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user_info["id"] = payload.get("sub")
                user_info["username"] = payload.get("username")
            except Exception as e:
                print(f"Lỗi giải mã Token trong Queue: {e}")
        
        websocket.scope["user"] = user_info
        self.matchmaking_queue.append(websocket)
        
        # Tiến hành bắt cặp khi đủ 2 người trở lên
        if len(self.matchmaking_queue) >= 2:
            player1_socket = self.matchmaking_queue.pop(0)
            player2_socket = self.matchmaking_queue.pop(0)
            
            p1_data = player1_socket.scope.get("user", {})
            p2_data = player2_socket.scope.get("user", {})
            
            new_game_id = str(uuid.uuid4())
            try:
                self.game_instances[new_game_id] = ChessGame(
                    new_game_id, 
                    p1_data.get("id"), 
                    p1_data.get("username"), 
                    p2_data.get("id"), 
                    p2_data.get("username")
                )
                self.game_instances[new_game_id].start_timer()
                print(f"Khởi tạo trận đấu thành công: {new_game_id}")
            except Exception as e:
                print(f"Lỗi nghiêm trọng khi tạo instance ChessGame: {e}")
                # Nếu lỗi, gửi thông báo đóng kết nối an toàn cho client để tránh bị treo
                await player1_socket.close(code=1011)
                await player2_socket.close(code=1011)
                return
            await player1_socket.send_text(json.dumps({
                "type": "match_found",
                "payload": {"game_id": new_game_id, "color": "white"}
            }))
            await player2_socket.send_text(json.dumps({
                "type": "match_found",
                "payload": {"game_id": new_game_id, "color": "black"}
            }))
            return 

        # Để giữ kết nối cho người chơi đang đợi một mình
        try:
            while True:
                await websocket.receive_text()
        except Exception:
            if websocket in self.matchmaking_queue:
                self.matchmaking_queue.remove(websocket)

manager = ConnectionManager()
print(f"[MANAGER.PY] Địa chỉ bộ nhớ của manager: {id(manager)}")