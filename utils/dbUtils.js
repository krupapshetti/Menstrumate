// Import seed data
const {
  seedProducts,
  seedYoga,
  seedEducation,
  seedNotifications,
  seedSymptomOptions,
  seedInsightRules,
  seedAppointmentSlots,
  seedShopRules
} = require("../data/seeds");

// Default database structure
const defaultDb = {
  users: [],
  doctors: [],
  otps: [],
  carts: {},
  payments: [],
  cycles: {},
  patientMessages: [],
  patientRecommendations: [],
  followUps: [],
  activityLogs: {},
  chats: [],
  symptoms: [],
  appointments: [],
  products: seedProducts,
  yoga: seedYoga,
  education: seedEducation,
  notifications: seedNotifications,
  symptomOptions: seedSymptomOptions,
  insightRules: seedInsightRules,
  appointmentSlots: seedAppointmentSlots,
  shopRules: seedShopRules
};

/**
 * Normalize database object - ensures all required fields exist with correct types
 * @param {Object} parsed - Partial database object
 * @returns {Object} - Normalized database object
 */
function normalizeDb(parsed = {}) {
  const db = { ...defaultDb, ...parsed };
  
  // Ensure arrays
  db.users = Array.isArray(db.users) ? db.users : [];
  db.doctors = Array.isArray(db.doctors) ? db.doctors : [];
  db.otps = Array.isArray(db.otps) ? db.otps : [];
  db.payments = Array.isArray(db.payments) ? db.payments : [];
  db.patientMessages = Array.isArray(db.patientMessages) ? db.patientMessages : [];
  db.patientRecommendations = Array.isArray(db.patientRecommendations) ? db.patientRecommendations : [];
  db.followUps = Array.isArray(db.followUps) ? db.followUps : [];
  db.chats = Array.isArray(db.chats) ? db.chats : [];
  db.symptoms = Array.isArray(db.symptoms) ? db.symptoms : [];
  db.appointments = Array.isArray(db.appointments) ? db.appointments : [];
  
  // Ensure objects
  db.carts = db.carts && typeof db.carts === "object" ? db.carts : {};
  db.cycles = db.cycles && typeof db.cycles === "object" ? db.cycles : {};
  db.activityLogs = db.activityLogs && typeof db.activityLogs === "object" ? db.activityLogs : {};
  
  // Normalize products - ensure they exist
  db.products = Array.isArray(db.products) && db.products.length ? db.products : seedProducts;
  
  // Normalize yoga - merge with seed data to ensure all fields exist
  db.yoga = Array.isArray(db.yoga) && db.yoga.length
    ? db.yoga.map((pose) => ({ 
        ...(seedYoga.find((item) => item.id === pose.id) || {}), 
        ...pose 
      }))
    : seedYoga;
  
  // Normalize content collections
  db.education = Array.isArray(db.education) && db.education.length ? db.education : seedEducation;
  db.notifications = Array.isArray(db.notifications) && db.notifications.length ? db.notifications : seedNotifications;
  db.symptomOptions = Array.isArray(db.symptomOptions) && db.symptomOptions.length ? db.symptomOptions : seedSymptomOptions;
  db.insightRules = Array.isArray(db.insightRules) && db.insightRules.length ? db.insightRules : seedInsightRules;
  db.appointmentSlots = Array.isArray(db.appointmentSlots) && db.appointmentSlots.length ? db.appointmentSlots : seedAppointmentSlots;
  db.shopRules = Array.isArray(db.shopRules) && db.shopRules.length ? db.shopRules : seedShopRules;
  
  // Normalize symptoms
  db.symptoms = db.symptoms.map((entry) => ({
    ...entry,
    sharedWithDoctor: Boolean(entry.sharedWithDoctor)
  }));
  
  // Normalize chats - ensure typing object exists
  db.chats = db.chats.map((chat) => ({
    ...chat,
    typing: chat.typing && typeof chat.typing === "object" ? chat.typing : {}
  }));
  
  // Normalize users
  db.users = db.users.map((user) => ({ 
    ...user, 
    role: "user",
    isFirstLogin: Boolean(user.isFirstLogin)
  }));
  
  // Normalize doctors
  db.doctors = db.doctors.map((doctor) => ({
    ...doctor,
    role: "doctor",
    isOnline: Boolean(doctor.isOnline),
    specialty: doctor.specialty || doctor.specialization || "Gynecology",
    specialization: doctor.specialization || doctor.specialty || "Gynecology",
    lastSeen: doctor.lastSeen || doctor.createdAt || null
  }));
  
  return db;
}

