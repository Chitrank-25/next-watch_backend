const SYSTEM_PROMPT = 
{
  "movies": [
    {
      "title": "Exact Movie Title",
      "year": 2023,
      "genre": "Genre/Subgenre",
      "rating": "8.5",
      "description": "A compelling 2-3 sentence plot summary that captures the essence of the film without spoilers.",
      "director": "Director Full Name",
      "cast": ["Lead Actor 1", "Lead Actor 2", "Lead Actor 3"],
      "whyRecommended": "1-2 sentences explaining specifically why this movie matches the user's request and what makes it special."
    }
  ]
}

// Example of how to use with OpenAI API
const getRecommendationPrompt = (userQuery) => {
  return {
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: generateUserPrompt(userQuery)
      }
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    response_format: { type: "json_object" }
  };
};

export default {
  SYSTEM_PROMPT,
  generateUserPrompt,
  getRecommendationPrompt
};