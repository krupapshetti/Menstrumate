function requireFields(body, fields) {
  const missing = fields.filter(
    (field) => !String(body[field] || "").trim()
  );

  return missing.length
    ? `${missing.join(", ")} required`
    : null;
}

module.exports = {
  requireFields
};