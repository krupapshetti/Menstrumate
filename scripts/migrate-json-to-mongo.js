const fs = require("fs/promises");
const path = require("path");
const connectDB = require("../config/db");
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

const dbPath = path.join(__dirname, "..", "data", "db.json");

async function replaceCollection(Model, docs) {
  await Model.deleteMany({});
  if (docs.length) await Model.insertMany(docs, { ordered: false });
}

function keyedArrayDocs(objectValue, keyField, valueField) {
  return Object.entries(objectValue || {}).map(([key, value]) => ({
    [keyField]: key,
    [valueField]: Array.isArray(value) ? value : []
  }));
}

async function migrate() {
  await connectDB();
  const raw = await fs.readFile(dbPath, "utf8");
  const db = JSON.parse(raw);

  await Promise.all([
    replaceCollection(User, [...(db.users || []), ...(db.doctors || [])]),
    replaceCollection(Otp, db.otps || []),
    replaceCollection(Cart, Object.entries(db.carts || {}).map(([userId, items]) => ({ userId, items }))),
    replaceCollection(Payment, db.payments || []),
    replaceCollection(CycleHistory, keyedArrayDocs(db.cycles, "userId", "history")),
    replaceCollection(PatientMessage, db.patientMessages || []),
    replaceCollection(PatientRecommendation, db.patientRecommendations || []),
    replaceCollection(FollowUp, db.followUps || []),
    replaceCollection(ActivityLog, keyedArrayDocs(db.activityLogs, "userId", "logs")),
    replaceCollection(Chat, db.chats || []),
    replaceCollection(Symptom, db.symptoms || []),
    replaceCollection(Appointment, db.appointments || []),
    AppState.updateOne(
      { key: "default" },
      {
        $set: {
          products: db.products || [],
          yoga: db.yoga || [],
          education: db.education || [],
          notifications: db.notifications || [],
          symptomOptions: db.symptomOptions || [],
          insightRules: db.insightRules || [],
          appointmentSlots: db.appointmentSlots || [],
          shopRules: db.shopRules || []
        }
      },
      { upsert: true }
    )
  ]);

  console.log("Migrated data/db.json into MongoDB.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
