import os, re, io, json, base64, logging, tempfile, time
from flask import Flask, request, jsonify
from flask_cors import CORS
import PyPDF2, docx
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app)

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY: raise ValueError("GEMINI_API_KEY not found in .env file")
genai.configure(api_key=API_KEY)
text_model = genai.GenerativeModel('gemini-2.5-flash')

SESSION_CONTEXTS = {}
SUPPORTED_EXTENSIONS = {'pdf','docx','doc','mp3','mp4','wav','m4a','webm'}

SUMMARY_PROMPT = """
You are an expert educational content analyser.
Analyse the provided content and respond in {language} with this structure:

## Overview
A 2-3 sentence high-level summary of what this content covers.

## Key Points
List 6-10 specific, detailed key points. Each must be a full informative sentence.

## Important Terms
List 4-6 important terms with a one-line definition each.

## What You Should Know
2-3 sentences on the main takeaways for a student.
"""

def get_mime_type(filename):
    ext = filename.rsplit('.',1)[-1].lower()
    return {'pdf':'application/pdf','docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc':'application/msword','mp3':'audio/mpeg','wav':'audio/wav',
            'm4a':'audio/mp4','webm':'video/webm','mp4':'video/mp4'}.get(ext,'application/octet-stream')

def extract_text_from_pdf(b):
    r = PyPDF2.PdfReader(io.BytesIO(b))
    return "\n".join(p.extract_text() or "" for p in r.pages[:20])

def extract_text_from_docx(b):
    d = docx.Document(io.BytesIO(b))
    return "\n".join(p.text for p in d.paragraphs if p.text.strip())

def upload_to_gemini_with_retry(file_bytes, mime_type, filename, retries=3):
    suffix = os.path.splitext(filename)[1] or '.tmp'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes); tmp_path = tmp.name
    try:
        for attempt in range(retries):
            try:
                uploaded = genai.upload_file(tmp_path, mime_type=mime_type)
                for _ in range(30):
                    info = genai.get_file(uploaded.name)
                    if info.state.name == "ACTIVE": return uploaded.uri, uploaded.name
                    if info.state.name == "FAILED": raise Exception("Gemini file processing failed")
                    time.sleep(2)
                raise Exception("File processing timed out")
            except Exception as e:
                if attempt == retries-1: raise
                time.sleep(3)
    finally:
        os.unlink(tmp_path)

def download_youtube_audio(url):
    try: import yt_dlp
    except ImportError: raise Exception("yt-dlp not installed. Run: pip install yt-dlp")
    with tempfile.TemporaryDirectory() as tmpdir:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(tmpdir, '%(title)s.%(ext)s'),
            'postprocessors': [{'key':'FFmpegExtractAudio','preferredcodec':'mp3','preferredquality':'128'}],
            'quiet': True, 'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title','video')
        for fname in os.listdir(tmpdir):
            if fname.endswith('.mp3'):
                with open(os.path.join(tmpdir, fname),'rb') as f:
                    return f.read(), fname, title
        raise Exception("Audio extraction failed")

def generate_audio(text):
    try:
        tts = text_model.generate_content(
            f"Read the following text naturally as a tutor would:\n\n{text[:3000]}",
            generation_config=genai.types.GenerationConfig(response_modalities=["AUDIO"]),
        )
        part = tts.candidates[0].content.parts[0]
        if hasattr(part,'inline_data') and part.inline_data:
            return base64.b64encode(part.inline_data.data).decode('utf-8')
    except Exception as e:
        logging.warning(f"TTS failed: {e}")
    return None

@app.route('/health')
def health(): return jsonify({"status":"ok"})

@app.route('/load-session', methods=['POST'])
def load_session():
    data = request.json or {}
    session_id = data.get('session_id','default')
    SESSION_CONTEXTS[session_id] = {
        "text":      data.get('summary',''),
        "file_uri":  data.get('file_uri'),
        "mime_type": data.get('mime_type',''),
        "type":      data.get('content_type','text'),
        "title":     data.get('title','')
    }
    return jsonify({"status":"loaded","session_id":session_id})

@app.route('/process-content', methods=['POST'])
def process_content():
    if 'file' not in request.files:
        return jsonify({"error":"No file uploaded"}), 400
    session_id = request.form.get('session_id','default')
    language   = request.form.get('language','English')
    file       = request.files['file']
    filename   = file.filename
    ext        = filename.rsplit('.',1)[-1].lower() if '.' in filename else ''
    if ext not in SUPPORTED_EXTENSIONS:
        return jsonify({"error":f"Unsupported type '.{ext}'"}), 400
    file_bytes = file.read()
    mime_type  = get_mime_type(filename)
    is_av      = ext in {'mp3','mp4','wav','m4a','webm'}
    try:
        if is_av:
            file_uri, _ = upload_to_gemini_with_retry(file_bytes, mime_type, filename)
            SESSION_CONTEXTS[session_id] = {"text":"","file_uri":file_uri,"mime_type":mime_type,"type":"av","title":filename}
            kind = 'audio' if 'audio' in mime_type else 'video'
            prompt = SUMMARY_PROMPT.format(language=language)+f"\n\nAnalyse this {kind}."
            response = text_model.generate_content([{"file_data":{"mime_type":mime_type,"file_uri":file_uri}}, prompt])
            summary_text = response.text
            SESSION_CONTEXTS[session_id]["text"] = summary_text
        elif ext == 'pdf':
            text = extract_text_from_pdf(file_bytes)
            SESSION_CONTEXTS[session_id] = {"text":text,"file_uri":None,"type":"text","title":filename}
            response = text_model.generate_content(SUMMARY_PROMPT.format(language=language)+f"\n\nContent:\n{text[:8000]}")
            summary_text = response.text
        else:
            text = extract_text_from_docx(file_bytes)
            SESSION_CONTEXTS[session_id] = {"text":text,"file_uri":None,"type":"text","title":filename}
            response = text_model.generate_content(SUMMARY_PROMPT.format(language=language)+f"\n\nContent:\n{text[:8000]}")
            summary_text = response.text
        return jsonify({"status":"success","summary":summary_text,
                        "audio_summary":generate_audio(summary_text),
                        "session_id":session_id,"title":SESSION_CONTEXTS[session_id].get("title",filename),
                        "file_uri":SESSION_CONTEXTS[session_id].get("file_uri"),
                        "mime_type":mime_type,"content_type":"av" if is_av else "text"})
    except Exception as e:
        logging.error(f"Processing error: {e}")
        return jsonify({"error":f"Failed: {str(e)}"}), 500

