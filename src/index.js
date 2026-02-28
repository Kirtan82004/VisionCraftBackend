import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { createApp } from "./app.js";
import http from "http";
import { Server } from "socket.io";
import { initSocket } from "./config/socket.js";

dotenv.config({ path: "./env" });

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    console.log("✅ MongoDB connected successfully");

    const app = createApp();
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    // 🔥 Initialize socket globally
    initSocket(io);

    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);

      // 🔐 Admin joins admin-room
      socket.on("join-admin", () => {
        socket.join("admin-room");
        socket.join(`user-${userId}`)
        console.log("Admin joined admin-room");
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
      });
    });

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });
