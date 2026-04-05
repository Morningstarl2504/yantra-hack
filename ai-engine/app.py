import os
import re
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import PyPDF2
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app)

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

# Fixed: use a dict keyed by session_id instead of a single global variable
# This prevents users from overwriting each other's uploaded document context
SESSION_CONTEXTS = {}


# Added: simple health check endpoint for easier debugging
@app.route('/health')
def health():
    return jsonify({"status": "ok"})


# --- MODULE 1: Automated Content Processing ---
@app.route('/process-content', methods=['POST'])
def process_content():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    # Use session_id from request, fall back to 'default' for compatibility
    session_id = request.form.get('session_id', 'default')

    try:
        file = request.files['file']
        text_content = ""

        reader = PyPDF2.PdfReader(file)
        for page in reader.pages[:10]:
            text_content += page.extract_text() + "\n"

        # Fixed: store context per session instead of in a single global
        SESSION_CONTEXTS[session_id] = text_content

        prompt = f"Provide a concise, professional summary of the following educational material in one paragraph. Focus on the core concepts:\n\n{text_content[:5000]}"
        response = model.generate_content(prompt)

        return jsonify({
            "status": "success",
            "summary": response.text,
            "session_id": session_id
        })
    except Exception as e:
        logging.error(f"Processing error: {e}")
        return jsonify({"error": "Failed to analyze document. Ensure it is a valid PDF."}), 500


# --- MODULE 2: Multilingual AI Tutor ---
@app.route('/tutor-chat', methods=['POST'])
def tutor_chat():
    data = request.json
    user_query = data.get('query', '')
    language = data.get('language', 'English')
    session_id = data.get('session_id', 'default')

    context = SESSION_CONTEXTS.get(session_id, "")
    if not context:
        return jsonify({"status": "error", "response": "Please upload a document in the 'Automated Content Processing' tab first."})

    try:
        prompt = f"""
        You are an expert, highly helpful AI tutor.
        Answer the student's question using ONLY the provided Course Material.
        If the answer is not in the material, state that it is not covered in the current syllabus.
        You MUST provide your response entirely in {language}.

        Course Material Context: {context[:6000]}

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
    data = request.json or {}
    session_id = data.get('session_id', 'default')

    context = SESSION_CONTEXTS.get(session_id, "")
    if not context:
        return jsonify({"error": "Please upload course material first."}), 400

    # Fixed: retry up to 3 times in case Gemini returns malformed JSON
    for attempt in range(3):
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

            Course Material: {context[:5000]}
            """
            response = model.generate_content(prompt)

            # Fixed: use regex to robustly strip any markdown fences Gemini might add
            clean_json = re.sub(r'```(?:json)?\s*|\s*```', '', response.text).strip()
            quiz_data = json.loads(clean_json)

            return jsonify({"status": "success", "assessment": quiz_data})

        except json.JSONDecodeError as e:
            logging.warning(f"Quiz JSON parse failed (attempt {attempt + 1}): {e}")
            if attempt == 2:
                logging.error("All 3 attempts to generate a valid quiz failed.")
                return jsonify({"error": "Failed to generate quiz after 3 attempts. Try again."}), 500
        except Exception as e:
            logging.error(f"Quiz error: {e}")
            return jsonify({"error": "Failed to generate quiz. Try again."}), 500


if __name__ == '__main__':
    # Fixed: only enable debug mode in development, never in production
    is_dev = os.getenv("FLASK_ENV") == "development"
    app.run(port=5001, debug=is_dev)