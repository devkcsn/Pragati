# Gemini AI Integration Guide for Pragati Quiz Generator

This guide will help you set up and use the Gemini AI integration for automatically generating quiz questions.

## 1. Getting a Gemini API Key

To use the Gemini AI feature, you need a valid API key from Google:

1. Visit [Google AI Studio](https://ai.google.dev/)
2. Click "Get API key" or go directly to [API key management](https://makersuite.google.com/app/apikey)
3. Sign in with your Google account
4. Create a new API key (or use an existing one)
5. Copy the API key value

## 2. Configuring Your API Key

Once you have your API key:

1. Open the `.env` file in the root of the Pragati project
2. Find the line that says: `GEMINI_API_KEY=your_actual_gemini_api_key_here`
3. Replace `your_actual_gemini_api_key_here` with your actual API key
4. Save the file

Example:
```
GEMINI_API_KEY=AIzaSyD1cKPx52VtyF9yRRbAZ95KTOhFhRPt8UC
```
(This is a fake example key, use your actual key)

## 3. Validating Your API Key

To check that your API key is working:

1. Open a terminal in the project directory
2. Run the validation script:
   ```
   node check-gemini-api-key.js
   ```
3. If successful, you'll see a confirmation message
4. If there's an error, follow the instructions provided in the error message

## 4. Using the Gemini AI Quiz Generator

Once your API key is set up:

1. Go to the "Create Quiz" page in the Pragati application
2. Enter a quiz title
3. In the "Quiz Topic" field, enter the subject you want questions about (e.g., "Python programming fundamentals" or "World War II")
4. Click the "Generate with Gemini" button
5. Specify how many questions you want (1-20)
6. Click "Generate" and wait for the AI to create the questions
7. Review and edit the generated questions as needed before submitting the quiz

## 5. Troubleshooting

If you encounter issues with the Gemini integration:

- **API Key Error**: Ensure your API key is correctly copied from Google AI Studio
- **Quota Exceeded**: You may have reached your API usage limit. Check your quota in Google AI Studio.
- **Network Issues**: Make sure your server has internet access to connect to Google's API
- **Invalid Responses**: If questions aren't properly formatted, try a different, more specific topic

## 6. API Usage and Costs

Google's Gemini API may have usage limits or costs associated with it:

- Check [Google AI Studio pricing](https://ai.google.dev/pricing) for current rates
- Monitor your API usage through the Google Cloud Console
- Consider implementing rate limiting for production use

For more help, contact your system administrator.
