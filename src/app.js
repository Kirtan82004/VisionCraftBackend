import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";

import userRouter from "./routers/user.routes.js";
import adminRouter from "./routers/admin.routes.js";
import categoryRouter from "./routers/category.routes.js";
import productRouter from "./routers/product.routes.js";


function createApp() {
  const app = express();
  app.use(compression());

  app.use(cors({
    origin: process.env.CORS_ORIGIN || "https://vision-craft-opal.vercel.app",
    methods: ["GET", "POST", "OPTIONS"],   // allow polling + websocket upgrade
    allowedHeaders: ["Content-Type", "Authorization"], 
    credentials: true,
  }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use(express.static("public"));
  app.use(cookieParser());

  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/category", categoryRouter);
  app.use("/api/v1/products", productRouter);

  return app;
}


export { createApp };

