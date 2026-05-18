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
const CommunityChat = require("../models/CommunityChat");
const CommunityMessage = require("../models/CommunityMessage");
const OnlineStatus = require("../models/OnlineStatus");

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

async function ensureAppState() {
  const existing = await AppState.findOne({ key: "default" }).lean();
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

function convertCycleDocsToArray(cycleDocs) {
  const cyclesArray = [];
  if (!cycleDocs || !Array.isArray(cycleDocs)) return cyclesArray;
  
  for (const doc of cycleDocs) {
    if (doc.history && Array.isArray(doc.history)) {
      for (const cycle of doc.history) {
        cyclesArray.push({
          userId: doc.userId,
          startDate: cycle.startDate,
          cycleLength: cycle.cycleLength,
          recordedAt: cycle.recordedAt || cycle.createdAt || new Date().toISOString(),
          id: cycle.id || Date.now()
        });
      }
    }
  }
  return cyclesArray;
}

function convertCyclesToPerUserHistory(cyclesArray) {
  const cyclesByUser = {};
  if (!cyclesArray || !Array.isArray(cyclesArray)) return cyclesByUser;
  
  for (const cycle of cyclesArray) {
    if (!cycle.userId) continue;
    if (!cyclesByUser[cycle.userId]) {
      cyclesByUser[cycle.userId] = [];
    }
    cyclesByUser[cycle.userId].push({
      startDate: cycle.startDate,
      cycleLength: cycle.cycleLength,
      recordedAt: cycle.recordedAt || new Date().toISOString()
    });
  }
  return cyclesByUser;
}

async function readDb() {
  const [
    appState,
    accounts,
    otps,
    carts,
    payments,
    cycleDocs,
    patientMessages,
    patientRecommendations,
    followUps,
    activityLogs,
    chats,
    symptoms,
    appointments,
    communityChats,
    communityMessages,
    onlineStatuses
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
    Appointment.find({}).lean(),
    CommunityChat.find({}).lean(),
    CommunityMessage.find({}).lean(),
    OnlineStatus.find({}).lean()
  ]);

  const cyclesArray = convertCycleDocsToArray(cycleDocs);
  console.log(`📊 Cycles loaded: ${cyclesArray.length} total cycles`);

  const db = normalizeDb({
    users: accounts.filter(a => a.role === "user").map(stripMongo),
    doctors: accounts.filter(a => a.role === "doctor").map(stripMongo),
    otps: otps.map(stripMongo),
    carts: objectFromKeyedDocs(carts, "userId", "items"),
    payments: payments.map(stripMongo),
    cycles: cyclesArray,
    patientMessages: patientMessages.map(stripMongo),
    patientRecommendations: patientRecommendations.map(stripMongo),
    followUps: followUps.map(stripMongo),
    activityLogs: objectFromKeyedDocs(activityLogs, "userId", "logs"),

    // Doctor-patient chats (existing - DO NOT TOUCH)
    chats: chats.map(chat => {
      const item = stripMongo(chat);
      if (item.typing instanceof Map) {
        item.typing = Object.fromEntries(item.typing);
      }
      return item;
    }),

    symptoms: symptoms.map(stripMongo),
    appointments: appointments.map(stripMongo),

    // Community chats (NEW - separate collection)
    communityChats: communityChats.map(stripMongo),
    communityMessages: communityMessages.map(stripMongo),
    onlineStatuses: onlineStatuses.map(stripMongo),

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

// ==================== IMPROVED replaceCollection ====================
async function replaceCollection(Model, docs, preserveExisting = false) {
  console.log(`   📝 Processing ${Model.modelName || Model.collection.name}:`, docs?.length || 0, "documents");
  try {
    if (preserveExisting) {
      // For community data - upsert without deleting
      let upsertedCount = 0;
      for (const doc of docs) {
        const result = await Model.updateOne(
          { chatId: doc.chatId || doc.messageId || { $exists: false } },
          { $set: doc },
          { upsert: true }
        );
        if (result.upsertedCount || result.modifiedCount) upsertedCount++;
      }
      console.log(`   ✅ ${Model.modelName}: upserted ${upsertedCount} documents`);
    } else {
      // For non-community data - full replace
      await Model.deleteMany({});
      if (docs && docs.length) {
        const result = await Model.insertMany(docs, { ordered: false });
        console.log(`   ✅ ${Model.modelName}: inserted ${result.length} documents`);
      } else {
        console.log(`   ⚠️ ${Model.modelName}: no documents to insert`);
      }
    }
  } catch (err) {
    console.error(`   ❌ Error in ${Model.modelName}:`, err.message);
    throw err;
  }
}

// ==================== NEW HELPER FUNCTIONS FOR COMMUNITY ====================

// Update community chats - preserve existing, only add/update new ones
// Update community chats - preserve existing, only add/update new ones
async function updateCommunityChats(newChats) {
  console.log(`   📝 Updating CommunityChats: ${newChats.length} chats`);
  
  try {
    for (const chat of newChats) {
      // Clean up any malformed _id fields in members
      if (chat.members && Array.isArray(chat.members)) {
        chat.members = chat.members.map(member => {
          // Remove the problematic _id field if it exists
          if (member._id) {
            delete member._id;
          }
          return member;
        });
      }
      
      await CommunityChat.updateOne(
        { chatId: chat.chatId },
        { $set: chat },
        { upsert: true }
      );
    }
    console.log(`   ✅ CommunityChats updated successfully`);
  } catch (error) {
    // Log but don't throw - this prevents the entire writeDb from failing
    console.log(`   ⚠️ CommunityChats update failed (non-critical):`, error.message);
    console.log(`   Continuing with other operations...`);
    // Don't re-throw the error
  }
}

// Add community messages - never delete existing messages, only add new ones
async function addCommunityMessages(newMessages) {
  console.log(`   📝 Adding CommunityMessages: ${newMessages.length} new messages`);
  
  let addedCount = 0;
  for (const message of newMessages) {
    // Check if message already exists
    const exists = await CommunityMessage.findOne({ messageId: message.messageId });
    if (!exists) {
      await CommunityMessage.create(message);
      addedCount++;
    }
  }
  console.log(`   ✅ CommunityMessages: ${addedCount} new messages added`);
}

// Update online statuses - preserve current status
async function updateOnlineStatuses(statuses) {
  console.log(`   📝 Updating OnlineStatus: ${statuses.length} statuses`);
  
  for (const status of statuses) {
    await OnlineStatus.updateOne(
      { userId: status.userId },
      { $set: status },
      { upsert: true }
    );
  }
  console.log(`   ✅ OnlineStatus updated successfully`);
}

async function writeDb(db) {
  console.log("\n🔵 ========== WRITE DB START ==========");
  const normalized = normalizeDb(db);
  
  console.log("📊 Data being written:");
  console.log("   - Users:", normalized.users?.length || 0);
  console.log("   - Doctors:", normalized.doctors?.length || 0);
  console.log("   - Chats (doctor):", normalized.chats?.length || 0);
  console.log("   - CommunityChats:", normalized.communityChats?.length || 0);
  console.log("   - CommunityMessages:", normalized.communityMessages?.length || 0);
  console.log("   - OnlineStatuses:", normalized.onlineStatuses?.length || 0);

  try {
    // Appointments - full replace
    await replaceCollection(Appointment, normalized.appointments);

    // Cycles - upsert by user
    const cyclesByUser = convertCyclesToPerUserHistory(normalized.cycles);
    for (const [userId, history] of Object.entries(cyclesByUser)) {
      await CycleHistory.updateOne(
        { userId },
        { $set: { history, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
    }

    // Regular collections - full replace (these can be safely deleted)
    await Promise.all([
      replaceCollection(User, [...normalized.users, ...normalized.doctors]),
      replaceCollection(Otp, normalized.otps),
      replaceCollection(Cart, Object.entries(normalized.carts || {}).map(([userId, items]) => ({ userId, items }))),
      replaceCollection(Payment, normalized.payments),
      replaceCollection(PatientMessage, normalized.patientMessages),
      replaceCollection(PatientRecommendation, normalized.patientRecommendations),
      replaceCollection(FollowUp, normalized.followUps),
      replaceCollection(ActivityLog, keyedArrayDocs(normalized.activityLogs, "userId", "logs")),
      replaceCollection(Chat, normalized.chats),
      replaceCollection(Symptom, normalized.symptoms),
    ]);

    // ==================== COMMUNITY COLLECTIONS - PRESERVE EXISTING DATA ====================
    // These use upsert instead of delete+insert to prevent data loss
    
    // Update community chats
    await updateCommunityChats(normalized.communityChats || []);
    
    // Add new community messages (never delete existing)
    await addCommunityMessages(normalized.communityMessages || []);
    
    // Update online statuses
    await updateOnlineStatuses(normalized.onlineStatuses || []);

    // AppState - upsert
    await AppState.updateOne(
      { key: "default" },
      { $set: {
        products: normalized.products,
        yoga: normalized.yoga,
        education: normalized.education,
        notifications: normalized.notifications,
        symptomOptions: normalized.symptomOptions,
        insightRules: normalized.insightRules,
        appointmentSlots: normalized.appointmentSlots,
        shopRules: normalized.shopRules
      }},
      { upsert: true }
    );

    console.log("✅ ALL collections saved successfully!");
    console.log("🔵 ========== WRITE DB END ==========\n");
  } catch (err) {
    console.error("\n❌❌❌ FATAL ERROR IN writeDb:", err.message);
    console.error("🔵 ========== WRITE DB FAILED ==========\n");
    throw err;
  }
}

// ==================== HELPER FUNCTIONS ====================

function getUserById(db, userId) {
  return db.users.find(u => u.id === userId) || null;
}

function getDoctorById(db, doctorId) {
  return db.doctors.find(d => d.id === doctorId) || null;
}

function getAccountById(db, id) {
  const user = getUserById(db, id);
  if (user) return { ...user, role: "user" };
  const doctor = getDoctorById(db, id);
  if (doctor) return { ...doctor, role: "doctor" };
  return null;
}

async function updateUser(db, userId, updates) {
  const idx = db.users.findIndex(u => u.id === userId);
  if (idx === -1) return false;
  db.users[idx] = { ...db.users[idx], ...updates, updatedAt: new Date().toISOString() };
  await writeDb(db);
  return true;
}

async function updateDoctor(db, doctorId, updates) {
  const idx = db.doctors.findIndex(d => d.id === doctorId);
  if (idx === -1) return false;
  db.doctors[idx] = { ...db.doctors[idx], ...updates, updatedAt: new Date().toISOString() };
  await writeDb(db);
  return true;
}

function getUserCycleHistory(db, userId) {
  return Array.isArray(db.cycles) ? db.cycles.filter(c => c.userId === userId) : [];
}

async function addCycleEntry(db, userId, cycleEntry) {
  if (!Array.isArray(db.cycles)) db.cycles = [];
  db.cycles.push({ ...cycleEntry, userId, recordedAt: new Date().toISOString() });
  await writeDb(db);
}

function getUserSymptoms(db, userId, sharedOnly = false) {
  let symptoms = db.symptoms.filter(s => s.userId === userId);
  if (sharedOnly) symptoms = symptoms.filter(s => s.sharedWithDoctor === true);
  return symptoms.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function upsertSymptom(db, symptomData) {
  const idx = db.symptoms.findIndex(s => s.userId === symptomData.userId && s.date === symptomData.date);
  if (idx !== -1) {
    db.symptoms[idx] = { ...db.symptoms[idx], ...symptomData, updatedAt: new Date().toISOString() };
  } else {
    db.symptoms.push({ ...symptomData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  await writeDb(db);
}

function getUserCart(db, userId) {
  return db.carts[userId] || [];
}

async function updateUserCart(db, userId, cartItems) {
  db.carts[userId] = cartItems.filter(i => i.quantity > 0);
  await writeDb(db);
}

async function clearUserCart(db, userId) {
  db.carts[userId] = [];
  await writeDb(db);
}

async function addPayment(db, paymentData) {
  const payment = { id: `pay_${Date.now()}_${Math.random().toString(16).slice(2)}`, ...paymentData, status: "pending", createdAt: new Date().toISOString() };
  db.payments.push(payment);
  await writeDb(db);
  return payment;
}

async function updatePaymentStatus(db, paymentId, status) {
  const payment = db.payments.find(p => p.id === paymentId);
  if (payment) {
    payment.status = status;
    if (status === "paid") payment.paidAt = new Date().toISOString();
    await writeDb(db);
  }
}

async function addActivityLog(db, userId, type, detail) {
  if (!db.activityLogs[userId]) db.activityLogs[userId] = [];
  db.activityLogs[userId].push({ id: `activity_${Date.now()}`, type, detail, createdAt: new Date().toISOString() });
  if (db.activityLogs[userId].length > 100) db.activityLogs[userId] = db.activityLogs[userId].slice(-100);
  await writeDb(db);
}

// Doctor-patient chat (existing - unchanged)
function getOrCreateChat(db, doctorId, userId) {
  let chat = db.chats.find(c => c.doctorId === doctorId && c.userId === userId);
  if (!chat) {
    chat = { chatId: `chat_${doctorId}_${userId}`, doctorId, userId, messages: [], typing: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    db.chats.push(chat);
  }
  return chat;
}

async function addChatMessage(db, chatId, message) {
  const chat = db.chats.find(c => c.chatId === chatId);
  if (chat) {
    chat.messages.push({ id: `msg_${Date.now()}`, ...message, status: "delivered", timestamp: new Date().toISOString() });
    chat.updatedAt = new Date().toISOString();
    await writeDb(db);
  }
}

function getUserAppointments(db, userId, status = null) {
  let apps = db.appointments.filter(a => a.patientId === userId);
  if (status) apps = apps.filter(a => a.status === status);
  return apps.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function getDoctorAppointments(db, doctorId, status = null) {
  let apps = db.appointments.filter(a => a.doctorId === doctorId);
  if (status) apps = apps.filter(a => a.status === status);
  return apps.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

async function createAppointment(db, data) {
  const appt = { appointmentId: `appt_${Date.now()}`, ...data, status: "scheduled", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.appointments.push(appt);
  await writeDb(db);
  return appt;
}

async function updateAppointment(db, id, updates) {
  const appt = db.appointments.find(a => a.appointmentId === id);
  if (appt) {
    Object.assign(appt, updates, { updatedAt: new Date().toISOString() });
    await writeDb(db);
  }
}

module.exports = {
  ensureAppState, readDb, writeDb,
  getUserById, getDoctorById, getAccountById, updateUser, updateDoctor,
  getUserCycleHistory, addCycleEntry,
  getUserSymptoms, upsertSymptom,
  getUserCart, updateUserCart, clearUserCart,
  addPayment, updatePaymentStatus,
  addActivityLog,
  getOrCreateChat, addChatMessage,
  getUserAppointments, getDoctorAppointments, createAppointment, updateAppointment
};