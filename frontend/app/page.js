"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Swords, Loader2, LogOut, User } from "lucide-react";

export default function HomePage() {
  const { user, logout, loading } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [status, setStatus] = useState("");
  const socketRef = useRef(null);
  const router = useRouter();
  const { token } = useAuth();
  const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
  const toggleMatchmaking = () => {
    if (isSearching) {
      if (socketRef.current) socketRef.current.close();
      setIsSearching(false);
      setStatus("Đã hủy tìm trận.");
    } else {
      setIsSearching(true);
      setStatus("Đang kết nối đến hàng đợi...");

      socketRef.current = new WebSocket(
        `${WS_BASE_URL}/ws/queue?token=${token}`,
      );

      socketRef.current.onopen = () => {
        setStatus("Đang tìm kiếm đối thủ...");
      };

      socketRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "match_found") {
          setStatus("Đã tìm thấy trận đấu! Đang chuyển hướng...");
          sessionStorage.setItem("chess_color", message.payload.color);
          setTimeout(() => {
            router.push(`/game/${message.payload.game_id}`);
          }, 1000);
        }
      };

      socketRef.current.onclose = () => {
        setIsSearching(false);
      };

      socketRef.current.onerror = () => {
        setStatus("Lỗi kết nối đến server.");
        setIsSearching(false);
      };
    }
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4">
      {/* Thanh công cụ góc trên bên phải khi đã đăng nhập */}
      {user && (
        <div className="absolute top-4 right-4 flex items-center gap-4 bg-gray-900 px-4 py-2 rounded-xl border border-gray-800 shadow-md">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <User className="w-4 h-4 text-amber-500" />
            <span>{user.username}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 px-2 py-1 rounded-lg border border-rose-900/30 transition"
          >
            <LogOut className="w-3 h-3" />
            Đăng xuất
          </button>
        </div>
      )}

      <div className="text-center max-w-md w-full bg-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-800">
        <h1 className="text-4xl font-extrabold mb-2 tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
          CHESS ONLINE
        </h1>
        <p className="text-gray-400 mb-8 text-sm">
          Hệ thống đấu cờ vua thời gian thực
        </p>

        {user ? (
          /* Giao diện khi ĐÃ đăng nhập: Cho phép tìm trận */
          <>
            <div className="flex justify-center mb-8">
              <div
                className={`p-6 rounded-full bg-gray-800 border-2 ${isSearching ? "border-amber-500 animate-pulse" : "border-gray-700"}`}
              >
                <Swords
                  className={`w-16 h-16 ${isSearching ? "text-amber-400" : "text-gray-500"}`}
                />
              </div>
            </div>

            <button
              onClick={toggleMatchmaking}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg tracking-wide transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
                isSearching
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/20"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-gray-950 shadow-orange-950/20"
              }`}
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  HỦY TÌM TRẬN
                </>
              ) : (
                "TÌM TRẬN NGAY"
              )}
            </button>

            {status && (
              <p className="mt-6 text-sm text-amber-400 font-medium bg-gray-950/50 py-2 px-4 rounded-lg inline-block">
                {status}
              </p>
            )}
          </>
        ) : (
          /* Giao diện khi CHƯA đăng nhập: Hiển thị điều hướng */
          <div className="space-y-4 py-4">
            <p className="text-gray-400 text-sm mb-4">
              Vui lòng đăng nhập hoặc tạo tài khoản mới để bắt đầu tham gia hàng
              đợi tìm kiếm trận đấu.
            </p>

            <Link
              href="/login"
              className="block w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-gray-950 font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition text-center shadow-md shadow-orange-950/20"
            >
              ĐĂNG NHẬP
            </Link>

            <Link
              href="/register"
              className="block w-full py-3 bg-gray-950 border border-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-800/50 hover:text-white transition text-center"
            >
              ĐĂNG KÝ TÀI KHOẢN
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
