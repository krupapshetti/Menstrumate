const express = require("express");
const router = express.Router();

// REPLACE: Remove GoogleGenerativeAI import
// const { GoogleGenerativeAI } = require("@google/generative-ai");

// ADD: Import Groq
const Groq = require("groq-sdk");

// REPLACE: Initialize Groq client instead of Gemini
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_KEY");
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "your-groq-api-key-here"
});

router.post("/", async (req, res) => {
  try {
    const { symptoms } = req.body;
    
    if (!symptoms) {
      return res.status(400).json({ error: "Please enter your symptoms" });
    }

    // REPLACE: Change the model call from Gemini to Groq
    // OLD: const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `Create a 7-day diet plan for someone experiencing these menstrual symptoms: ${symptoms}.
    
    Return ONLY valid JSON in this exact format, no other text:
    {
      "plan": [
        {
          "day": 1,
          "protein": "meal type",
          "breakfast": "meal suggestion",
          "lunch": "meal suggestion",
          "snack": "meal suggestion",
          "dinner": "meal suggestion"
        }
      ]
    }
    
    Focus on:
    - Anti-inflammatory foods for cramps
    - Iron-rich foods for fatigue
    - Magnesium-rich foods for headaches
    - Low-sodium foods for bloating
    - Complex carbs for mood swings
    - Include traditional Indian food options`;

    // NEW: Groq API call
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",  // or "llama-3.1-8b-instant" for faster responses
      messages: [
        {
          role: "system",
          content: "You are a professional dietitian specializing in menstrual health. Always respond with valid JSON only, no markdown or extra text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    // NEW: Extract the response text from Groq
    let text = completion.choices[0].message.content;
    
    // Clean the response (same cleaning logic as before)
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const planData = JSON.parse(text);
    res.json(planData);

  } catch (err) {
    console.error("Diet plan error:", err.message);
    
    // Keep your fallback plan (no changes needed here)
    const fallbackPlan = {
      plan: [
        { day: 1, protein: "Iron-rich", breakfast: "Spinach paratha with yogurt", lunch: "Dal khichdi with vegetables", snack: "Dates and nuts", dinner: "Palak paneer with roti" },
        { day: 2, protein: "Light", breakfast: "Oats upma with vegetables", lunch: "Brown rice with rajma", snack: "Fruit chaat", dinner: "Vegetable soup with bread" },
        { day: 3, protein: "Energy", breakfast: "Moong dal chilla", lunch: "Quinoa pulao with raita", snack: "Roasted chana", dinner: "Paneer bhurji with paratha" },
        { day: 4, protein: "Balanced", breakfast: "Poha with peanuts", lunch: "Chole with rice", snack: "Coconut water", dinner: "Lauki kofta with roti" },
        { day: 5, protein: "Light", breakfast: "Idli with sambar", lunch: "Curd rice with pickle", snack: "Buttermilk", dinner: "Vegetable dalia" },
        { day: 6, protein: "Iron-rich", breakfast: "Besan cheela", lunch: "Fish curry with rice", snack: "Dark chocolate", dinner: "Baingan bharta with roti" },
        { day: 7, protein: "Balanced", breakfast: "Masala dosa", lunch: "Biryani with raita", snack: "Kheer", dinner: "Light soup with salad" }
      ]
    };
    
    res.json(fallbackPlan);
  }
});

module.exports = router;