from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import io

app = Flask(__name__)

# Load your model (Update the path to your .h5 file)
MODEL = tf.keras.models.load_model('./models/crop_disease_model.h5')
CLASS_NAMES = ["Healthy", "Early Blight", "Late Blight"] # Example classes

def prepare_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes))
    img = img.resize((224, 224)) # Adjust to your model's input size
    img = np.array(img) / 255.0
    return np.expand_dims(img, axis=0)

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file'].read()
    processed_img = prepare_image(file)
    
    predictions = MODEL.predict(processed_img)
    label = CLASS_NAMES[np.argmax(predictions)]
    confidence = float(np.max(predictions))

    return jsonify({
        'label': label,
        'confidence': f"{confidence * 100:.2f}%"
    })

if __name__ == '__main__':
    app.run(port=5001)