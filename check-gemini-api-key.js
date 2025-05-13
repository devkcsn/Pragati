/**
 * Gemini API Key Validator
 * 
 * This script checks if the Gemini API key stored in your .env file is valid.
 * It makes a simple request to the Gemini API and reports the result.
 * 
 * Usage:
 * node check-gemini-api-key.js
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function checkApiKey() {
    console.log('\n==== Gemini API Key Validator ====\n');
    
    // Check if API key exists
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ ERROR: No Gemini API key found in .env file!');
        console.log('Please add your API key to the .env file as GEMINI_API_KEY=your_key_here');
        console.log('Get your API key from: https://makersuite.google.com/app/apikey');
        return;
    }
    
    if (apiKey === 'your_actual_gemini_api_key_here') {
        console.error('❌ ERROR: Default placeholder API key detected in .env file!');
        console.log('Please replace the placeholder with your actual API key from: https://makersuite.google.com/app/apikey');
        return;
    }
    
    // Initialize the Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Try a simple request
    try {
        console.log('Testing API key with a simple request...');
        const result = await model.generateContent('Say "API key is working correctly" if you can read this message.');
        const response = await result.response;
        const text = response.text();
        
        console.log('\n✅ Success! API key is valid.');
        console.log('Response from Gemini API:');
        console.log('-------------------------');
        console.log(text);
        console.log('-------------------------\n');
        console.log('Your Gemini integration is ready to use!\n');
    } catch (error) {
        console.error('\n❌ ERROR: API key test failed!');
        console.error('Error details:', error.message);
        
        if (error.message.includes('API key not valid')) {
            console.log('\nThe API key in your .env file appears to be invalid.');
            console.log('Please follow these steps to get a valid API key:');
            console.log('1. Go to https://makersuite.google.com/app/apikey');
            console.log('2. Sign in with your Google account');
            console.log('3. Create a new API key or use an existing one');
            console.log('4. Copy the API key to your .env file');
            console.log('5. Run this validation script again');
        }
    }
}

// Run the check
checkApiKey().catch(err => {
    console.error('Unexpected error:', err);
});
