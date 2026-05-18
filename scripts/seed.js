const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Read the database
function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    return {
      users: [],
      doctors: [],
      products: [],
      yoga: [],
      education: [],
      symptoms: [],
      carts: {},
      appointments: [],
      cycles: [],
      chats: [],
      notifications: [],
      otps: []
    };
  }
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

// Write to database
function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function seedData() {
  const db = readDb();
  
  // Seed yoga poses
  if (!db.yoga || db.yoga.length === 0) {
    db.yoga = [
      {
        id: "child-pose",
        name: "Child's Pose",
        instructions: "Kneel on the floor, touch your big toes together, sit on your heels, and fold forward.",
        duration: 60,
        image: "https://cdn.yogajournal.com/images/1200x675/filters:format(jpg)/2021/08/ChildsPose_Jackie_1600x900.jpg",
        category: "restorative"
      },
      {
        id: "cat-cow",
        name: "Cat-Cow Stretch",
        instructions: "Start on hands and knees, alternate between arching your back (cat) and dipping it (cow).",
        duration: 45,
        image: "https://cdn.yogajournal.com/images/1200x675/filters:format(jpg)/2021/08/Cat-Cow_Jackie_1600x900.jpg",
        category: "gentle"
      },
      {
        id: "butterfly",
        name: "Butterfly Pose",
        instructions: "Sit with soles of feet together, knees drop to the sides, gently flap legs like butterfly wings.",
        duration: 60,
        image: "https://cdn.yogajournal.com/images/1200x675/filters:format(jpg)/2021/08/BoundAnglePose_Jackie_1600x900.jpg",
        category: "hip-opening"
      },
      {
        id: "legs-up",
        name: "Legs Up The Wall",
        instructions: "Lie on your back with legs extended up against a wall, relax for several minutes.",
        duration: 120,
        image: "https://cdn.yogajournal.com/images/1200x675/filters:format(jpg)/2021/08/LegsUpWall_Jackie_1600x900.jpg",
        category: "restorative"
      },
      {
        id: "cobra",
        name: "Cobra Pose",
        instructions: "Lie on your stomach, place hands under shoulders, and gently lift your chest.",
        duration: 30,
        image: "https://cdn.yogajournal.com/images/1200x675/filters:format(jpg)/2021/08/CobraPose_Jackie_1600x900.jpg",
        category: "backbend"
      }
    ];
    console.log("✅ Seeded yoga data");
  } else {
    console.log("⚠️ Yoga data already exists");
  }
  
  // Seed education content
  if (!db.education || db.education.length === 0) {
    db.education = [
      {
        topic: "Menstruation",
        title: "Understanding Your Menstrual Cycle",
        body: "The menstrual cycle is a natural process that prepares your body for pregnancy each month. A typical cycle lasts 28 days but can range from 21 to 35 days."
      },
      {
        topic: "Health Tips",
        title: "Managing Menstrual Pain",
        body: "Common remedies include heat therapy (heating pad or warm bath), gentle exercise like yoga, over-the-counter pain relievers, and staying hydrated."
      },
      {
        topic: "Wellness",
        title: "Hormone Balance Through Diet",
        body: "Eating a balanced diet rich in iron, calcium, and omega-3s can help support hormone balance. Foods like leafy greens, nuts, seeds, and fatty fish are excellent choices."
      },
      {
        topic: "Sex Education",
        title: "Reproductive Health Basics",
        body: "Understanding your cycle helps with family planning. The fertile window is typically 5 days before ovulation and the day of ovulation itself."
      },
      {
        topic: "Mental Health",
        title: "Managing PMS Mood Changes",
        body: "Hormonal fluctuations can affect mood. Regular exercise, adequate sleep, stress management, and tracking your cycle can help you anticipate and manage these changes."
      },
      {
        topic: "Nutrition",
        title: "Foods for Each Cycle Phase",
        body: "During menstruation: Iron-rich foods. Follicular phase: Fermented foods and healthy fats. Ovulation: Fiber-rich vegetables. Luteal phase: Complex carbs and magnesium-rich foods."
      }
    ];
    console.log("✅ Seeded education data");
  } else {
    console.log("⚠️ Education data already exists");
  }
  
  // Seed products if none exist
  if (!db.products || db.products.length === 0) {
    db.products = [
      {
        id: "prod_1",
        name: "Period Pain Relief Patches",
        description: "Natural heat therapy patches for menstrual cramps",
        price: 499,
        category: "Wellness",
        image: "https://via.placeholder.com/200?text=Pain+Relief"
      },
      {
        id: "prod_2",
        name: "Organic Sanitary Pads",
        description: "100% organic cotton, chemical-free sanitary pads",
        price: 299,
        category: "Hygiene",
        image: "https://via.placeholder.com/200?text=Pads"
      },
      {
        id: "prod_3",
        name: "Menstrual Cup",
        description: "Reusable silicone menstrual cup, eco-friendly",
        price: 899,
        category: "Hygiene",
        image: "https://via.placeholder.com/200?text=Cup"
      },
      {
        id: "prod_4",
        name: "Herbal Tea for Cramps",
        description: "Organic herbal tea blend for period relief",
        price: 349,
        category: "Wellness",
        image: "https://via.placeholder.com/200?text=Tea"
      },
      {
        id: "prod_5",
        name: "Magnesium Supplements",
        description: "Helps reduce muscle cramps and improves sleep",
        price: 599,
        category: "Supplements",
        image: "https://via.placeholder.com/200?text=Magnesium"
      }
    ];
    db.categories = ["Wellness", "Hygiene", "Supplements"];
    console.log("✅ Seeded products data");
  } else {
    console.log("⚠️ Products data already exists");
  }
  
  writeDb(db);
  console.log("\n✅ Database seeded successfully!");
  console.log(`   - ${db.yoga?.length || 0} yoga poses`);
  console.log(`   - ${db.education?.length || 0} education articles`);
  console.log(`   - ${db.products?.length || 0} products`);
}

seedData().catch(console.error);