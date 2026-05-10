// Products
const seedProducts = [
  { id: "pads-regular", category: "Sanitary Pads", name: "Soft Cotton Sanitary Pads", price: 120, image: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80" },
  { id: "pads-night", category: "Sanitary Pads", name: "Overnight Flow Pads", price: 180, image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=600&q=80" },
  { id: "tampons-compact", category: "Tampons", name: "Compact Tampons", price: 210, image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80" },
  { id: "cup-classic", category: "Menstrual Cups", name: "Reusable Menstrual Cup", price: 499, image: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=600&q=80" },
  { id: "heat-electric", category: "Heating Pads", name: "Portable Heating Pad", price: 699, image: "https://images.unsplash.com/photo-1616699002805-0741e1e4a9c5?auto=format&fit=crop&w=600&q=80" },
  { id: "relief-roll", category: "Pain Relief", name: "Cramp Relief Roll-On", price: 160, image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80" },
  { id: "relief-patch", category: "Pain Relief", name: "Warm Relief Patches", price: 240, image: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=600&q=80" },
  { id: "comfort-chocolate", category: "Chocolate / Comfort", name: "Dark Chocolate Comfort Bar", price: 95, image: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80" },
  { id: "comfort-tea", category: "Chocolate / Comfort", name: "Ginger Chamomile Tea", price: 175, image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?auto=format&fit=crop&w=600&q=80" }
];

// Yoga Poses
const seedYoga = [
  { id: "child-pose", name: "Child's Pose", duration: 60, instructions: "Fold forward with knees apart, rest your forehead down, and breathe slowly into your lower back.", animation: "fold", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=80" },
  { id: "cat-cow", name: "Cat-Cow Flow", duration: 90, instructions: "Move between rounding and arching your spine with each breath to release cramps and back tension.", animation: "wave", image: "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=900&q=80" },
  { id: "cobra", name: "Gentle Cobra", duration: 45, instructions: "Lie on your belly, press palms down, and lift your chest gently without straining your lower back.", animation: "rise", image: "https://images.unsplash.com/photo-1593811167562-9cef47bfc4d7?auto=format&fit=crop&w=900&q=80" },
  { id: "butterfly", name: "Butterfly Stretch", duration: 75, instructions: "Bring soles together, hold your feet, and let your knees soften toward the floor.", animation: "butterfly", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80" },
  { id: "legs-up", name: "Legs Up Rest", duration: 120, instructions: "Rest on your back with legs elevated against a wall or cushion to calm fatigue.", animation: "legs", image: "https://images.unsplash.com/photo-1599447421416-3414500d18a5?auto=format&fit=crop&w=900&q=80" }
];

// Education Content
const seedEducation = [
  { id: "cycle-basics", topic: "Menstruation Info", title: "Cycle basics", body: "A menstrual cycle is counted from the first day of bleeding to the day before the next period starts. Many cycles are between 21 and 35 days." },
  { id: "hygiene", topic: "Health Tips", title: "Hygiene and comfort", body: "Change pads or tampons regularly, wash hands before and after, stay hydrated, and seek medical advice for severe pain or very heavy bleeding." },
  { id: "consent", topic: "Basic Sex Education", title: "Consent and protection", body: "Consent must be clear, mutual, and reversible. Condoms and medical contraception help reduce pregnancy risk, and condoms also reduce STI risk." },
  { id: "when-doctor", topic: "Health Tips", title: "When to consult a doctor", body: "Talk to a doctor if periods stop unexpectedly, pain disrupts daily life, bleeding is unusually heavy, or cycles suddenly change a lot." }
];

// Notifications
const seedNotifications = [
  "Drink water and keep a warm pad nearby today.",
  "Your body is doing real work. Take the slower option when you can.",
  "A protein-rich snack can help with weakness and mood dips.",
  "Stretch your shoulders, unclench your jaw, and breathe for 30 seconds.",
  "Pack an extra pad, tampon, or cup before heading out."
];

// Symptom Options
const seedSymptomOptions = [
  "Cramps",
  "Bloating",
  "Headache",
  "Mood swings",
  "Fatigue",
  "Acne",
  "Back pain",
  "Nausea",
  "Breast tenderness",
  "Food cravings"
];

// Insight Rules
const seedInsightRules = [
  { symptom: "Cramps", message: "Frequent cramps detected. Try warm compresses and iron-rich meals.", action: "Add a heating pad or gentle yoga today." },
  { symptom: "Fatigue", message: "Fatigue has appeared often. Prioritize rest, hydration, and protein.", action: "Choose a lighter workout and plan an early night." },
  { symptom: "Bloating", message: "Bloating is recurring. Reduce excess salt and add potassium-rich foods.", action: "Try cucumber water or banana with curd." },
  { symptom: "Headache", message: "Headaches are recurring. Hydration and regular meals may help.", action: "Avoid skipping meals and track caffeine." },
  { symptom: "Mood swings", message: "Mood changes are showing a pattern. Magnesium-rich snacks may help.", action: "Schedule a low-pressure day if possible." }
];

// Appointment Slots
const seedAppointmentSlots = ["09:30", "10:30", "11:30", "14:30", "16:00"];

// Shop Rules
const seedShopRules = [
  { match: "cramps", categories: ["Heating Pads", "Pain Relief"] },
  { match: "back pain", categories: ["Heating Pads", "Pain Relief"] },
  { match: "fatigue", categories: ["Chocolate / Comfort"] },
  { match: "mood swings", categories: ["Chocolate / Comfort"] },
  { match: "bloating", categories: ["Herbal Teas"] },
  { match: "headache", categories: ["Pain Relief"] }
];

module.exports = {
  seedProducts,
  seedYoga,
  seedEducation,
  seedNotifications,
  seedSymptomOptions,
  seedInsightRules,
  seedAppointmentSlots,
  seedShopRules
};