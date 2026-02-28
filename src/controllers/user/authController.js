import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { User } from "../../models/user.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import { getIO } from "../../config/socket.js";

/* ================= TOKENS ================= */
const generateAccessAndRefreshToken = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

/* ================= REGISTER ================= */
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password, phoneNo, address, role } = req.body;

  if (![fullName, email, password, phoneNo, address].every(Boolean)) {
    throw new ApiError(400, "All fields are required");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existedUser = await User.findOne({ email: normalizedEmail });
  if (existedUser) throw new ApiError(409, "Email already exists");

  let imageUrl = "";
  if (req.files?.image?.[0]?.path) {
    const image = await uploadOnCloudinary(req.files.image[0].path);
    imageUrl = image?.url || "";
  }

  const user = await User.create({
    fullName,
    email: normalizedEmail,
    password,
    phoneNo,
    address,
    image: imageUrl,
    role: role || "user",
  });

  const safeUser = await User.findById(user._id).select("-password -refreshToken");

  if (user.role === "admin") {
    getIO().to("admin-room").emit("adminRegistered", {
      adminId: user._id,
      email: user.email,
    });
  }

  return res.status(201).json(
    new ApiResponse(201, safeUser, "User registered successfully")
  );
});

/* ================= LOGIN ================= */
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!password || !email) throw new ApiError(400, "Credentials required");

  const user = await User.findOne({ $or: [{ email }] });
  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
  const safeUser = await User.findById(user._id).select("-password -refreshToken");

  if (user.role !== "admin") {
    getIO().to("admin-room").emit("userLoggedIn", { userId: user._id, email: user.email });
  }

  const cookieOptions = { httpOnly: true, secure: true };

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, {
      safeUser,
      accessToken,
      refreshToken
    }, "Login successful"));
});

/* ================= LOGOUT ================= */
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });

  getIO().to("admin-room").emit("userLoggedOut", { userId: req.user._id });

  const options = { httpOnly: true, secure: true, sameSite: "None" };

  return res
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

/* ================= REFRESH TOKEN ================= */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies.refreshToken;
  if (!incomingToken) throw new ApiError(401, "Unauthorized");

  const decoded = jwt.verify(incomingToken, process.env.REFRESH_TOKEN_SECRET);
  const user = await User.findById(decoded._id);

  if (!user || user.refreshToken !== incomingToken) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
  const options = { httpOnly: true, secure: true, sameSite: "None" };

  return res
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, { accessToken }, "Token refreshed"));
});

/* ================= UPDATE PROFILE ================= */
const UpdateAccountDetail = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $set: req.body }, { new: true }).select("-password");

  getIO().to("admin-room").emit("userUpdated", { userId: user._id });

  return res.json(new ApiResponse(200, user, "Profile updated"));
});

/* ================= CHANGE PASSWORD ================= */
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) throw new ApiError(400, "Both old and new passwords are required");

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "User not found");

  const isMatch = await user.isPasswordCorrect(oldPassword);
  if (!isMatch) throw new ApiError(401, "Old password is incorrect");

  user.password = newPassword;
  await user.save();

  getIO().to("admin-room").emit("userPasswordChanged", { userId: user._id });

  return res.status(200).json(new ApiResponse(200, null, "Password changed successfully"));
});

/* ================= IMAGE ================= */
const updateUserImage = asyncHandler(async (req, res) => {
  if (!req.file?.path) throw new ApiError(400, "Image required");

  const image = await uploadOnCloudinary(req.file.path);
  const user = await User.findByIdAndUpdate(req.user._id, { image: image.url }, { new: true }).select("-password");

  getIO().to("admin-room").emit("userImageUpdated", { userId: user._id });

  return res.json(new ApiResponse(200, user, "Image updated"));
});

/* ================= CURRENT USER ================= */
const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");

  const data = user.role === "admin"
    ? { fullName: user.fullName, email: user.email, role: user.role, image: user.image }
    : user;

  return res.json(new ApiResponse(200, data, "User data"));
});

/* ================= EXPORT ================= */
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  UpdateAccountDetail,
  updateUserImage,
  getCurrentUser,
  changePassword,
};
