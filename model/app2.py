from flask import Flask, request, jsonify
from flask_cors import CORS
import os

# Gemini
import google.generativeai as genai

# NLP / LangChain
from langchain.text_splitter import CharacterTextSplitter
from langchain.vectorstores import FAISS
from langchain.embeddings import HuggingFaceEmbeddings

# Translation
from googletrans import Translator

app = Flask(__name__)
CORS(app)

# ---------------- GEMINI CONFIG ----------------
genai.configure(api_key=os.getenv("AIzaSyDnNkO_QIX-2hLz6SWC5-RccahULJ4IkL8"))
gemini_model = genai.GenerativeModel("gemini-1.5-flash")

# ---------------- LOAD TRANSCRIPT ----------------
video_path = '/KfnhNlD8WZI.mp4'
video_name = os.path.splitext(os.path.basename(video_path))[0]

with open(f'D:/yantra/transcript/{video_name}.txt', 'r', encoding='utf-8') as file:
    file_content = file.read()

# ---------------- VECTOR STORE ----------------
text_splitter = CharacterTextSplitter(
    separator="\n",
    chunk_size=100,
    chunk_overlap=20,
)

texts = text_splitter.split_text(file_content)
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vector_store = FAISS.from_texts(texts, embeddings)

# ---------------- HELPERS ----------------
def gemini_generate(prompt: str) -> str:
    response = gemini_model.generate_content(prompt)
    return response.text.strip()

def worthness(user_query):
    docs = vector_store.similarity_search(user_query)
    context = "\n".join([doc.page_content for doc in docs])
    prompt = f"""
Use the following context to answer the question.

Context:
{context}

Question:
{user_query}
"""
    return gemini_generate(prompt)

def process_doubt(user_doubt):
    return worthness(user_doubt)

def translateintoeng(text, source_lang):
    translator = Translator()
    return translator.translate(text, src=source_lang, dest='en').text

def translateintolang(text, target_lang):
    translator = Translator()
    return translator.translate(text, src='en', dest=target_lang).text

def reviews(review_text):
    prompt = f"""
Provide a short summary (max 30 words) of the following course review.
Mention both positives and negatives.

Review:
{review_text}
"""
    return gemini_generate(prompt)

# ---------------- ROUTES ----------------
@app.route('/discription', methods=['POST'])
def discription():
    target_lang = request.json.get('target')

    response1 = translateintolang(worthness("provide tech stack discussed"), target_lang)
    response2 = translateintolang(worthness("what are the topic covered"), target_lang)
    response3 = translateintolang(worthness("is project discussed yes or no"), target_lang)

    with open(f"D:/yantra/transcript/{video_name}reviews.txt", 'r', encoding='utf-8') as file:
        review_text = file.read()

    review_summary = translateintolang(reviews(review_text), target_lang)

    return jsonify({
        "response1": response1,
        "response2": response2,
        "response3": response3,
        "review": review_summary
    })

@app.route('/worth', methods=['POST'])
def worth():
    target_lang = request.json.get('target')
    user_query = request.json.get('query')

    user_query = translateintoeng(user_query, target_lang)

    response = worthness(
        f"Only give an overview of the course (tech stack or topics). Question: {user_query}"
    )

    return jsonify({
        "answer": translateintolang(response, target_lang)
    })

@app.route('/answer_doubt', methods=['POST'])
def answer_doubt():
    target_lang = request.json.get('target')
    user_doubt = request.json.get('doubt')

    user_doubt = translateintoeng(user_doubt, target_lang)
    response = process_doubt(user_doubt)

    return jsonify({
        "answer": translateintolang(response, target_lang)
    })

# ---------------- TEST / QUIZ ----------------
def generate_question(text):
    prompt = f"""
Generate 4 multiple-choice technical questions based ONLY on the following course content.

{text}
"""
    return gemini_generate(prompt)

def check_answer(question, answer, text):
    prompt = f"""
Question: {question}
Student Answer: {answer}

Reference Content:
{text}

Is the answer correct? If not, give the correct answer.
"""
    return gemini_generate(prompt)

@app.route('/test', methods=['GET'])
def test():
    with open('D:/yantra/transcript/ok2s1vV9XW0.txt', 'r', encoding='utf-8') as file:
        text_reference = file.read()
    return generate_question(text_reference)

@app.route('/testans', methods=['POST'])
def checker():
    with open('D:/yantra/transcript/ok2s1vV9XW0.txt', 'r', encoding='utf-8') as file:
        text_reference = file.read()

    student_answer = request.json.get('student_answer')
    question = request.json.get('student_question')

    return check_answer(question, student_answer, text_reference)

if __name__ == '__main__':
    app.run(debug=True)
