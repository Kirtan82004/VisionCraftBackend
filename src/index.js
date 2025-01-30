
import connectDB from "./db/index.js";
import dotenv from "dotenv";
import app from "./app.js";

dotenv.config({
    path:"./env"
})

connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.error("error",error);
        throw error;
    })
    app.listen(process.env.PORT || 3000 ,()=>{
        console.log(`'server is running at :'${process.env.PORT}`)
    })

})
.catch((err)=>{
    console.log("MONGODB CONNECTION FAILED !!",err);
});