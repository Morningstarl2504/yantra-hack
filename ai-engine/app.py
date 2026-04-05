import os
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import PyPDF2
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables (API Key)
load_dotenv()

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
# Enable CORS so the React frontend can communicate with this API
CORS(app) 

# Configure Gemini
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

# Global variable to store document context for the hackathon prototype
GLOBAL_CONTEXT = ""

# --- MODULE 1: Automated Content Processing ---
@app.route('/process-content', methods=['POST'])
def process_content():
    global GLOBAL_CONTEXT
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    try:
        file = request.files['file']
        text_content = ""
        
        # Read PDF content
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages[:10]: # Limit to first 10 pages for speed
            text_content += page.extract_text() + "\n"
            
        GLOBAL_CONTEXT = text_content 
        
        # Generate Summary
        prompt = f"Provide a concise, professional summary of the following educational material in one paragraph. Focus on the core concepts:\n\n{text_content[:5000]}"
        response = model.generate_content(prompt)
        
        return jsonify({
            "status": "success", 
            "summary": response.text
        })
    except Exception as e:
        logging.error(f"Processing error: {e}")
        return jsonify({"error": "Failed to analyze document. Ensure it is a valid PDF."}), 500

# --- MODULE 2: Multilingual AI Tutor ---
@app.route('/tutor-chat', methods=['POST'])
def tutor_chat():
    global GLOBAL_CONTEXT
    data = request.json
    user_query = data.get('query', '')
    language = data.get('language', 'English')
    
    if not GLOBAL_CONTEXT:
        return jsonify({"status": "error", "response": "Please upload a document in the 'Automated Content Processing' tab first."})

    try:
        prompt = f"""
        You are an expert, highly helpful AI tutor. 
        Answer the student's question using ONLY the provided Course Material. 
        If the answer is not in the material, state that it is not covered in the current syllabus.
        You MUST provide your response entirely in {language}.
        
        Course Material Context: {GLOBAL_CONTEXT[:6000]}
        
        Student Question: {user_query}
        """
        response = model.generate_content(prompt)
        return jsonify({"status": "success", "response": response.text})
    except Exception as e:
        logging.error(f"Chat error: {e}")
        return jsonify({"status": "error", "response": "Error generating response."}), 500

# --- MODULE 3: Adaptive Assessment ---
@app.route('/generate-assessment', methods=['POST'])
def generate_assessment():
    global GLOBAL_CONTEXT
    if not GLOBAL_CONTEXT:
        return jsonify({"error": "Please upload course material first."}), 400

    try:
        prompt = f"""
        Based on the following course material, generate ONE multiple-choice question to test the student's understanding.
        Return ONLY a raw, valid JSON object. Do not include markdown formatting, backticks, or the word 'json'.
        
        Format exactly like this:
        {{
            "topic": "Main topic",
            "difficulty": "Intermediate",
            "question": "The question text here?",
            "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
            "answer": 0 
        }}
        Note: "answer" must be the integer index (0-3) of the correct option.
        
        Course Material: {GLOBAL_CONTEXT[:5000]}
        """
        response = model.generate_content(prompt)
        
        # Clean response to ensure it parses correctly
        clean_json = response.text.replace("```json", "").replace("```", "").strip()
        quiz_data = json.loads(clean_json)
        
        return jsonify({"status": "success", "assessment": quiz_data})
    except Exception as e:
        logging.error(f"Quiz error: {e}")
        return jsonify({"error": "Failed to generate quiz. Try again."}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)