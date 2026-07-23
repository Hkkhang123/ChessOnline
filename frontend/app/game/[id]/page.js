"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Loader2, ArrowLeft, RefreshCw, Award, Timer } from "lucide-react";

export default function GamePage() {
  const { id: gameId } = useParams();
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const userRef = useRef(user);
  const [game, setGame] = useState(new Chess());
  const [gamePosition, setGamePosition] = useState("start");
  const [playerColor, setPlayerColor] = useState("white");
  const [opponentName, setOpponentName] = useState("Đang tìm...");
  const [status, setStatus] = useState("Đang kết nối phòng đấu...");
  const [connected, setConnected] = useState(false);
  const [opponentLeftMessage, setOpponentLeftMessage] = useState(null);
  const socketRef = useRef(null);
  const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Chặn người dùng chưa đăng nhập
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !gameId) return;
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    const savedColor = sessionStorage.getItem("chess_color") || "white";
    setPlayerColor(savedColor);
    if (!gameId || !token) return;

    console.log("Đang kết nối an toàn với Token hợp lệ...");
    // Kết nối và gửi kèm token qua query để khớp khai báo `token: str = None` của Backend
    socketRef.current = new WebSocket(
      `${WS_BASE_URL}/ws/game/${gameId}?token=${token}`,
    );

    socketRef.current.onopen = () => {
      console.log("Đã xác thực thành công và vào phòng đấu!");
      setConnected(true);
      setStatus("Trận đấu đang diễn ra!");
    };

    socketRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("[WS RECEIVE]:", message);
      switch (message.type) {
        case "init_state":

        case "game_update": {
          const { fen, players } = message.payload;

          if (players && Array.isArray(players)) {
            // 1. Lấy user từ userRef (tránh dính stale closure)
            const currentUser = userRef.current;
            let rawMyId =
              currentUser?.id || currentUser?.sub || currentUser?._id;

            // 2. PHƯƠNG ÁN DỰ PHÒNG: Nếu user chưa load xong, giải mã trực tiếp từ token
            if (!rawMyId && token) {
              try {
                const payload = JSON.parse(atob(token.split(".")[1]));
                rawMyId = payload.sub || payload.id;
              } catch (e) {
                console.error("Lỗi giải mã token dự phòng:", e);
              }
            }

            const myId = rawMyId ? String(rawMyId) : null;

            if (myId) {
              // Tìm thông tin của BẠN
              const me = players.find(
                (p) => String(p.player_id || p.id || p.user_id) === myId,
              );

              // Tìm thông tin của ĐỐI THỦ
              const opponent = players.find(
                (p) => String(p.player_id || p.id || p.user_id) !== myId,
              );

              if (me && me.color) {
                setPlayerColor(me.color);
              }

              if (opponent && opponent.username) {
                setOpponentName(opponent.username);
              }
            } else {
              console.warn("Không thể xác định myId từ cả user lẫn token!");
            }
          }

          if (fen) {
            const newGame = new Chess(fen);
            setGame(newGame);
            setGamePosition(newGame.fen());
          }
          break;
        }

        case "opponent_left":
          setOpponentLeftMessage(
            message.payload?.message || "Đối thủ đã rời phòng đấu!",
          );
          break;

        case "error":
          alert(`Lỗi: ${message.message}`);
          setGamePosition(game.fen());
          break;
      }
    };

    socketRef.current.onclose = (event) => {
      if (event.code === 4003) {
        alert("Lỗi bảo mật: Bạn không có quyền truy cập trận đấu này.");
      }
    };

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [gameId, token, user]);

  const onDrop = (sourceSquare, targetSquare) => {
    // 1. Kiểm tra lượt đi dựa trên màu quân cờ của bạn
    const currentTurn = game.turn() === "w" ? "white" : "black";
    if (currentTurn !== playerColor) return false;

    // Định dạng chuỗi UCI (Ví dụ: "e2e4")
    const moveUci = `${sourceSquare}${targetSquare}`;

    try {
      // 2. Khởi tạo một đối tượng Chess mới hoàn toàn từ FEN hiện tại để tránh bị lỗi bất biến (immutable)
      const newGameInstance = new Chess(game.fen());

      // 3. Thực hiện nước đi thử nghiệm trên client
      const validMove = newGameInstance.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q", // Tự động phong Hậu nếu đi Tốt xuống cuối bàn cờ
      });

      // Nếu nước đi hợp lệ theo luật cờ vua
      if (validMove) {
        // Cập nhật State bằng đối tượng mới hoàn toàn để kích hoạt React re-render giao diện
        setGame(newGameInstance);
        setGamePosition(newGameInstance.fen());

        // 4. Gửi nước đi hợp lệ này lên Backend qua WebSocket
        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.OPEN
        ) {
          socketRef.current.send(
            JSON.stringify({
              type: "move",
              payload: {
                move: moveUci,
              },
            }),
          );
        }
        return true;
      }
    } catch (error) {
      console.log("Nước đi sai luật:", error);
      return false; // Nước đi sai luật, react-chessboard sẽ tự động giật quân cờ về vị trí cũ
    }
    return false;
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const handleLeaveGame = () => {
    const confirmLeave = window.confirm(
      "Bạn có chắc chắn muốn rời trận đấu này không? Bạn sẽ bị tính là thua cuộc!",
    );
    if (confirmLeave) {
      if (
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        // Gửi tín hiệu rời phòng lên Backend
        socketRef.current.send(JSON.stringify({ type: "leave_game" }));
      }
      // Đẩy người chơi về trang chủ / sảnh
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center min-h-screen bg-gray-950 text-white p-4 gap-6">
      <div className="flex flex-col w-full max-w-[500px] gap-3">
        {/* Đối thủ */}
        <div className="flex items-center justify-between bg-gray-900 px-4 py-3 rounded-xl border border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center font-bold text-sm text-white">
              {opponentName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm">{opponentName}</p>
              <span className="text-xs text-gray-400">Đối thủ</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-mono bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-800">
            <Timer className="w-4 h-4 text-rose-400" />
            <span>10:00</span>
          </div>
        </div>

        {/* Bàn cờ */}
        <div className="aspect-square w-full rounded-2xl overflow-hidden border-4 border-gray-900 shadow-2xl">
          <Chessboard
            position={gamePosition}
            onPieceDrop={onDrop}
            boardOrientation={playerColor}
            customBoardStyle={{
              borderRadius: "0.75rem",
            }}
            customDarkSquareStyle={{ backgroundColor: "#779952" }}
            customLightSquareStyle={{ backgroundColor: "#edeed1" }}
          />
        </div>

        {/* Bạn */}
        <div className="flex items-center justify-between bg-gray-900 px-4 py-3 rounded-xl border border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center font-bold text-sm text-gray-950">
              {user.username[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm">
                {user.username}{" "}
                <span className="text-xs text-amber-500">(Bạn)</span>
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Elo: {user.elo || 1200}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-mono bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-800">
            <Timer className="w-4 h-4 text-amber-400" />
            <span>10:00</span>
          </div>
        </div>
      </div>

      {/* Bảng điều khiển bên phải */}
      <div className="w-full max-w-[350px] bg-gray-900 p-6 rounded-2xl border border-gray-800 flex flex-col justify-between min-h-[300px]">
        <div>
          <h3 className="text-xl font-bold border-b border-gray-800 pb-3 mb-4 text-amber-500 flex items-center gap-2">
            <RefreshCw
              className={`w-5 h-5 ${connected ? "animate-spin" : ""}`}
            />
            Trận đấu cờ vua
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed bg-gray-950 p-4 rounded-xl border border-gray-800">
            {status}
          </p>
          <div className="mt-4 space-y-2 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Mã trận:</span>
              <span className="font-mono text-gray-300">{gameId}</span>
            </div>
            <div className="flex justify-between">
              <span>Màu quân:</span>
              <span className="font-semibold text-amber-500">
                {playerColor === "white" ? "Trắng" : "Đen"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Lượt đi:</span>
              <span className="font-semibold text-gray-300">
                {game.turn() === "w" ? "Trắng" : "Đen"}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleLeaveGame}
          className="w-full mt-6 py-3 bg-gray-950 border border-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-800/50 hover:text-white transition flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Rời phòng về sảnh
        </button>
      </div>

      {opponentLeftMessage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Trận đấu kết thúc
            </h3>
            <p className="text-gray-300 mb-6">{opponentLeftMessage}</p>
            <button
              onClick={() => router.push("/")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              Xác nhận về sảnh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
