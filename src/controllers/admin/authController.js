import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { Admin } from "../../models/admin.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async (adminId)=>{
    try {
        console.log(adminId)
        const admin = await Admin.findById(adminId)
        const accessToken = admin.generateAccessToken()
        const refreshToken = admin.generateRefreshToken()
        admin.refreshToken = refreshToken,
        await admin.save({validateBeforeSave:false})

        return {accessToken,refreshToken}
    } catch (error ) {
        throw new ApiError(500, "somthing went wrong while generating refersh and access token")
        
    }

}
const registerAdmin = asyncHandler(async (req, res) => {
  console.log(req.body)
    const { fullName, email, password, secretKey } = req.body;

    if (
        [fullName, email, password, secretKey].some(
            (field) => !field || field.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    const existedAdmin = await Admin.findOne({
        $or: [{ email }],
    });

    if (existedAdmin) {
        throw new ApiError(409, "Admin with the same email already exists");
    }

    if (secretKey !== process.env.ADMIN_ACCESS_KEY) {
        throw new ApiError(403, "Invalid secret key");
    }

    const newAdmin = await Admin.create({
        fullName,
        email,
        password,
    });

    const createdAdmin = await Admin.findById(newAdmin._id).select(
        "-password -refreshToken"
    );

    if (!createdAdmin) {
        throw new ApiError(500, "Something went wrong while registering the admin");
    }
    

    const respone = new ApiResponse(201,createdAdmin,"Admin registered successfully")
  
    return res.status(201).json(respone);
});
const loginAdmin = asyncHandler(async(req,res)=>{
    console.log(req.body)
    const {email,password}=req.body
    if(!email){
        throw new ApiError(400,"Email and password are required")
    }
    const admin=await Admin.findOne({email})
    if(!admin){
        throw new ApiError(404,"Admin not found")
    }
    const isValidPassword = await admin.isPasswordCorrect(password)
    if(!isValidPassword){
        throw new ApiError(401,"Invalid password")
    }
    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(admin._id)
    console.log(accessToken,refreshToken)

    const loggedAdmin = await Admin.findById(admin._id).select(
        "-password -refreshToken"
    )
    const options = {
        httpOnly:true,
        secure:true
    }
    return res
   .status(200)
   .cookie("accessToken",accessToken, options)
    .cookie("refreshToken",refreshToken, options)
    .json(new ApiResponse(200,
        {
            admin:loggedAdmin,accessToken,
            refreshToken
        } , "admin logged in successfully")
    )
    
})

const logoutAdmin = asyncHandler(async(req,res)=>{
    console.log(req.admin._id)
    const refreshToken = req.cookies.refreshToken
    console.log(req.cookies)
    await Admin.findByIdAndUpdate(
        req.admin._id,
        {
            $unset:{
                refreshToken: 1,
            }
        },
        {
            new:true
        }
    )
    const options = {
        httpOnly:true,
        secure:true
    }
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"Aadmin logged out successfully"))


})
const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incommingrefreshToken = req.cookies.refreshToken
    if(!incommingrefreshToken){
        throw new ApiError(401,"Unotherized request")
    }
    const decodedToken = jwt.verify(incommingrefreshToken,process.env.REFRESH_TOKEN_SECRET)
    if(!decodedToken){
        throw new ApiError(401,"not get the decoded token")
    }
    const admin = await Admin.findById(decodedToken?._id)
    if(!admin){
        throw new ApiError(401,"Admin not found")
    }
    if(incommingrefreshToken!==admin?.refreshToken){
        throw new ApiError(401,"refresh token not match")
    }
    const {accessToken,newRefreshToken}= await generateAccessAndRefreshToken(admin._id)
    const options = {
        httpOnly:true,
        secure:true
    }
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json(new ApiResponse(200,{accessToken,refreshToken:newRefreshToken},"Access token generated successfully"))



})
const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body
    const admin = await Admin.findById(req.admin._id)
    if(!admin){
        throw new ApiError(404,"Admin not found")
    }
    const isMatch = await admin.isPasswordCorrect(oldPassword)
    if(!isMatch){
        throw new ApiError(401,"Old password is incorrect")
    }
    admin.password = newPassword
    await admin.save({validateBeforeSave:false})
    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))

})
const getCurrentAdmin = asyncHandler(async(req,res)=>{
    const admin = await Admin.findById(req.admin._id).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200,admin,"Admin data"))

})
const UpdateAccountDetail =asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body
    if(!fullName ||!email){
        throw new ApiError(400,"Please fill all fields")

    }
    const admin = await Admin.findByIdAndUpdate(req.admin._id,
        {
            $set:{
                fullName,
                email
            }
        },{
            new:true
        }
    ).select("-password -refreshToken")
    return res
    .status(200)
    .json(new ApiResponse(200,admin,"Admin account updated successfully"))

})
export { 
    registerAdmin,
    loginAdmin,
    logoutAdmin,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentAdmin,
    UpdateAccountDetail
 };
