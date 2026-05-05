const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const asyncRoute = require("../middleware/asyncMiddleware");
const { readDb, writeDb } = require("../services/db");
const { makeQrSvg } = require("../utils/payment");
const { logActivity } = require("../utils/activity");

// Helper function to clean MongoDB documents
function cleanDocument(doc) {
  if (!doc) return doc;
  const cleaned = { ...doc };
  delete cleaned._id;
  delete cleaned.__v;
  return cleaned;
}

function cleanCartItems(cart) {
  if (!Array.isArray(cart)) return [];
  return cart.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    addedAt: item.addedAt
  }));
}

// ==================== GET CART ====================
router.get(
  "/",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    
    if (!db.carts) db.carts = {};
    if (!db.carts[req.auth.id]) db.carts[req.auth.id] = [];
    
    // Clean the cart items to remove MongoDB _id fields
    const cleanCart = cleanCartItems(db.carts[req.auth.id]);
    
    // Enrich cart items with product details
    const enrichedItems = cleanCart.map((item) => {
      const product = db.products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        product: product ? {
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          image: product.image
        } : null,
        subtotal: product ? product.price * item.quantity : 0
      };
    });

    const total = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = cleanCart.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      success: true,
      items: enrichedItems,
      total: total,
      itemCount: itemCount
    });
  })
);

// ==================== ADD TO CART ====================
router.post(
  "/items",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { productId, quantity = 1 } = req.body;

    console.log('=== ADD TO CART ===');
    console.log('Product:', productId, 'Quantity:', quantity, 'User:', req.auth.id);

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({ error: "Quantity must be a positive number" });
    }

    const db = await readDb();

    const product = db.products.find((item) => item.id === productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Initialize
    if (!db.carts) db.carts = {};
    if (!db.carts[req.auth.id]) db.carts[req.auth.id] = [];

    // Get clean cart (remove MongoDB fields)
    let userCart = cleanCartItems(db.carts[req.auth.id]);
    console.log('Current cart before update:', JSON.stringify(userCart));

    // Find and update or add
    let found = false;
    for (let i = 0; i < userCart.length; i++) {
      if (userCart[i].productId === productId) {
        userCart[i].quantity += parsedQuantity;
        found = true;
        console.log(`✅ Updated existing item: ${productId} - new quantity: ${userCart[i].quantity}`);
        break;
      }
    }

    if (!found) {
      userCart.push({
        productId,
        quantity: parsedQuantity,
        addedAt: new Date().toISOString()
      });
      console.log(`✅ Added new item: ${productId} - quantity: ${parsedQuantity}`);
    }

    // Save clean cart back to database
    db.carts[req.auth.id] = userCart;
    await writeDb(db);
    
    console.log('Cart after save:', JSON.stringify(userCart));
    console.log('Total unique items:', userCart.length);

    if (logActivity) {
      await logActivity(db, req.auth.id, "cart-add", `Added ${parsedQuantity} x ${product.name} to cart`);
    }

    // Build response with enriched data
    const enrichedItems = userCart.map((item) => {
      const prod = db.products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        product: prod ? {
          id: prod.id,
          name: prod.name,
          price: prod.price,
          category: prod.category,
          image: prod.image
        } : null,
        subtotal: prod ? prod.price * item.quantity : 0
      };
    });

    const total = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = userCart.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      success: true,
      message: found ? "Cart updated" : "Item added to cart",
      items: enrichedItems,
      total: total,
      itemCount: itemCount
    });
  })
);

// ==================== UPDATE CART ITEM ====================
router.patch(
  "/items/:productId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { quantity } = req.body;
    const { productId } = req.params;
    
    if (quantity === undefined) {
      return res.status(400).json({ error: "Quantity is required" });
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({ error: "Quantity must be a non-negative number" });
    }

    const db = await readDb();
    
    if (!db.carts || !db.carts[req.auth.id]) {
      return res.status(404).json({ error: "Cart not found" });
    }

    let userCart = cleanCartItems(db.carts[req.auth.id]);
    const itemIndex = userCart.findIndex((entry) => entry.productId === productId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    if (parsedQuantity === 0) {
      userCart.splice(itemIndex, 1);
      console.log(`✅ Removed item ${productId} from cart`);
    } else {
      userCart[itemIndex].quantity = parsedQuantity;
      console.log(`✅ Updated ${productId} quantity to ${parsedQuantity}`);
    }

    db.carts[req.auth.id] = userCart;
    await writeDb(db);

    const enrichedItems = userCart.map((item) => {
      const product = db.products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        product: product ? {
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          image: product.image
        } : null,
        subtotal: product ? product.price * item.quantity : 0
      };
    });

    const total = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = userCart.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      success: true,
      message: parsedQuantity === 0 ? "Item removed from cart" : "Cart updated",
      items: enrichedItems,
      total: total,
      itemCount: itemCount
    });
  })
);

