import { asyncHandler } from "../../utils/asyncHandler.js"
import { ApiError } from "../../utils/ApiError.js"
import { User } from "../../models/user.model.js"
import { uploadOnCloudinary } from "../../utils/cloudinary.js"
import { ApiResponse } from "../../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import { ioInstance } from "../../index.js";



const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken,
            await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "somthing went wrong while generating refersh and access token")

    }

}

const registerUser = asyncHandler(async (req, res) => {
    console.log("body data", req.body)

    const { fullName, email, password, phoneNo, address, role } = req.body;

    [fullName, email, password, phoneNo, address, role].some(
        (field) => !field || field?.trim() === "")


    const normalizeEmail = email.toLowerCase().trim();

    const existedUser = await User.findOne({
        $or: [{ email: normalizeEmail }]
    }
    )
    if (existedUser) {
        const conflictField = existedUser.email === normalizeEmail ? "email" : "phone number";
        throw new ApiError(409, `User with same ${conflictField} exists`);
    }

    console.log(req.files)
    // const coverImagePath = req.files?.coverImage[0]?.path;
    let imageLocalPath;
    if (req.files && Array.isArray(req.files.image) && req.files.image.length > 0) {
        imageLocalPath = req.files.image[0].path

    }
    console.log(imageLocalPath)

    const image = await uploadOnCloudinary(imageLocalPath)


    const user = await User.create({
        fullName,
        email,
        password,
        phoneNo,
        address,
        image: image?.url || "",
        role: role || "user"
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    if (role === "admin") {
        const createdUser = await User.findById(user._id).select(
            "-phoneNo -image -password -refreshToken -oredrHistory -wishlist -cart"
        )

        if (ioInstance) {
            ioInstance.emit("userRegistered", createdUser);
        }


        return res.status(201).json(
            new ApiResponse(200, createdUser, "admin registered Successfully")
        )
    }
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )



}
)

const loginUser = asyncHandler(async (req, res) => {
    const { email, phoneNo, password } = req.body
    if (!(email || phoneNo)) {
        throw new ApiError(400, "Email and phoneNo is required")

    }

    const user = await User.findOne({
        $or: [{ email }, { phoneNo }]
    })

    if (!user) {
        throw new ApiError(401, "Invalid email or phoneNo")
    }
    const isValidPassword = await user.isPasswordCorrect(password)
    if (!isValidPassword) {
        throw new ApiError(401, "Invalid password")
    }
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    if (user.role === "admin") {
        const loggedAdmin = await User.findById(user._id).select("-password -refreshToken -oredrHistory -wishlist -cart")
        const options = {
            httpOnly: true,
            secure: true
        }
        console.log("loggedAdmin", loggedAdmin)
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(new ApiResponse(200,
                {
                    user: loggedAdmin,
                    accessToken,
                    refreshToken
                }, "admin logged in successfully")
            )
    }
    const loggedUser = await User.findById(user._id).
        select("-password -refreshToken")
    const options = {
        httpOnly: true,
        secure: true
    }
    console.log("loggedUser", loggedUser)
    if (ioInstance) {
        ioInstance.emit("userLoggedIn", { userId: user._id, role: user.role });
    }


    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200,
            {
                user: loggedUser, accessToken,
                refreshToken
            }, "user logged in successfully")
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    console.log("logout user called")
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1,
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: false,
        sameSite: "None"
    }
    if (ioInstance) {
        ioInstance.emit("userLoggedOut", { userId: req.user._id });
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "user logged out successfully"))


})

const refreshAccessToken = asyncHandler(async (req, res) => {

    try {

        const incomingRefreshToken = req.cookies.refreshToken;
        if (!incomingRefreshToken) {
            throw new ApiError(401, "unauthorizes request")
        }
        const decodedToken = jwt.verify(
            incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
        const options = {
            httpOnly: true,
            secure: true
        }
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id)
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "access token generated successfully"))

    } catch (error) {
        throw new ApiError(401, "Error ocured while refershig token")

    }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body
        const user = await User.findById(req.user._id)
        if (!user) {
            throw new ApiError(404, "User not found")
        }

        const isValidPassword = await user.isPasswordCorrect(oldPassword)
        if (!isValidPassword) {
            throw new ApiError(401, "Invalid old password")
        }
        user.password = newPassword
        await user.save({ validateBeforeSave: false })
        return res
            .status(200)
            .json(new ApiResponse(200, {}, "Password changed successfully"))
    } catch (error) {

    }
})
const UpdateAccountDetail = asyncHandler(async (req, res) => {
    const { fullName, email, address, phoneNo } = req.body
    console.log(fullName)
    console.log(email)
    console.log(address)
    console.log(phoneNo)
    if (!(fullName || email || address || phoneNo)) {
        throw new ApiError(400, "Allfield are required")
    }
    const user = await User.findByIdAndUpdate(req.user._id,
        {
            $set: {
                fullName,
                email,
                address,
                phoneNo
            }
        },
        { new: true }
    ).select("-password")
    await user.save({ validateBeforeSave: false });
    if (ioInstance) {
        ioInstance.emit("userUpdated", user);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"))
})
const updateUserImage = asyncHandler(async (req, res) => {
    const localImagePath = req.file?.path
    console.log("localImagePath", localImagePath)

    if (!localImagePath) {
        throw new ApiError(400, "Please upload an image")
    }
    const image = await uploadOnCloudinary(localImagePath)
    console.log("image", image)
    if (!image) {
        throw new ApiError(400, "Erroe while uploading image")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                image: image
            }
        },
        {
            new: true
        }
    ).select("-password")
    if (ioInstance) {
        ioInstance.emit("userImageUpdated", user);
    }
    return res
        .status(200)
        .json(new ApiResponse(200, user, "User image updated successfully"))

})
const getCurrentUser = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password")
        return res
            .status(200)
            .json(new ApiResponse(200, user, "User data"))

    } catch (error) {
        throw new ApiError(404, "Error while fetching current user data")
    }
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    UpdateAccountDetail,
    updateUserImage,
    getCurrentUser


}