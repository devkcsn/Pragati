const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Check if API key is provided in environment variables
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_actual_gemini_api_key_here') {
    console.error('ERROR: Valid Gemini API key is missing. Please update your .env file with a valid API key from https://makersuite.google.com/app/apikey');
}

// Initialize Gemini API with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Endpoint to generate quiz questions with Gemini
router.post('/generate-quiz', async (req, res) => {
    try {
        const { topic, questionCount } = req.body;
        
        if (!topic) {
            return res.status(400).json({ success: false, message: 'Topic is required' });
        }
        
        const count = parseInt(questionCount, 10) || 5;
        
        // Validate count is within reasonable limits
        if (count < 1 || count > 20) {
            return res.status(400).json({ 
                success: false, 
                message: 'Question count must be between 1 and 20' 
            });
        }

        // Get the generative model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Craft a prompt that will return structured data
        const prompt = `
        Create a quiz on the topic: ${topic}
        
        Generate ${count} multiple-choice questions with 4 options each, where only one option is correct.
        
        Format the output as valid JSON in the following format exactly:
        {
          "questions": [
            {
              "text": "Question 1 text",
              "options": [
                {"text": "Option 1", "isCorrect": false},
                {"text": "Option 2", "isCorrect": true},
                {"text": "Option 3", "isCorrect": false},
                {"text": "Option 4", "isCorrect": false}
              ]
            }
            // more questions...
          ]
        }
        
        Ensure that:
        1. All questions are factually accurate
        2. Each question has exactly 4 options
        3. Each question has exactly one correct answer (isCorrect: true)
        4. The JSON is formatted exactly as specified
        5. Questions are clearly worded and appropriate for assessments
        `;

        // Generate content
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Extract JSON from the response
        let jsonMatch = text.match(/({[\s\S]*})/);
        if (!jsonMatch) {
            throw new Error('Failed to parse JSON from Gemini response');
        }
        
        // Parse the JSON response
        const quizData = JSON.parse(jsonMatch[0]);
        
        // Validate the structure
        if (!quizData.questions || !Array.isArray(quizData.questions)) {
            throw new Error('Invalid response format from Gemini');
        }
        
        // Return the questions
        return res.json({
            success: true,
            questions: quizData.questions
        });
          } catch (error) {
        console.error('Gemini API Error:', error);
        
        // Check for API key related errors
        if (error.message && error.message.includes('API key not valid')) {
            return res.status(500).json({ 
                success: false, 
                message: 'Invalid Gemini API key. Please update your .env file with a valid API key from https://makersuite.google.com/app/apikey',
                error: 'API_KEY_INVALID'
            });
        }
        
        // Handle other errors
        res.status(500).json({ 
            success: false, 
            message: 'Error generating questions with Gemini',
            error: error.message
        });
    }
});

module.exports = router;