@app.route('/process-url', methods=['POST'])
def process_url():
    data = request.json or {}
    url = data.get('url','').strip()
    session_id = data.get('session_id','default')
    language   = data.get('language','English')
    if not url: return jsonify({"error":"No URL"}), 400
    try:
        audio_bytes, filename, title = download_youtube_audio(url)
        file_uri, _ = upload_to_gemini_with_retry(audio_bytes,'audio/mpeg',filename)
        SESSION_CONTEXTS[session_id] = {"text":"","file_uri":file_uri,"mime_type":"audio/mpeg","type":"av","title":title}
        prompt = SUMMARY_PROMPT.format(language=language)+"\n\nAnalyse this audio."
        response = text_model.generate_content([{"file_data":{"mime_type":"audio/mpeg","file_uri":file_uri}},prompt])
        summary_text = response.text
        SESSION_CONTEXTS[session_id]["text"] = summary_text
        return jsonify({"status":"success","summary":summary_text,"audio_summary":generate_audio(summary_text),
                        "session_id":session_id,"title":title,"file_uri":file_uri,
                        "mime_type":"audio/mpeg","content_type":"av"})
    except Exception as e:
        logging.error(f"URL error: {e}")
        return jsonify({"error":f"Failed: {str(e)}"}), 500

@app.route('/tutor-chat', methods=['POST'])
def tutor_chat():
    data = request.json
    user_query = data.get('query','')
    language   = data.get('language','English')
    session_id = data.get('session_id','default')
    ctx = SESSION_CONTEXTS.get(session_id)
    if not ctx: return jsonify({"status":"error","response":"Please upload a document or media file first."})
    try:
        if ctx.get("type")=="av" and ctx.get("file_uri"):
            prompt = (f"You are an expert AI tutor for '{ctx.get('title','')}'. "
                      f"Answer based ONLY on the content. Respond in {language}.\n\nQuestion: {user_query}")
            response = text_model.generate_content([{"file_data":{"mime_type":ctx["mime_type"],"file_uri":ctx["file_uri"]}},prompt])
        else:
            prompt = (f"You are an expert AI tutor. Answer using ONLY the course material. "
                      f"Respond in {language}.\n\nMaterial:\n{ctx.get('text','')[:7000]}\n\nQuestion: {user_query}")
            response = text_model.generate_content(prompt)
        answer = response.text
        return jsonify({"status":"success","response":answer,"audio_response":generate_audio(answer)})
    except Exception as e:
        logging.error(f"Chat error: {e}")
        return jsonify({"status":"error","response":str(e)}), 500

@app.route('/generate-assessment', methods=['POST'])
def generate_assessment():
    data = request.json or {}
    session_id = data.get('session_id','default')
    count      = int(data.get('count', 5))  # default 5 questions

    ctx = SESSION_CONTEXTS.get(session_id)
    if not ctx: return jsonify({"error":"Please upload course material first."}), 400

    schema = f'''Return ONLY a raw valid JSON array of exactly {count} question objects — no markdown, no backticks, no extra text.
Each object format:
{{"topic":"...","difficulty":"Beginner|Intermediate|Advanced","question":"...","options":["A","B","C","D"],"answer":0,"explanation":"why correct"}}
"answer" is the integer index (0-3) of the correct option.
Make questions varied in difficulty — mix Beginner, Intermediate and Advanced.
Each question must test a different concept from the material.'''

    for attempt in range(3):
        try:
            if ctx.get("type")=="av" and ctx.get("file_uri"):
                contents = [
                    {"file_data":{"mime_type":ctx["mime_type"],"file_uri":ctx["file_uri"]}},
                    f"Generate {count} MCQ questions from this lecture.\n{schema}"
                ]
            else:
                contents = [f"Generate {count} MCQ questions from this material.\n\n{ctx.get('text','')[:6000]}\n\n{schema}"]

            response  = text_model.generate_content(contents)
            clean     = re.sub(r'```(?:json)?\s*|\s*```','',response.text).strip()
            questions = json.loads(clean)

            # Validate it's a list with the right count
            assert isinstance(questions, list) and len(questions) >= 1
            for q in questions:
                assert all(k in q for k in ['topic','difficulty','question','options','answer'])
                assert 0 <= q['answer'] <= 3 and len(q['options']) == 4

            return jsonify({"status":"success","questions":questions})

        except (json.JSONDecodeError, AssertionError) as e:
            logging.warning(f"Quiz parse failed (attempt {attempt+1}): {e}")
            if attempt == 2:
                return jsonify({"error":"Failed to generate quiz. Try again."}), 500
        except Exception as e:
            logging.error(f"Quiz error: {e}")
            return jsonify({"error":f"Failed: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=os.getenv("FLASK_ENV")=="development")