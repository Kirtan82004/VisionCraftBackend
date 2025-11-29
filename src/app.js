import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import os from "os";
import cluster from "cluster";

import userRouter from "./routers/user.routes.js";
import adminRouter from "./routers/admin.routes.js";
import categoryRouter from "./routers/category.routes.js";
import productRouter from "./routers/product.routes.js";

// --- Environment Setup ---
const PORT = process.env.PORT || 8000;
const totalCPUs = os.cpus().length;

if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running. Forking ${totalCPUs} workers.`);

    // Fork workers for each CPU core.
    for (let i = 0; i < totalCPUs; i++) {
        cluster.fork();
    }

    // Replace dead workers to ensure high availability
    cluster.on('exit', (worker, code, signal) => {
        console.error(`Worker ${worker.process.pid} died (Code: ${code}, Signal: ${signal}). Starting a new worker...`);
        cluster.fork();
    });
} else {
    // This code runs in every worker process and handles Express requests

    const app = express();
    
    // ====================================================================
    // Express Middleware (Standard Setup)
    // ====================================================================
    app.use(cors({
        origin:process.env.CORS_ORIGIN,
        credentials: true
    }));
    app.use(express.json({
        limit: '10mb'
    }));
    app.use(express.urlencoded({
        limit:"10mb",
        extended: true
    }));
    app.use(express.static("public"));
    app.use(cookieParser());

    // ====================================================================
    // Route Imports 
    // ====================================================================
    

    app.use("/api/v1/users", userRouter);
    app.use("/api/v1/admin", adminRouter);
    app.use("/api/v1/category", categoryRouter);
    app.use("/api/v1/products", productRouter);

    // Start the Express server for this worker process
    app.get('/cluster', (req, res) => {
        res.send(`Server is running on Worker ${process.pid}`);
    });
    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} started and listening on port ${PORT}`);
    });
}

// Export the app instance for testing or further use (only exports the worker's instance)
const app = express(); // Define app here for the export statement, though only the worker logic runs routes
export { app };
