import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { User } from "../../models/user.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { io } from "../../app.js";

// ✅ Common cookie options
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,                 // true for deployed (HTTPS)
  sameSite: isProduction ? "none" : "lax", // cross-site cookies for deployed
  maxAge: 7 * 24 * 60 * 60 * 1000      // 7 days
};

// ✅ Generate tokens
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};

// ✅ Register User
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password, phoneNo, address } = req.body;

  if ([fullName, email, password, phoneNo, address].some(f => !f || f?.trim === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({ $or: [{ email }, { phoneNo }] });
  if (existedUser) throw new ApiError(409, "User with same email or number already exists");

  let imageLocalPath;
  if (req.files?.image?.length) imageLocalPath = req.files.image[0].path;

  const image = await uploadOnCloudinary(imageLocalPath);

  const user = await User.create({ fullName, email, password, phoneNo, address, image: image?.url || "" });
  const createdUser = await User.findById(user._id).select("-password -refreshToken");

  io.emit("user", { action: "create", user: createdUser, message: `New user registered: ${createdUser._id}` });

  return res.status(201).json(new ApiResponse(200, createdUser, "User registered successfully"));
});

// ✅ Login User
const loginUser = asyncHandler(async (req, res) => {
  const { email, phoneNo, password } = req.body;
  if (!(email || phoneNo)) throw new ApiError(400, "Email or phoneNo is required");

  const user = await User.findOne({ $or: [{ email }, { phoneNo }] });
  if (!user) throw new ApiError(401, "Invalid email or phoneNo");

  const isValidPassword = await user.isPasswordCorrect(password);
  if (!isValidPassword) throw new ApiError(401, "Invalid password");

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
  const loggedUser = await User.findById(user._id).select("-password -refreshToken");

  // ✅ Set cookies
  res.cookie("accessToken", accessToken, cookieOptions);
  res.cookie("refreshToken", refreshToken, cookieOptions);

  return res.status(200).json(new ApiResponse(200, { user: loggedUser, accessToken, refreshToken }, "User logged in successfully"));
});

// ✅ Logout User
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });

  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  return res.status(200).json(new ApiResponse(200, {}, "User logged out successfully"));
});

// ✅ Refresh Token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

  const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  const user = await User.findById(decoded?._id);
  if (!user) throw new ApiError(401, "Invalid refresh token");
  if (incomingRefreshToken !== user.refreshToken) throw new ApiError(401, "Refresh token expired or used");

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

  res.cookie("accessToken", accessToken, cookieOptions);
  res.cookie("refreshToken", refreshToken, cookieOptions);

  return res.status(200).json(new ApiResponse(200, { accessToken, refreshToken }, "Access token refreshed successfully"));
});
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
// ✅ Other controllers (change password, update account, update image, get current user) remain same
// Just make sure auth middleware uses:
// const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  UpdateAccountDetail,
  updateUserImage,
  getCurrentUser
};
