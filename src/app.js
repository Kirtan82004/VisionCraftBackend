import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import http from "http"
import {Server as socketIo } from "socket.io"; 


const app = express()
const server = http.createServer(app);
const io = new socketIo(server);

io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);
  
    // Notification Event
    socket.emit("notification", "Welcome! You have a new notification.");
  
    // place order 
    socket.on("placeOrder", (data) => {
        console.log("order placed:",data);
        io.emit("orderPlaced", data);
    })
    // cancel order
    socket.on("cancelOrder", (data) => {
        console.log("order cancelled:",data);
        io.emit("orderCancelled", data);
    })
       // Order Status Update Event
       socket.on("orderStatus", (orderData) => {
        console.log("Order Update Received:", orderData);
        io.emit("orderUpdate", orderData); // Broadcast to all users
      });
    // create user
    socket.on("createUser", (data) => {
        console.log("user created:",data);
        io.emit("userCreated", data);
    })
    // update user
    socket.on("updateUser", (data) => {
        console.log("user updated:",data);
        io.emit("userUpdated", data);
    })
    // create product
    socket.on("createProduct", (data) => {
        console.log("product created:",data);
        io.emit("productCreated", data);
    })
    // update product
    socket.on("updateProduct", (data) => {
        console.log("product updated:",data);
        io.emit("productUpdated", data);
    })
    // delete product
    socket.on("deleteProduct", (data) => {
        console.log("product deleted:",data);
        io.emit("productDeleted", data);
    })
 
  
    // Real-time Chat
    socket.on("sendMessage", (messageData) => {
      console.log("Message from Client:", messageData);
      io.emit("receiveMessage", messageData); // Broadcast message
    });
  
    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
});
app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json({
    limit: '10mb'
}))
app.use(express.urlencoded({
    limit:"10mb",
    extended: true
}))
app.use(express.static("public"))
app.use(cookieParser())


import userRouter from "./routers/user.routes.js"
import adminRouter from "./routers/admin.routes.js"
import categoryRouter from "./routers/category.routes.js"
import productRouter from "./routers/product.routes.js"


app.use("/api/v1/users", userRouter);
app.use("/api/v1/admin",adminRouter);
app.use("/api/v1/category",categoryRouter);
app.use("/api/v1/products",productRouter);

export { app, io }; 