/**
 * Remove MongoDB specific fields from a document
 * @param {Object} doc - MongoDB document
 * @returns {Object} - Cleaned document without _id and __v
 */
function stripMongo(doc) {
  if (!doc) return doc;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete plain._id;
  delete plain.__v;
  return plain;
}

/**
 * Convert array of documents to object keyed by a field
 * @param {Array} docs - Array of documents
 * @param {string} keyField - Field to use as key
 * @param {string} valueField - Field to use as value
 * @returns {Object} - Object with keys from keyField and values from valueField
 */
function objectFromKeyedDocs(docs, keyField, valueField) {
  return docs.reduce((result, doc) => {
    const item = stripMongo(doc);
    result[item[keyField]] = item[valueField] || [];
    return result;
  }, {});
}

/**
 * Convert object to array of documents with key and value fields
 * @param {Object} objectValue - Object to convert
 * @param {string} keyField - Name for the key field
 * @param {string} valueField - Name for the value field
 * @returns {Array} - Array of documents
 */
function keyedArrayDocs(objectValue, keyField, valueField) {
  return Object.entries(objectValue || {}).map(([key, value]) => ({
    [keyField]: key,
    [valueField]: Array.isArray(value) ? value : []
  }));
}

/**
 * Validate and sanitize email
 * @param {string} email - Email to validate
 * @returns {string} - Sanitized email
 */
function sanitizeEmail(email) {
  if (!email) return "";
  return String(email).toLowerCase().trim();
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} date - Date string
 * @returns {boolean} - True if valid
 */
function isValidDate(date) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;
  const d = new Date(date);
  return d instanceof Date && !isNaN(d);
}

/**
 * Generate a unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string} - Unique ID
 */
function generateId(prefix = "") {
  const timestamp = Date.now();
  const random = Math.random().toString(16).slice(2, 10);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} - Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge two objects deeply
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} - Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Paginate an array
 * @param {Array} items - Array to paginate
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} - Paginated result
 */
function paginate(items, page = 1, limit = 20) {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  return {
    items: items.slice(startIndex, endIndex),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
      hasNext: endIndex < items.length,
      hasPrev: startIndex > 0
    }
  };
}

/**
 * Filter items by date range
 * @param {Array} items - Items with date field
 * @param {string} dateField - Field name containing date
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array} - Filtered items
 */
function filterByDateRange(items, dateField, startDate, endDate) {
  let filtered = [...items];
  
  if (startDate) {
    filtered = filtered.filter(item => item[dateField] >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter(item => item[dateField] <= endDate);
  }
  
  return filtered;
}

/**
 * Sort items by field
 * @param {Array} items - Items to sort
 * @param {string} sortBy - Field to sort by
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} - Sorted items
 */
function sortItems(items, sortBy = "createdAt", order = "desc") {
  const sorted = [...items];
  const multiplier = order === "desc" ? -1 : 1;
  
  return sorted.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    
    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });
}

module.exports = {
  defaultDb,
  normalizeDb,
  stripMongo,
  objectFromKeyedDocs,
  keyedArrayDocs,
  sanitizeEmail,
  isValidDate,
  generateId,
  deepClone,
  deepMerge,
  paginate,
  filterByDateRange,
  sortItems
};