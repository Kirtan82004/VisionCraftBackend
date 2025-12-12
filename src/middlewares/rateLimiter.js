import rateLimit from "express-rate-limit";


export const apiRateLimiter = rateLimit({
   windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // allow 100 requests per window per IP
  message: {
    status: 429,
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable the deprecated X-RateLimit-* headers
})