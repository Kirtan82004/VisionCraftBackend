import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { createApp } from "./app.js";
import http from "http";
import { Server } from "socket.io";

dotenv.config({ path: "./env" });

const PORT = process.env.PORT || 4000;
let ioInstance = null;

connectDB()
  .then(() => {
    console.log("✅ MongoDB connected successfully");

    const app = createApp();
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "https://vision-craft-eight.vercel.app",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      // Example event
      socket.on("message", (data) => {
        console.log("Message received:", data);
        io.emit("message", data); // broadcast to all clients
      });
    });

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    ioInstance = io;
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });


export { ioInstance };

