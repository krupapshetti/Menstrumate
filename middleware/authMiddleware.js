const jwt = require("jsonwebtoken");

const SECRET =
  process.env.JWT_SECRET || "menstrumate-dev-secret";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: "Login required"
    });
  }

  try {
    req.auth = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({
      error: "Invalid or expired session"
    });
  }
}

function requireDoctor(req, res, next) {
  if (req.auth?.role !== "doctor") {
    return res.status(403).json({
      error: "Doctor access required"
    });
  }

  next();
}

module.exports = {
  requireAuth,
  requireDoctor
};