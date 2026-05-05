const User = require("../models/User");
const Symptom = require("../models/Symptom");
const Chat = require("../models/Chat");
const Appointment = require("../models/Appointment");
const Otp = require("../models/Otp");
const Cart = require("../models/Cart");
const Payment = require("../models/Payment");
const PatientMessage = require("../models/PatientMessage");
const PatientRecommendation = require("../models/PatientRecommendation");
const FollowUp = require("../models/FollowUp");
const ActivityLog = require("../models/ActivityLog");
const CycleHistory = require("../models/CycleHistory");
const AppState = require("../models/AppState");

const {
  normalizeDb,
  stripMongo,
  objectFromKeyedDocs,
  keyedArrayDocs
} = require("../utils/dbUtils");

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

/**
 * Ensure AppState exists in database
 * Creates default AppState if not exists
 * @returns {Promise<Object>} AppState document
 */
async function ensureAppState() {
  const existing = await AppState.findOne({
    key: "default"
  }).lean();

  if (existing) return existing;

  const created = await AppState.create({
    key: "default",
    products: seedProducts,
    yoga: seedYoga,
    education: seedEducation,
    notifications: seedNotifications,
    symptomOptions: seedSymptomOptions,
    insightRules: seedInsightRules,
    appointmentSlots: seedAppointmentSlots,
    shopRules: seedShopRules
  });

  console.log("✅ AppState initialized with seed data");
  return created.toObject();
}

/**
 * Read entire database into memory
 * @returns {Promise<Object>} Complete database object
 */
async function readDb() {
  const [
    appState,
    accounts,
    otps,
    carts,
    payments,
    cycles,
    patientMessages,
    patientRecommendations,
    followUps,
    activityLogs,
    chats,
    symptoms,
    appointments
  ] = await Promise.all([
    ensureAppState(),
    User.find({}).lean(),
    Otp.find({}).lean(),
    Cart.find({}).lean(),
    Payment.find({}).lean(),
    CycleHistory.find({}).lean(),
    PatientMessage.find({}).lean(),
    PatientRecommendation.find({}).lean(),
    FollowUp.find({}).lean(),
    ActivityLog.find({}).lean(),
    Chat.find({}).lean(),
    Symptom.find({}).lean(),
    Appointment.find({}).lean()
  ]);

  const db = normalizeDb({
    users: accounts
      .filter((account) => account.role === "user")
      .map(stripMongo),

    doctors: accounts
      .filter((account) => account.role === "doctor")
      .map(stripMongo),

    otps: otps.map(stripMongo),

    carts: objectFromKeyedDocs(
      carts,
      "userId",
      "items"
    ),

    payments: payments.map(stripMongo),

    cycles: objectFromKeyedDocs(
      cycles,
      "userId",
      "history"
    ),

    patientMessages:
      patientMessages.map(stripMongo),

    patientRecommendations:
      patientRecommendations.map(stripMongo),

    followUps:
      followUps.map(stripMongo),

    activityLogs: objectFromKeyedDocs(
      activityLogs,
      "userId",
      "logs"
    ),

    chats: chats.map((chat) => {
      const item = stripMongo(chat);

      if (item.typing instanceof Map) {
        item.typing = Object.fromEntries(
          item.typing
        );
      }

      return item;
    }),

    symptoms: symptoms.map(stripMongo),

    appointments:
      appointments.map(stripMongo),

    products: appState.products,
    yoga: appState.yoga,
    education: appState.education,
    notifications: appState.notifications,
    symptomOptions: appState.symptomOptions,
    insightRules: appState.insightRules,
    appointmentSlots: appState.appointmentSlots,
    shopRules: appState.shopRules
  });

  return structuredClone(db);
}

/**
 * Replace entire collection with new documents
 * @param {Model} Model - Mongoose model
 * @param {Array} docs - Documents to insert
 */
async function replaceCollection(Model, docs) {
  await Model.deleteMany({});

  if (docs && docs.length) {
    await Model.insertMany(docs, {
      ordered: false
    });
  }
}

/**
 * Write entire database from memory to MongoDB
 * @param {Object} db - Database object to write
 */
async function writeDb(db) {
  const normalized = normalizeDb(db);

  await Promise.all([
    replaceCollection(User, [
      ...normalized.users,
      ...normalized.doctors
    ]),

    replaceCollection(Otp, normalized.otps),

    replaceCollection(
      Cart,
      Object.entries(normalized.carts || {}).map(([userId, items]) => ({
        userId,
        items
      }))
    ),

    replaceCollection(Payment, normalized.payments),

    replaceCollection(
      CycleHistory,
      keyedArrayDocs(
        normalized.cycles,
        "userId",
        "history"
      )
    ),

    replaceCollection(
      PatientMessage,
      normalized.patientMessages
    ),

    replaceCollection(
      PatientRecommendation,
      normalized.patientRecommendations
    ),

    replaceCollection(FollowUp, normalized.followUps),

    replaceCollection(
      ActivityLog,
      keyedArrayDocs(
        normalized.activityLogs,
        "userId",
        "logs"
      )
    ),

    replaceCollection(Chat, normalized.chats),

    replaceCollection(Symptom, normalized.symptoms),

    replaceCollection(Appointment, normalized.appointments),

    AppState.updateOne(
      { key: "default" },
      {
        $set: {
          products: normalized.products,
          yoga: normalized.yoga,
          education: normalized.education,
          notifications: normalized.notifications,
          symptomOptions: normalized.symptomOptions,
          insightRules: normalized.insightRules,
          appointmentSlots: normalized.appointmentSlots,
          shopRules: normalized.shopRules
        }
      },
      { upsert: true }
    )
  ]);
}

