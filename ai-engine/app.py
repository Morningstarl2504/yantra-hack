import os
import re
import io
import json
import base64
import logging
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import PyPDF2
import docx
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

text_model = genai.GenerativeModel('gemini-2.5-flash')

# { session_id: { "text": str, "file_uri": str|None, "mime_type": str, "type": "text"|"av" } }
SESSION_CONTEXTS = {}

SUPPORTED_EXTENSIONS = {'pdf', 'docx', 'doc', 'mp3', 'mp4', 'wav', 'm4a', 'webm'}


def get_mime_type(filename):
    ext = filename.rsplit('.', 1)[-1].lower()
    return {
        'pdf':  'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc':  'application/msword',
        'mp3':  'audio/mpeg',
        'wav':  'audio/wav',
        'm4a':  'audio/mp4',
        'webm': 'video/webm',
        'mp4':  'video/mp4',
    }.get(ext, 'application/octet-stream')


def extract_text_from_pdf(file_bytes):
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() for page in reader.pages[:15])


def extract_text_from_docx(file_bytes):
    doc = docx.Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def upload_to_gemini(file_bytes, mime_type, filename):
    suffix = os.path.splitext(filename)[1] or '.tmp'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    try:
        uploaded = genai.upload_file(tmp_path, mime_type=mime_type)
        return uploaded.uri
    finally:
        os.unlink(tmp_path)


def generate_audio(text):
    """Generate TTS audio from text. Returns base64 string or None."""
    try:
        tts = text_model.generate_content(
            f"Read aloud the following text naturally and clearly:\n\n{text}",
            generation_config={"response_modalities": ["AUDIO"]},
        )
        part = tts.candidates[0].content.parts[0]
        if part.inline_data:
            return base64.b64encode(part.inline_data.data).decode('utf-8')
    except Exception as e:
        logging.warning(f"TTS failed (non-critical): {e}")
    return None


@app.route('/health')
def health():
    return jsonify({"status": "ok"})


# --- MODULE 1: Content Processing ---
@app.route('/process-content', methods=['POST'])
def process_content():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    session_id = request.form.get('session_id', 'default')
    language   = request.form.get('language', 'English')
    file       = request.files['file']
    filename   = file.filename
    ext        = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

    if ext not in SUPPORTED_EXTENSIONS:
        return jsonify({"error": f"Unsupported file type '.{ext}'. Supported: PDF, DOCX, DOC, MP3, MP4, WAV, M4A."}), 400

    file_bytes = file.read()
    mime_type  = get_mime_type(filename)
    is_av      = ext in {'mp3', 'mp4', 'wav', 'm4a', 'webm'}

    try:
        if is_av:
            file_uri = upload_to_gemini(file_bytes, mime_type, filename)
            SESSION_CONTEXTS[session_id] = {
                "text": "", "file_uri": file_uri,
                "mime_type": mime_type, "type": "av"
            }
            kind = 'audio' if 'audio' in mime_type else 'video'
            prompt = (
                f"Transcribe this {kind} fully, then provide a concise professional summary "
                f"of the key topics covered. Respond entirely in {language}."
            )
            response = text_model.generate_content([
                {"file_data": {"mime_type": mime_type, "file_uri": file_uri}},
                prompt
            ])
            summary_text = response.text
            SESSION_CONTEXTS[session_id]["text"] = summary_text

        elif ext == 'pdf':
            text = extract_text_from_pdf(file_bytes)
            SESSION_CONTEXTS[session_id] = {"text": text, "file_uri": None, "type": "text"}
            response = text_model.generate_content(
                f"Summarize the following educational material concisely in one paragraph. "
                f"Respond in {language}.\n\n{text[:5000]}"
            )
            summary_text = response.text

        else:  # docx / doc
            text = extract_text_from_docx(file_bytes)
            SESSION_CONTEXTS[session_id] = {"text": text, "file_uri": None, "type": "text"}
            response = text_model.generate_content(
                f"Summarize the following educational material concisely in one paragraph. "
                f"Respond in {language}.\n\n{text[:5000]}"
            )
            summary_text = response.text

        return jsonify({
            "status": "success",
            "summary": summary_text,
            "audio_summary": generate_audio(summary_text),
            "session_id": session_id
        })

    except Exception as e:
        logging.error(f"Processing error: {e}")
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 500


# --- MODULE 2: Multilingual AI Tutor ---
@app.route('/tutor-chat', methods=['POST'])
def tutor_chat():
    data       = request.json
    user_query = data.get('query', '')
    language   = data.get('language', 'English')
    session_id = data.get('session_id', 'default')

    ctx = SESSION_CONTEXTS.get(session_id)
    if not ctx:
        return jsonify({"status": "error", "response": "Please upload a document or media file first."})

    try:
        if ctx.get("type") == "av" and ctx.get("file_uri"):
            prompt = (
                f"You are an expert AI tutor. The student has provided an audio/video lecture. "
                f"Answer the question based ONLY on that lecture. "
                f"If not covered, say so. Respond entirely in {language}.\n\n"
                f"Student question: {user_query}"
            )
            response = text_model.generate_content([
                {"file_data": {"mime_type": ctx["mime_type"], "file_uri": ctx["file_uri"]}},
                prompt
            ])
        else:
            prompt = (
                f"You are an expert AI tutor. Answer using ONLY the provided course material. "
                f"If not covered, say so. Respond entirely in {language}.\n\n"
                f"Course Material: {ctx.get('text','')[:6000]}\n\n"
                f"Student Question: {user_query}"
            )
            response = text_model.generate_content(prompt)

        answer_text = response.text
        return jsonify({
            "status": "success",
            "response": answer_text,
            "audio_response": generate_audio(answer_text)
        })

    except Exception as e:
        logging.error(f"Chat error: {e}")
        return jsonify({"status": "error", "response": f"Error: {str(e)}"}), 500


# --- MODULE 3: Adaptive Assessment ---
@app.route('/generate-assessment', methods=['POST'])
def generate_assessment():
    data       = request.json or {}
    session_id = data.get('session_id', 'default')

    ctx = SESSION_CONTEXTS.get(session_id)
    if not ctx:
        return jsonify({"error": "Please upload course material first."}), 400

    for attempt in range(3):
        try:
            if ctx.get("type") == "av" and ctx.get("file_uri"):
                contents = [
                    {"file_data": {"mime_type": ctx["mime_type"], "file_uri": ctx["file_uri"]}},
                    "Based on this audio/video lecture, generate ONE multiple-choice question. "
                ]
            else:
                contents = [
                    f"Based on the following course material, generate ONE multiple-choice question.\n\n"
                    f"Course Material: {ctx.get('text','')[:5000]}\n\n"
                ]

            contents[-1] += (
                "Return ONLY a raw valid JSON object — no markdown, no backticks.\n"
                'Format: {"topic":"...","difficulty":"...","question":"...","options":["A","B","C","D"],"answer":0}\n'
                '"answer" is the integer index (0-3) of the correct option.'
            )

            response  = text_model.generate_content(contents)
            clean     = re.sub(r'```(?:json)?\s*|\s*```', '', response.text).strip()
            quiz_data = json.loads(clean)

            return jsonify({"status": "success", "assessment": quiz_data})

        except json.JSONDecodeError as e:
            logging.warning(f"Quiz JSON parse failed (attempt {attempt+1}): {e}")
            if attempt == 2:
                return jsonify({"error": "Failed to generate quiz. Try again."}), 500
        except Exception as e:
            logging.error(f"Quiz error: {e}")
            return jsonify({"error": f"Failed to generate quiz: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(port=5001, debug=os.getenv("FLASK_ENV") == "development")