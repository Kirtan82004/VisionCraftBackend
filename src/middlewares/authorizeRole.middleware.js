export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role; // assume req.user set by auth middleware

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Access Denied: Unauthorized Role" });
    }
    next();
  };
};