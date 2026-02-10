const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const mongoose = require('mongoose');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/next-watch', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// Mongoose Schemas
const movieRecommendationSchema = new mongoose.Schema({
  userQuery: {
    type: String,
    required: true
  },
  recommendations: [{
    title: String,
    year: Number,
    genre: String,
    rating: String,
    description: String,
    director: String,
    cast: [String],
    whyRecommended: String,
    posterUrl: String
  }],
  userId: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const MovieRecommendation = mongoose.model('MovieRecommendation', movieRecommendationSchema);

// User search history schema
const searchHistorySchema = new mongoose.Schema({
  userId: String,
  query: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);

// Register CORS
fastify.register(cors, {
  origin: '*'
});

// Routes

// Health Check
fastify.get('/api/health', async (request, reply) => {
  return { 
    status: 'OK', 
    message: 'Next Watch API is running',
    timestamp: new Date().toISOString()
  };
});

// Generate Movie Recommendations
fastify.post('/api/recommend', async (request, reply) => {
  try {
    const { userQuery, userId } = request.body;

    if (!userQuery) {
      return reply.code(400).send({ 
        success: false, 
        error: 'User query is required' 
      });
    }

    console.log(' Received query:', userQuery);

    // Save search history
    if (userId) {
      await SearchHistory.create({ userId, query: userQuery });
    }
  
 
  // Call OpenAI to generate movie recommendations
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a movie recommendation AI. Based on the user's request, recommend 3 movies in JSON format with the following structure:
{
  "movies": [
    {
      "title": "Movie Title",
      "year": 2023,
      "genre": "Action/Thriller",
      "rating": "8.5",
      "description": "A brief 2-3 sentence description of the movie plot",
      "director": "Director Name",
      "cast": ["Actor 1", "Actor 2", "Actor 3"],
      "whyRecommended": "1-2 sentences explaining why this matches the user's request"
    }
  ]
}`
        },
        
        {
          role: "user",
          content: userQuery
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    let recommendations;
    try {
      const content = completion.choices[0].message.content;
      console.log(' OpenAI Response:', content);
      
      const parsed = JSON.parse(content);
      
      // Handle different response formats
      if (Array.isArray(parsed)) {
        recommendations = parsed;
      } else if (parsed.movies) {
        recommendations = parsed.movies;
      } else if (parsed.recommendations) {
        recommendations = parsed.recommendations;
      } else {
        recommendations = Object.values(parsed).filter(item => typeof item === 'object');
      }

      // Ensure we have exactly 3 recommendations
      recommendations = recommendations.slice(0, 3);

    } catch (parseError) {
      console.error(' Error parsing OpenAI response:', parseError);
      throw new Error('Failed to parse movie recommendations');
    }

    // Save to database
    const savedRecommendation = await MovieRecommendation.create({
      userQuery,
      recommendations,
      userId: userId || 'anonymous'
    });

    console.log(' Generated recommendations:', recommendations.length);

    return {
      success: true,
      query: userQuery,
      recommendations: recommendations,
      recommendationId: savedRecommendation._id
    };

  } catch (error) {
    console.error(' Error generating recommendations:', error);
    return reply.code(500).send({
      success: false,
      error: 'Failed to generate recommendations',
      message: error.message
    });
  }
});
      
// Get user's search history
fastify.get('/api/history/:userId', async (request, reply) => {
  try {
    const { userId } = request.params;
    
    const history = await SearchHistory
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(10);

    return {
      success: true,
      history
    };
  } catch (error) {
    console.error(' Error fetching history:', error);
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch history'
    });
  }
});

// Get saved recommendations
fastify.get('/api/recommendations/:userId', async (request, reply) => {
  try {
    const { userId } = request.params;
    
    const recommendations = await MovieRecommendation
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);

    return {
      success: true,
      recommendations
    };
  } catch (error) {
    console.error(' Error fetching recommendations:', error);
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch recommendations'
    });
  }
});

// Get recommendation by ID
fastify.get('/api/recommendation/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    
    const recommendation = await MovieRecommendation.findById(id);

    if (!recommendation) {
      return reply.code(404).send({
        success: false,
        error: 'Recommendation not found'
      });
    }

    return {
      success: true,
      recommendation
    };
  } catch (error) {
    console.error(' Error fetching recommendation:', error);
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch recommendation'
    });
  }
});

// Start server
const start = async () => {
  try {
    await connectDB();
    await fastify.listen({ 
      port: process.env.PORT || 3001,
      host: '0.0.0.0'
    });
    console.log(`Server running on port ${process.env.PORT || 3001}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();