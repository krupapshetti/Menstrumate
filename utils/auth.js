const jwt = require("jsonwebtoken");

const SECRET =
  process.env.JWT_SECRET || "menstrumate-dev-secret";

function publicAccount(account) {
  const { passwordHash, ...safe } = account;
  return safe;
}

function publicDoctor(doctor) {
  const safe = publicAccount(doctor);

  return {
    ...safe,
    isOnline: Boolean(safe.isOnline),
    lastSeen: safe.lastSeen || null,

    initials:
      String(safe.name || "DR")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "DR"
  };
}

// 🔥 FIXED: role is ALWAYS taken from account (DB), not from parameter
function createToken(account) {
  return jwt.sign(
    {
      id: account.id,
      role: account.role,   // ✅ correct source of truth
      email: account.email
    },
    SECRET,
    { expiresIn: "1d" }
  );
}

module.exports = {
  publicAccount,
  publicDoctor,
  createToken
};