const mongoose = require("mongoose");

const communityPostSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  authorId: { type: String, required: true },
  body: { type: String, required: true },
  mood: { type: String, default: "" },
  reactions: [mongoose.Schema.Types.Mixed],
  comments: [mongoose.Schema.Types.Mixed],
  createdAt: { type: String, required: true }
}, { minimize: false });

module.exports = mongoose.model("CommunityPost", communityPostSchema);
