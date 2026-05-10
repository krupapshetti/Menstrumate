const express = require("express");
const router = express.Router();

const {
  requireAuth,
  requireDoctor
} = require("../middleware/authMiddleware");

const asyncRoute = require("../middleware/asyncMiddleware"); // FIXED: changed from asyncHandler

const {
  readDb,
  writeDb
} = require("../services/db");

const {
  buildPatientSummary,
  buildPatientDetails,
  symptomAnalytics,
  logActivity,
  publicDoctor
} = require("../utils/doctorUtils");

// ==================== GET ALL PATIENTS ====================
router.get(
  "/patients",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    const patients = db.users.map((user) =>
      buildPatientSummary(db, user)
    );

    const now = Date.now();

    const totalPatients = patients.length;
    const activePatients = patients.filter(
      (patient) =>
        (now - new Date(patient.lastActivity).getTime()) / 86400000 <= 14
    ).length;
    const highRiskPatients = patients.filter(
      (patient) => patient.riskLevel === "High"
    ).length;
    const mediumRiskPatients = patients.filter(
      (patient) => patient.riskLevel === "Medium"
    ).length;
    const lowRiskPatients = patients.filter(
      (patient) => patient.riskLevel === "Low"
    ).length;
    const newPatients = patients.filter(
      (patient) =>
        (now - new Date(patient.createdAt).getTime()) / 86400000 <= 7
    ).length;

    const conditions = [...new Set(patients.map((patient) => patient.condition))];

    const alerts = patients.flatMap((patient) =>
      patient.riskReasons.map((reason) => ({
        id: `${patient.id}_${reason.replace(/\W+/g, "_").toLowerCase()}`,
        patientId: patient.id,
        patientName: patient.name,
        riskLevel: patient.riskLevel,
        message: reason,
        createdAt: patient.lastActivity
      }))
    );

    res.json({
      success: true,
      summary: {
        totalPatients,
        activePatients,
        highRiskPatients,
        mediumRiskPatients,
        lowRiskPatients,
        newPatients,
        riskDistribution: {
          high: highRiskPatients,
          medium: mediumRiskPatients,
          low: lowRiskPatients
        }
      },
      patients: patients.sort((a, b) => 
        new Date(b.lastActivity) - new Date(a.lastActivity)
      ),
      conditions,
      alerts: alerts.slice(0, 20) // Limit alerts
    });
  })
);

// ==================== GET PATIENT DETAILS ====================
router.get(
  "/patient/:id",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    const patient = db.users.find(
      (user) => user.id === req.params.id
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found"
      });
    }

    const details = buildPatientDetails(db, patient);

    res.json({
      success: true,
      patient: details
    });
  })
);

// ==================== GET DOCTOR INSIGHTS ====================
router.get(
  "/insights",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    const patients = db.users.map((user) => {
      const summary = buildPatientSummary(db, user);
      const analytics = symptomAnalytics(db, user.id, true);
      return { ...summary, analytics };
    });

    const inactiveUsers = patients.filter((patient) =>
      patient.riskReasons.some(reason => reason.includes("No activity"))
    );

    const highRiskPatients = patients.filter(
      (patient) => patient.riskLevel === "High"
    );

    const highPainAlerts = patients.flatMap((patient) =>
      patient.analytics.highPainAlerts.map((entry) => ({
        patientId: patient.id,
        patientName: patient.name,
        date: entry.date,
        painLevel: entry.painLevel
      }))
    ).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

    const frequentSymptoms = patients.flatMap((patient) =>
      patient.analytics.frequency.slice(0, 3).map((item) => ({
        patientId: patient.id,
        patientName: patient.name,
        symptom: item.symptom,
        count: item.count
      }))
    ).sort((a, b) => b.count - a.count).slice(0, 30);

    // Get trending symptoms across all patients
    const allSymptoms = patients.flatMap(p => 
      p.analytics.frequency.map(f => f.symptom)
    );
    const symptomFrequency = {};
    allSymptoms.forEach(s => {
      symptomFrequency[s] = (symptomFrequency[s] || 0) + 1;
    });
    const trendingSymptoms = Object.entries(symptomFrequency)
      .map(([symptom, count]) => ({ symptom, patientCount: count }))
      .sort((a, b) => b.patientCount - a.patientCount)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        summary: {
          totalHighRisk: highRiskPatients.length,
          totalInactive: inactiveUsers.length,
          totalHighPainAlerts: highPainAlerts.length,
          uniqueSymptoms: Object.keys(symptomFrequency).length
        },
        highRiskPatients: highRiskPatients.map(p => ({
          id: p.id,
          name: p.name,
          riskReasons: p.riskReasons,
          lastActivity: p.lastActivity
        })),
        inactiveUsers: inactiveUsers.map(p => ({
          id: p.id,
          name: p.name,
          daysInactive: Math.floor((Date.now() - new Date(p.lastActivity).getTime()) / 86400000),
          lastActivity: p.lastActivity
        })),
        highPainAlerts,
        frequentSymptoms,
        trendingSymptoms,
        timestamp: new Date().toISOString()
      }
    });
  })
);

