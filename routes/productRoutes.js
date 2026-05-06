const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/authMiddleware");
const asyncRoute = require("../middleware/asyncMiddleware");

const { readDb, writeDb } = require("../services/db");

const {
  recommendProducts,
  smartNotifications,
  logActivity
} = require("../utils/helpers");

console.log("✅✅✅ PRODUCT ROUTES FILE IS LOADED ✅✅✅");
// ==================== GET PRODUCTS ====================
// FIXED: /products → /
router.get(
  "/",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const { category, search, limit = 50 } = req.query;

    let products = [...db.products];

    if (category) {
      products = products.filter(p =>
        p.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (search) {
      products = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    products = products.slice(0, parseInt(limit));

    const categories = [...new Set(db.products.map(p => p.category))];

    const recommendations =
      req.auth.role === "user"
        ? recommendProducts(db, req.auth.id)
        : [];

    const featured = products.slice(0, 4);

    res.json({
      success: true,
      data: {
        categories,
        products,
        recommendations,
        featured,
        total: products.length
      }
    });
  })
);


// ==================== GET SINGLE PRODUCT ====================
// FIXED: /products/:id → /:id
router.get(
  "/:productId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const { productId } = req.params;

    const product = db.products.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found"
      });
    }

    const related = db.products
      .filter(p => p.category === product.category && p.id !== productId)
      .slice(0, 4);

    res.json({
      success: true,
      data: {
        product,
        related,
        inStock: true
      }
    });
  })
);


// ==================== GET YOGA ====================
// FIXED: /yoga already correct under /api/yoga
router.get(
  "/yoga",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const { phase } = req.query;

    let yoga = [...db.yoga];

    if (phase && ["Menstruation", "Follicular", "Ovulation", "Luteal"].includes(phase)) {
      const phaseYoga = {
        Menstruation: ["child-pose", "legs-up", "butterfly"],
        Follicular: ["cat-cow", "cobra"],
        Ovulation: ["cat-cow", "butterfly"],
        Luteal: ["child-pose", "butterfly"]
      };

      const recommendedIds = phaseYoga[phase] || [];
      yoga = yoga.filter(y => recommendedIds.includes(y.id));
    }

    res.json({
      success: true,
      data: {
        yoga,
        total: yoga.length,
        recommendation: phase ? `Recommended poses for ${phase}` : null
      }
    });
  })
);


// ==================== GET SINGLE YOGA ====================
router.get(
  "/yoga/:poseId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const { poseId } = req.params;

    const pose = db.yoga.find(p => p.id === poseId);

    if (!pose) {
      return res.status(404).json({
        success: false,
        error: "Yoga pose not found"
      });
    }

    res.json({
      success: true,
      data: {
        pose,
        similar: db.yoga.filter(p => p.id !== poseId).slice(0, 3)
      }
    });
  })
);


// ==================== NOTIFICATIONS ====================
router.get(
  "/notifications",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const user = db.users.find(u => u.id === req.auth.id);

    let messages;

    if (user && req.auth.role === "user") {
      messages = smartNotifications(db, user);
    } else {
      messages = (db.notifications || []).slice(0, 3);
    }

    res.json({
      success: true,
      data: {
        messages: messages.map(message => ({
          message,
          timestamp: new Date().toISOString(),
          read: false
        })),
        count: messages.length
      }
    });
  })
);


// ==================== EDUCATION ====================
// FIXED: remove /education prefix
router.get(
  "/education",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();

    res.json({
      success: true,
      data: {
        education: db.education || []
      }
    });
  })
);


module.exports = router;