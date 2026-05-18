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

function normalizeDb(parsed = {}) {
  const db = { ...defaultDb, ...parsed };
  
  // Ensure arrays and objects
  db.users = Array.isArray(db.users) ? db.users : [];
  db.doctors = Array.isArray(db.doctors) ? db.doctors : [];
  db.otps = Array.isArray(db.otps) ? db.otps : [];
  db.carts = db.carts && typeof db.carts === "object" ? db.carts : {};
  db.payments = Array.isArray(db.payments) ? db.payments : [];
  db.cycles = db.cycles && typeof db.cycles === "object" ? db.cycles : {};
  db.patientMessages = Array.isArray(db.patientMessages) ? db.patientMessages : [];
  db.patientRecommendations = Array.isArray(db.patientRecommendations) ? db.patientRecommendations : [];
  db.followUps = Array.isArray(db.followUps) ? db.followUps : [];
  db.activityLogs = db.activityLogs && typeof db.activityLogs === "object" ? db.activityLogs : {};
  db.chats = Array.isArray(db.chats) ? db.chats : [];
  db.symptoms = Array.isArray(db.symptoms) ? db.symptoms : [];
  db.appointments = Array.isArray(db.appointments) ? db.appointments : [];
  
  // Normalize products - ensure they exist
  db.products = Array.isArray(db.products) && db.products.length ? db.products : seedProducts;
  
  // Normalize yoga
  db.yoga = Array.isArray(db.yoga) && db.yoga.length
    ? db.yoga.map((pose) => ({ ...(seedYoga.find((item) => item.id === pose.id) || {}), ...pose }))
    : seedYoga;
  
  // Normalize other content
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
  
  // Normalize chats
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

function stripMongo(doc) {
  if (!doc) return doc;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete plain._id;
  delete plain.__v;
  return plain;
}

function objectFromKeyedDocs(docs, keyField, valueField) {
  return docs.reduce((result, doc) => {
    const item = stripMongo(doc);
    result[item[keyField]] = item[valueField] || [];
    return result;
  }, {});
}

function keyedArrayDocs(objectValue, keyField, valueField) {
  return Object.entries(objectValue || {}).map(([key, value]) => ({
    [keyField]: key,
    [valueField]: Array.isArray(value) ? value : []
  }));
}

module.exports = {
  defaultDb,
  normalizeDb,
  stripMongo,
  objectFromKeyedDocs,
  keyedArrayDocs
};