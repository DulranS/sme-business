const { GoogleGenerativeAI } = require("@google/generative-ai");
import retry from 'async-retry';

// Initialize GoogleGenerativeAI with your API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Create a generative model instance
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function analyzeProduct(product) {
  const prompt = `Analyze this product as a potential "winning product": "${product.name}". Rate it on a scale of 1-10. Your response should include a clear numeric score between 1 and 10, formatted as 'Score: X' where X is the numeric score.`;

  return retry(async (bail) => {
    try {
      // Generate content using the Gemini model
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }]}],
        generationConfig: {
          temperature: 0.2,
          topK: 1,
          topP: 1,
          maxOutputTokens: 200,
        },
      });

      const response = await result.response;
      const text = response.text();
      const structuredOutput = response.candidates[0]?.content?.parts[0]?.functionCall;

      if (structuredOutput && structuredOutput.name === 'setScore' && structuredOutput.args?.score) {
        return { ...product, aiScore: parseInt(structuredOutput.args.score, 10) };
      } else {
        // Fallback to text parsing if structured output is not available
        const aiScoreMatch = text.match(/Score:\s*(\d+)/i);
        if (!aiScoreMatch) {
          console.log("Full AI response:", text);  // Log the full response for debugging
          throw new Error("AI response did not contain a valid score");
        }

        const aiScore = parseInt(aiScoreMatch[1], 10);
        if (isNaN(aiScore)) {
          throw new Error("Parsed AI score is not a number");
        }

        return { ...product, aiScore };
      }
    } catch (error) {
      console.error("Error in analyzeProduct:", error.message);
      console.log("Full AI response:", text);  // Log the full response on error
      if (error.response && error.response.status === 429) {
        // Retry on rate limit errors
        throw error;
      }
      // Bail out for other errors to avoid unnecessary retries
      bail(error);
      return { ...product, aiScore: null }; // Return product with null score on failure
    }
  }, {
    retries: 3, // Number of retries
    factor: 2, // Exponential backoff factor
    minTimeout: 1000, // Minimum wait time between retries
    maxTimeout: 5000, // Maximum wait time between retries
  });
}

export async function analyzeProducts(products) {
  const analyzedProducts = await Promise.all(products.map(analyzeProduct));
  return analyzedProducts
    .filter(product => product.aiScore !== null) // Filter out failed analyses
    .sort((a, b) => b.aiScore - a.aiScore);
}