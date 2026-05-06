const express = require("express");
const router = express.Router();

const { requireAuth, requireDoctor } = require("../middleware/authMiddleware");
const asyncRoute = require("../middleware/asyncMiddleware");
const { readDb, writeDb } = require("../services/db");
const { logActivity } = require("../utils/activity");

// ==================== BOOK APPOINTMENT ====================
router.post(
  "/",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { doctorId, date, time, notes } = req.body;

    if (!doctorId || !date || !time) {
      return res.status(400).json({ 
        success: false, 
        error: "Doctor ID, date, and time are required" 
      });
    }

    const db = await readDb();
    
    // Check if doctor exists
    const doctor = db.doctors?.find(d => d.id === doctorId);
    if (!doctor) {
      return res.status(404).json({ 
        success: false, 
        error: "Doctor not found" 
      });
    }

    // Check if slot is already booked
    const existingAppointment = db.appointments?.find(
      a => a.doctorId === doctorId && a.date === date && a.time === time
    );

    if (existingAppointment) {
      return res.status(409).json({ 
        success: false, 
        error: "Time slot is already booked" 
      });
    }

    const appointment = {
      id: `appt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      userId: req.auth.id,
      doctorId,
      date,
      time,
      notes: notes || "",
      status: "scheduled",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!db.appointments) db.appointments = [];
    db.appointments.push(appointment);

    logActivity(db, req.auth.id, "appointment-booked", `Booked appointment with ${doctor.name} on ${date} at ${time}`);

    await writeDb(db);

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: appointment
    });
  })
);

// ==================== GET USER'S APPOINTMENTS ====================
router.get(
  "/user/:userId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { userId } = req.params;

    // Check authorization
    if (req.auth.role === "user" && req.auth.id !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: "Cannot view another user's appointments" 
      });
    }

    const db = await readDb();
    
    const appointments = (db.appointments || [])
      .filter(a => a.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Add doctor details
    const appointmentsWithDetails = appointments.map(apt => ({
      ...apt,
      doctor: db.doctors?.find(d => d.id === apt.doctorId)
    }));

    res.json({
      success: true,
      appointments: appointmentsWithDetails,
      total: appointmentsWithDetails.length
    });
  })
);

// ==================== GET DOCTOR'S APPOINTMENTS ====================
router.get(
  "/doctor/:doctorId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { doctorId } = req.params;

    // Check authorization
    if (req.auth.role === "doctor" && req.auth.id !== doctorId) {
      return res.status(403).json({ 
        success: false, 
        error: "Cannot view another doctor's appointments" 
      });
    }

    const db = await readDb();
    
    const appointments = (db.appointments || [])
      .filter(a => a.doctorId === doctorId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Add patient details
    const appointmentsWithDetails = appointments.map(apt => ({
      ...apt,
      patient: db.users?.find(u => u.id === apt.userId)
    }));

    res.json({
      success: true,
      appointments: appointmentsWithDetails,
      total: appointmentsWithDetails.length
    });
  })
);

// ==================== GET APPOINTMENT BY ID ====================
router.get(
  "/:appointmentId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { appointmentId } = req.params;
    const db = await readDb();

    const appointment = db.appointments?.find(a => a.id === appointmentId);

    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        error: "Appointment not found" 
      });
    }

    // Check authorization
    if (req.auth.role === "user" && appointment.userId !== req.auth.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    if (req.auth.role === "doctor" && appointment.doctorId !== req.auth.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }

    const appointmentWithDetails = {
      ...appointment,
      patient: db.users?.find(u => u.id === appointment.userId),
      doctor: db.doctors?.find(d => d.id === appointment.doctorId)
    };

    res.json({
      success: true,
      appointment: appointmentWithDetails
    });
  })
);

// ==================== CANCEL APPOINTMENT ====================
router.patch(
  "/:appointmentId/cancel",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { appointmentId } = req.params;
    const db = await readDb();

    const appointmentIndex = db.appointments?.findIndex(a => a.id === appointmentId);

    if (appointmentIndex === -1 || appointmentIndex === undefined) {
      return res.status(404).json({ 
        success: false, 
        error: "Appointment not found" 
      });
    }

    const appointment = db.appointments[appointmentIndex];

    // Check authorization
    if (appointment.userId !== req.auth.id && appointment.doctorId !== req.auth.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Cannot cancel this appointment" 
      });
    }

    // Can only cancel if not already cancelled or completed
    if (appointment.status === "cancelled") {
      return res.status(400).json({ 
        success: false, 
        error: "Appointment is already cancelled" 
      });
    }
    if (appointment.status === "completed") {
      return res.status(400).json({ 
        success: false, 
        error: "Cannot cancel completed appointment" 
      });
    }

    appointment.status = "cancelled";
    appointment.updatedAt = new Date().toISOString();

    await writeDb(db);

    logActivity(db, req.auth.id, "appointment-cancelled", `Cancelled appointment on ${appointment.date} at ${appointment.time}`);

    res.json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment
    });
  })
);

// ==================== UPDATE APPOINTMENT STATUS ====================
router.patch(
  "/:appointmentId/status",
  requireAuth,
  requireDoctor,
  asyncRoute(async (req, res) => {
    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!["scheduled", "completed", "cancelled", "no-show"].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid status" 
      });
    }

    const db = await readDb();
    const appointmentIndex = db.appointments?.findIndex(a => a.id === appointmentId);

    if (appointmentIndex === -1 || appointmentIndex === undefined) {
      return res.status(404).json({ 
        success: false, 
        error: "Appointment not found" 
      });
    }

    const appointment = db.appointments[appointmentIndex];

    // Only doctor can update status
    if (appointment.doctorId !== req.auth.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Only the assigned doctor can update appointment status" 
      });
    }

    appointment.status = status;
    appointment.updatedAt = new Date().toISOString();

    await writeDb(db);

    res.json({
      success: true,
      message: `Appointment marked as ${status}`,
      appointment
    });
  })
);

// ==================== GET APPOINTMENT SLOTS ====================
router.get(
  "/slots/:doctorId",
  asyncRoute(async (req, res) => {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ 
        success: false, 
        error: "Date is required" 
      });
    }

    const slots = [];
    const times = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
    
    const db = await readDb();
    
    const bookedAppointments = (db.appointments || []).filter(
      a => a.doctorId === doctorId && a.date === date && a.status !== "cancelled"
    );
    
    const bookedTimes = bookedAppointments.map(a => a.time);
    
    for (const time of times) {
      slots.push({
        time,
        available: !bookedTimes.includes(time)
      });
    }
    
    res.json({
      success: true,
      slots,
      date
    });
  })
);

module.exports = router;