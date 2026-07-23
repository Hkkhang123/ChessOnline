import chess
import time
from typing import Dict, Optional

class ChessGame:
    def __init__(self, game_id: str, white_id: str, white_username: str, black_id: str, black_username: str, initial_time: int = 600):
        self.game_id = game_id
        self.player_ids = {"white": white_id, "black": black_id}
        self.player_usernames = {"white": white_username, "black": black_username}
        self.board = chess.Board()
        
        # Quản lý thời gian (mặc định 10 phút = 600 giây mỗi bên)
        self.time_left = {"white": float(initial_time), "black": float(initial_time)}
        self.last_move_time: Optional[float] = None
        self.moves_history = []

    def start_timer(self):
        self.last_move_time = time.time()

    def update_timer(self):
        """Trừ thời gian của người chơi đang đến lượt"""
        if self.last_move_time is None:
            return
        
        now = time.time()
        elapsed = now - self.last_move_time
        current_turn = "white" if self.board.turn == chess.WHITE else "black"
        
        self.time_left[current_turn] -= elapsed
        self.last_move_time = now
        
        if self.time_left[current_turn] <= 0:
            self.time_left[current_turn] = 0
            return True # Trả về True nếu hết giờ
        return False

    def make_move(self, move_uci: str) -> Optional[str]:
        """Thực hiện nước đi dạng UCI (e.g., 'e2e4') nếu hợp lệ"""
        try:
            move = chess.Move.from_uci(move_uci)
            if move in self.board.legal_moves:
                # Cập nhật thời gian trước khi đổi lượt
                self.update_timer()
                
                # Thực hiện nước đi
                self.board.push(move)
                self.moves_history.append(move_uci)
                return None # Không có lỗi
            return "Nước đi không hợp lệ theo luật cờ vua"
        except ValueError:
            return "Định dạng nước đi sai quy định"

    def get_game_state(self) -> dict:
        """Trả về trạng thái hiện tại của ván đấu để gửi cho client"""
        # Xác định kết quả trận đấu nếu có
        is_over = self.board.is_game_over()
        winner = None
        reason = None
        
        if is_over:
            result = self.board.result()
            if result == "1-0":
                winner = "white"
                reason = "checkmate" if self.board.is_checkmate() else "normal"
            elif result == "0-1":
                winner = "black"
                reason = "checkmate" if self.board.is_checkmate() else "normal"
            else:
                winner = "draw"
                reason = "stalemate" if self.board.is_stalemate() else "draw"

        return {
            "fen": self.board.fen(),
            "turn": "white" if self.board.turn == chess.WHITE else "black",
            "is_check": self.board.is_check(),
            "is_over": is_over,
            "winner": winner,
            "reason": reason,
            "time_left": {
                "white": int(self.time_left["white"]),
                "black": int(self.time_left["black"])
            },
            "history": self.moves_history,
            # Sửa phần này: Lấy từ player_ids và player_usernames
            "players": [
                {
                    "player_id": self.player_ids["white"], 
                    "username": self.player_usernames["white"], 
                    "color": "white"
                },
                {
                    "player_id": self.player_ids["black"], 
                    "username": self.player_usernames["black"], 
                    "color": "black"
                }
            ]
        }