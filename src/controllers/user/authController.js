import { asyncHandler } from "../../utils/asyncHandler.js"
import { ApiError } from "../../utils/ApiError.js"
import { User } from "../../models/user.model.js"
import { uploadOnCloudinary } from "../../utils/cloudinary.js"
import { ApiResponse } from "../../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import { io } from "../../app.js"

// 🔑 Common cookie options
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", 
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax"
}

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, password, phoneNo, address } = req.body;

    if ([fullName, email, password, phoneNo, address].some((field) => !field || field?.trim === "")) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ email }, { phoneNo }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with same email or number already exists")
    }

    let imageLocalPath;
    if (req.files && Array.isArray(req.files.image) && req.files.image.length > 0) {
        imageLocalPath = req.files.image[0].path
    }

    const image = await uploadOnCloudinary(imageLocalPath)

    const user = await User.create({
        fullName,
        email,
        password,
        phoneNo,
        address,
        image: image?.url || "",
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    io.emit("user", {
        action: "create",
        user: createdUser,
        message: `New user registered with user id ${createdUser._id}`
    })

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(new ApiResponse(200, createdUser, "User registered Successfully"))
})

const loginUser = asyncHandler(async (req, res) => {
    const { email, phoneNo, password } = req.body
    if (!(email || phoneNo)) {
        throw new ApiError(400, "Email or phoneNo is required")
    }

    const user = await User.findOne({
        $or: [{ email }, { phoneNo }]
    })

    if (!user) throw new ApiError(401, "Invalid email or phoneNo")

    const isValidPassword = await user.isPasswordCorrect(password)
    if (!isValidPassword) throw new ApiError(401, "Invalid password")

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedUser = await User.findById(user._id).select("-password -refreshToken")

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new ApiResponse(200,
            { user: loggedUser, accessToken, refreshToken },
            "User logged in successfully"
        ))
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } }, { new: true })

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies.refreshToken;
        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized request")
        }

        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id)

        if (!user) throw new ApiError(401, "Invalid refresh token")
        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json(new ApiResponse(200, { accessToken, refreshToken }, "Access token generated successfully"))
    } catch (error) {
        throw new ApiError(401, "Error occurred while refreshing token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body
    const user = await User.findById(req.user._id)
    if (!user) throw new ApiError(404, "User not found")

    const isValidPassword = await user.isPasswordCorrect(oldPassword)
    if (!isValidPassword) throw new ApiError(401, "Invalid old password")

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"))
})

const UpdateAccountDetail = asyncHandler(async (req, res) => {
    const { fullName, email, address, phoneNo } = req.body
    if (!(fullName || email || address || phoneNo)) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(req.user._id,
        { $set: { fullName, email, address, phoneNo } },
        { new: true }
    ).select("-password")

    await user.save({ validateBeforeSave: false })

    io.emit("user", {
        action: "update",
        user: user,
        message: `User ${user._id} updated successfully`
    })

    return res.status(200).json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserImage = asyncHandler(async (req, res) => {
    const localImagePath = req.file?.path
    if (!localImagePath) throw new ApiError(400, "Please upload an image")

    const image = await uploadOnCloudinary(localImagePath)
    if (!image) throw new ApiError(400, "Error while uploading image")

    const user = await User.findByIdAndUpdate(req.user?._id,
        { $set: { image: image } },
        { new: true }
    ).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "User image updated successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("-password")
    return res.status(200).json(new ApiResponse(200, user, "User data"))
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