// ==================== SEND MESSAGE TO PATIENT ====================
router.post(
  "/patient/message",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const { patientId, message, priority = "normal" } = req.body;

    if (!patientId || !message) {
      return res.status(400).json({
        success: false,
        error: "Patient ID and message are required"
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        success: false,
        error: "Message cannot exceed 5000 characters"
      });
    }

    const db = await readDb();

    const patient = db.users.find(
      (user) => user.id === patientId
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found"
      });
    }

    const doctor = db.doctors.find(d => d.id === req.auth.id);

    const item = {
      id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      patientId,
      doctorId: req.auth.id,
      doctorName: doctor?.name || "Doctor",
      message: message.trim(),
      priority: ["normal", "high", "urgent"].includes(priority) ? priority : "normal",
      read: false,
      readAt: null,
      createdAt: new Date().toISOString()
    };

    if (!db.patientMessages) db.patientMessages = [];
    db.patientMessages.push(item);

    logActivity(
      db,
      patientId,
      "doctor-message",
      `Doctor sent a ${priority} priority message`
    );

    await writeDb(db);

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: item
    });
  })
);

// ======================= GET MESSAGES FOR PATIENT ====================
router.get(
  "/patient/:patientId/messages",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const { patientId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const db = await readDb();

    const patient = db.users.find(u => u.id === patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found"
      });
    }

    const messages = (db.patientMessages || [])
      .filter(m => m.patientId === patientId && m.doctorId === req.auth.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: {
        messages,
        total: messages.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  })
);

// ==================== ADD RECOMMENDATION ====================
router.post(
  "/patient/recommendation",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const { patientId, recommendation, followUpDate, category = "general" } = req.body;

    if (!patientId || !recommendation) {
      return res.status(400).json({
        success: false,
        error: "Patient ID and recommendation are required"
      });
    }

    const db = await readDb();

    const patient = db.users.find(
      (user) => user.id === patientId
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found"
      });
    }

    const doctor = db.doctors.find(d => d.id === req.auth.id);

    const item = {
      id: `rec_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      patientId,
      doctorId: req.auth.id,
      doctorName: doctor?.name || "Doctor",
      recommendation: recommendation.trim(),
      category: ["general", "diet", "exercise", "medication", "follow-up"].includes(category) ? category : "general",
      followUpDate: followUpDate || null,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    };

    if (!db.patientRecommendations) db.patientRecommendations = [];
    db.patientRecommendations.push(item);

    if (followUpDate) {
      if (!db.followUps) db.followUps = [];
      db.followUps.push({
        id: `follow_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        patientId,
        doctorId: req.auth.id,
        recommendationId: item.id,
        date: followUpDate,
        status: "scheduled",
        createdAt: new Date().toISOString()
      });
    }

    logActivity(
      db,
      patientId,
      "doctor-recommendation",
      `Doctor added a ${category} recommendation`
    );

    await writeDb(db);

    res.status(201).json({
      success: true,
      message: "Recommendation added successfully",
      data: item
    });
  })
);

// ==================== UPDATE DOCTOR STATUS ====================
router.post(
  "/status",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const { isOnline } = req.body;

    const db = await readDb();

    const doctor = db.doctors.find(
      (account) => account.id === req.auth.id
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: "Doctor not found"
      });
    }

    doctor.isOnline = Boolean(isOnline);
    doctor.lastSeen = new Date().toISOString();

    if (isOnline === false) {
      logActivity(db, doctor.id, "doctor-status", "Doctor went offline");
    } else {
      logActivity(db, doctor.id, "doctor-status", "Doctor came online");
    }

    await writeDb(db);

    res.json({
      success: true,
      message: `Status updated to ${isOnline ? "online" : "offline"}`,
      doctor: publicDoctor(doctor)
    });
  })
);

// ==================== GET ALL DOCTORS ====================
router.get(
  "/doctors",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const { specialization, isOnline } = req.query;

    let doctors = db.doctors.map(publicDoctor);

    // Filter by specialization
    if (specialization) {
      doctors = doctors.filter(d => 
        d.specialization?.toLowerCase().includes(specialization.toLowerCase())
      );
    }

    // Filter by online status
    if (isOnline === "true") {
      doctors = doctors.filter(d => d.isOnline === true);
    } else if (isOnline === "false") {
      doctors = doctors.filter(d => d.isOnline === false);
    }

    // Sort online doctors first, then by name
    doctors.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return b.isOnline - a.isOnline;
      return (a.name || "").localeCompare(b.name || "");
    });

    res.json({
      success: true,
      data: {
        doctors,
        total: doctors.length,
        online: doctors.filter(d => d.isOnline).length
      }
    });
  })
);

// ==================== GET DOCTOR PROFILE ====================
router.get(
  "/profile",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    const doctor = db.doctors.find(
      (account) => account.id === req.auth.id
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: "Doctor not found"
      });
    }

    // Get statistics
    const myPatients = db.users.filter(u => 
      // You might have a patient-doctor assignment relationship
      // For now, return all patients
      true
    );

    const myMessages = (db.patientMessages || []).filter(m => m.doctorId === doctor.id);
    const myRecommendations = (db.patientRecommendations || []).filter(r => r.doctorId === doctor.id);

    res.json({
      success: true,
      data: {
        profile: publicDoctor(doctor),
        stats: {
          totalPatients: myPatients.length,
          totalMessages: myMessages.length,
          totalRecommendations: myRecommendations.length,
          activeFollowUps: (db.followUps || []).filter(f => f.doctorId === doctor.id && f.status === "scheduled").length
        }
      }
    });
  })
);

module.exports = router;