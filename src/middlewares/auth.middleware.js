import {ApiError} from "../utils/ApiError.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";


export const verifyJWT = asyncHandler(async(req,res,next)=>{
    try {
        //console.log("user",req)
        
        const token = req.cookies?.accessToken||req.get("Authorization")?.replace("Bearer ", "");
         console.log("token",token)
        if(!token) {
           
            throw new ApiError(401,"Unathorized request")
        }
        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id).select(
            "-password -refreshToken"
        )
    
        if(!user){
            throw new ApiError(401,"invalid accessToken")
        }
        req.user = user;
        next()
    } catch (error) {
        console.log(error)
        throw new ApiError(401,error?.message || "invalid access token")
    }

})