// ==================== REMOVE FROM CART ====================
router.delete(
  "/items/:productId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const { productId } = req.params;
    
    if (!db.carts) db.carts = {};
    
    if (db.carts[req.auth.id]) {
      let userCart = cleanCartItems(db.carts[req.auth.id]);
      userCart = userCart.filter((item) => item.productId !== productId);
      db.carts[req.auth.id] = userCart;
      await writeDb(db);
    }

    const cart = db.carts[req.auth.id] || [];
    const enrichedItems = cart.map((item) => {
      const product = db.products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        product: product ? {
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          image: product.image
        } : null,
        subtotal: product ? product.price * item.quantity : 0
      };
    });

    const total = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      success: true,
      message: "Item removed from cart",
      items: enrichedItems,
      total: total,
      itemCount: itemCount
    });
  })
);

// ==================== CLEAR CART ====================
router.delete(
  "/clear",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    
    if (!db.carts) db.carts = {};
    db.carts[req.auth.id] = [];
    await writeDb(db);

    if (logActivity) {
      await logActivity(db, req.auth.id, "cart-clear", "Cleared entire cart");
    }

    res.json({
      success: true,
      message: "Cart cleared successfully",
      items: [],
      total: 0,
      itemCount: 0
    });
  })
);

// ==================== CHECKOUT ====================
router.post(
  "/checkout",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const cart = cleanCartItems(db.carts[req.auth.id] || []);

    if (!cart.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const items = [];
    for (const entry of cart) {
      const product = db.products.find((p) => p.id === entry.productId);
      if (!product) {
        return res.status(400).json({ error: `Product ${entry.productId} no longer exists` });
      }
      items.push({
        ...product,
        quantity: entry.quantity,
        subtotal: product.price * entry.quantity
      });
    }

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: req.auth.id,
      amount: total,
      status: "pending",
      items: items.map(({ id, name, price, quantity }) => ({ id, name, price, quantity })),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };

    payment.qrCode = makeQrSvg(total, payment.id);
    if (!db.payments) db.payments = [];
    db.payments.push(payment);
    await writeDb(db);

    res.json({
      success: true,
      message: "Checkout initiated",
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        qrCode: payment.qrCode,
        expiresAt: payment.expiresAt,
        items: payment.items
      }
    });
  })
);

// ==================== CONFIRM PAYMENT ====================
router.post(
  "/payments/:id/confirm",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const payment = db.payments?.find((item) => item.id === req.params.id && item.userId === req.auth.id);

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.status === "paid") {
      return res.status(400).json({ error: "Payment already confirmed" });
    }

    if (payment.status === "expired" || new Date(payment.expiresAt) < new Date()) {
      payment.status = "expired";
      await writeDb(db);
      return res.status(400).json({ error: "Payment has expired" });
    }

    payment.status = "paid";
    payment.paidAt = new Date().toISOString();
    db.carts[req.auth.id] = [];
    await writeDb(db);

    res.json({
      success: true,
      message: "Payment confirmed",
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt
      }
    });
  })
);

// ==================== GET PAYMENT HISTORY ====================
router.get(
  "/payments",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const payments = (db.payments || [])
      .filter((p) => p.userId === req.auth.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({
      success: true,
      payments: payments.map(({ id, amount, status, createdAt, paidAt, items }) => ({
        id,
        amount,
        status,
        createdAt,
        paidAt,
        itemCount: items?.length || 0
      }))
    });
  })
);

// ==================== GET PAYMENT DETAILS ====================
router.get(
  "/payments/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = await readDb();
    const payment = (db.payments || []).find((item) => item.id === req.params.id && item.userId === req.auth.id);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    res.json({ success: true, payment });
  })
);

module.exports = router;