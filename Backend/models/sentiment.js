const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userPhone: {
    type: String,
    required: true,
  },
  feedback: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  sentiment: {
    score: Number,
    comparative: Number,
    positive: [String],
    negative: [String],
    tokens: [String],
    wordAnalysis: {
      positiveWords: [{
        word: String,
        score: Number,
        count: Number
      }],
      negativeWords: [{
        word: String,
        score: Number,
        count: Number
      }]
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