/**
 * Get a single user by ID
 * @param {Object} db - Database object
 * @param {string} userId - User ID
 * @returns {Object|null} User object or null
 */
function getUserById(db, userId) {
  return db.users.find(user => user.id === userId) || null;
}

/**
 * Get a single doctor by ID
 * @param {Object} db - Database object
 * @param {string} doctorId - Doctor ID
 * @returns {Object|null} Doctor object or null
 */
function getDoctorById(db, doctorId) {
  return db.doctors.find(doctor => doctor.id === doctorId) || null;
}

/**
 * Get user or doctor by ID
 * @param {Object} db - Database object
 * @param {string} id - User or doctor ID
 * @returns {Object|null} Account object or null
 */
function getAccountById(db, id) {
  const user = getUserById(db, id);
  if (user) return { ...user, role: "user" };
  
  const doctor = getDoctorById(db, id);
  if (doctor) return { ...doctor, role: "doctor" };
  
  return null;
}

/**
 * Update user data
 * @param {Object} db - Database object
 * @param {string} userId - User ID
 * @param {Object} updates - Updates to apply
 */
async function updateUser(db, userId, updates) {
  const userIndex = db.users.findIndex(u => u.id === userId);
  if (userIndex === -1) return false;
  
  db.users[userIndex] = {
    ...db.users[userIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await writeDb(db);
  return true;
}

/**
 * Update doctor data
 * @param {Object} db - Database object
 * @param {string} doctorId - Doctor ID
 * @param {Object} updates - Updates to apply
 */
async function updateDoctor(db, doctorId, updates) {
  const doctorIndex = db.doctors.findIndex(d => d.id === doctorId);
  if (doctorIndex === -1) return false;
  
  db.doctors[doctorIndex] = {
    ...db.doctors[doctorIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await writeDb(db);
  return true;
}

/**
 * Get user's cycle history
 * @param {Object} db - Database object
 * @param {string} userId - User ID
 * @returns {Array} Cycle history array
 */
function getUserCycleHistory(db, userId) {
  return db.cycles[userId] || [];
}

/**
 * Add cycle entry for user
 * @param {Object} db - Database object
 * @param {string} userId - User ID
 * @param {Object} cycleEntry - Cycle entry data
 */
async function addCycleEntry(db, userId, cycleEntry) {
  if (!db.cycles[userId]) {
    db.cycles[userId] = [];
  }
  
  db.cycles[userId].push({
    ...cycleEntry,
    recordedAt: new Date().toISOString()
  });
  
  await writeDb(db);
}

/**
 * Get user's symptoms
 * @param {Object} db - Database object
 * @param {string} userId - User ID
 * @param {boolean} sharedOnly - Only return shared symptoms
 * @returns {Array} Symptoms array
 */
function getUserSymptoms(db, userId, sharedOnly = false) {
  let symptoms = db.symptoms.filter(s => s.userId === userId);
  if (sharedOnly) {
    symptoms = symptoms.filter(s => s.sharedWithDoctor === true);
  }
  return symptoms.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Add or update symptom entry
 * @param {Object} db - Database object
 * @param {Object} symptomData - Symptom entry data
 */
async function upsertSymptom(db, symptomData) {
  const existingIndex = db.symptoms.findIndex(
    s => s.userId === symptomData.userId && s.date === symptomData.date
  );
  
  if (existingIndex !== -1) {
    db.symptoms[existingIndex] = {
      ...db.symptoms[existingIndex],
      ...symptomData,
      updatedAt: new Date().toISOString()
    };
  } else {
    db.symptoms.push({
      ...symptomData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  await writeDb(db);
}

/**
 * Get user's cart
 * @param {Object} db - Database object
 * @param {string} userId - User ID
 * @returns {Array} Cart items
 */
function getUserCart(db, userId) {
  return db.carts[userId] || [];
}

/**
 * Update user's cart
 * @param {Object} db - Database object
 * @param {string} userId - User ID
 * @param {Array} cartItems - New cart items
 */
async function updateUserCart(db, userId, cartItems) {
  db.carts[userId] = cartItems.filter(item => item.quantity > 0);
  await writeDb(db);
}

/**
 * Clear user's cart
 * @param {Object} db - Database object
 * @param {string} userId - User ID
 */
async function clearUserCart(db, userId) {
  db.carts[userId] = [];
  await writeDb(db);
}

/**
 * Add payment record
 * @param {Object} db - Database object
 * @param {Object} paymentData - Payment data
 * @returns {Object} Created payment
 */
async function addPayment(db, paymentData) {
  const payment = {
    id: `pay_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ...paymentData,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  
  db.payments.push(payment);
  await writeDb(db);
  return payment;
}

/**
 * Update payment status
 * @param {Object} db - Database object
 * @param {string} paymentId - Payment ID
 * @param {string} status - New status (paid, failed, expired)
 */
async function updatePaymentStatus(db, paymentId, status) {
  const payment = db.payments.find(p => p.id === paymentId);
  if (payment) {
    payment.status = status;
    if (status === "paid") {
      payment.paidAt = new Date().toISOString();
    }
    await writeDb(db);
  }
}

/**
 * Add activity log entry
 * @param {Object} db - Database object
 * @param {string} userId - User ID
 * @param {string} type - Activity type
 * @param {string} detail - Activity details
 */
async function addActivityLog(db, userId, type, detail) {
  if (!db.activityLogs[userId]) {
    db.activityLogs[userId] = [];
  }
  
  db.activityLogs[userId].push({
    id: `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    detail,
    createdAt: new Date().toISOString()
  });
  
  // Keep only last 100 activities
  if (db.activityLogs[userId].length > 100) {
    db.activityLogs[userId] = db.activityLogs[userId].slice(-100);
  }
  
  await writeDb(db);
}

/**
 * Get or create chat between doctor and patient
 * @param {Object} db - Database object
 * @param {string} doctorId - Doctor ID
 * @param {string} userId - Patient ID
 * @returns {Object} Chat object
 */
function getOrCreateChat(db, doctorId, userId) {
  let chat = db.chats.find(
    c => c.doctorId === doctorId && c.userId === userId
  );
  
  if (!chat) {
    chat = {
      chatId: `chat_${doctorId}_${userId}`,
      doctorId,
      userId,
      messages: [],
      typing: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.chats.push(chat);
  }
  
  return chat;
}

/**
 * Add message to chat
 * @param {Object} db - Database object
 * @param {string} chatId - Chat ID
 * @param {Object} message - Message object
 */
async function addChatMessage(db, chatId, message) {
  const chat = db.chats.find(c => c.chatId === chatId);
  if (chat) {
    chat.messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ...message,
      status: "delivered",
      timestamp: new Date().toISOString()
    });
    chat.updatedAt = new Date().toISOString();
    await writeDb(db);
  }
}

/**
 * Get appointments for a user
 * @param {Object} db - Database object
 * @param {string} userId - User ID
 * @param {string} status - Optional status filter
 * @returns {Array} Appointments array
 */
function getUserAppointments(db, userId, status = null) {
  let appointments = db.appointments.filter(a => a.patientId === userId);
  if (status) {
    appointments = appointments.filter(a => a.status === status);
  }
  return appointments.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

/**
 * Get appointments for a doctor
 * @param {Object} db - Database object
 * @param {string} doctorId - Doctor ID
 * @param {string} status - Optional status filter
 * @returns {Array} Appointments array
 */
function getDoctorAppointments(db, doctorId, status = null) {
  let appointments = db.appointments.filter(a => a.doctorId === doctorId);
  if (status) {
    appointments = appointments.filter(a => a.status === status);
  }
  return appointments.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

/**
 * Create appointment
 * @param {Object} db - Database object
 * @param {Object} appointmentData - Appointment data
 * @returns {Object} Created appointment
 */
async function createAppointment(db, appointmentData) {
  const appointment = {
    appointmentId: `appt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ...appointmentData,
    status: "scheduled",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.appointments.push(appointment);
  await writeDb(db);
  return appointment;
}

/**
 * Update appointment
 * @param {Object} db - Database object
 * @param {string} appointmentId - Appointment ID
 * @param {Object} updates - Updates to apply
 */
async function updateAppointment(db, appointmentId, updates) {
  const appointment = db.appointments.find(a => a.appointmentId === appointmentId);
  if (appointment) {
    Object.assign(appointment, updates);
    appointment.updatedAt = new Date().toISOString();
    await writeDb(db);
  }
}

module.exports = {
  // Core DB operations
  ensureAppState,
  readDb,
  writeDb,
  
  // Account operations
  getUserById,
  getDoctorById,
  getAccountById,
  updateUser,
  updateDoctor,
  
  // Cycle operations
  getUserCycleHistory,
  addCycleEntry,
  
  // Symptom operations
  getUserSymptoms,
  upsertSymptom,
  
  // Cart operations
  getUserCart,
  updateUserCart,
  clearUserCart,
  
  // Payment operations
  addPayment,
  updatePaymentStatus,
  
  // Activity operations
  addActivityLog,
  
  // Chat operations
  getOrCreateChat,
  addChatMessage,
  
  // Appointment operations
  getUserAppointments,
  getDoctorAppointments,
  createAppointment,
  updateAppointment
};