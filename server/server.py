# Standard library imports
import os
import logging
import configparser
from typing import List, Tuple, Union

# Third-party imports
from PIL import Image
import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify
import cv2
import pytesseract

# Configure basic logging
logging.basicConfig(level=logging.INFO)

# Function to perform OCR on MVP screen
def ocr(image, config):
    name_mapping = {
        "valtan": "Resurrected",
        "vykas": "Garden of",
        "cali": "Calili",
        "kakul": "Midnight C",
    }

    # Convert PIL Image to numpy array
    image_np = np.array(image)

    # Convert RGB to BGR for OpenCV
    image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

    h, w, _ = image_np.shape
    if w < 1500:
        image_np = cv2.resize(image_np, (round(w * 1.5), round(h * 1.5)), interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
    gray = 255 - gray

    # Use Tesseract to do OCR on the processed image
    text = pytesseract.image_to_string(gray, config=config)

    # Check against the name mapping and return the correct raid name if found
    for correct_name, detected_name in name_mapping.items():
        if detected_name in text:
            return correct_name
    return False

# Function to load configuration settings
def load_config() -> configparser.ConfigParser:
    """
    Load and return the configuration settings.
    
    Raises:
        FileNotFoundError: If the configuration file does not exist.
        KeyError: If required keys are missing.
    """
    config = configparser.ConfigParser()
    # Read the configuration file
    if not config.read('config.ini'):
        logging.error('Configuration file not found.')
        raise FileNotFoundError('Configuration file not found.')
    
    return config

# Attempt to load configuration settings
try:
    config = load_config()
except Exception as e:
    logging.error(f"Failed to load configuration: {e}")
    exit(1)

# Load model and settings from configuration
MODEL_PATH = config.get('settings', 'MODEL_PATH')
CLASS_NAMES = [name.strip() for name in config.get('settings', 'CLASS_NAMES').split(',')]
TARGET_IMAGE_SIZE = tuple(map(int, config.get('settings', 'TARGET_IMAGE_SIZE').split(',')))

# Attempt to load the trained model
try:
    model = tf.keras.models.load_model(MODEL_PATH)
except Exception as e:
    logging.error(f"Failed to load the model: {e}")
    exit(1)

# Function to preprocess images for prediction
def preprocess_image(image: Image.Image) -> np.ndarray:
    """
    Preprocess an image for prediction.
    
    Args:
        image (Image.Image): PIL Image object.
    
    Returns:
        np.ndarray: Preprocessed image as a NumPy array.
    """
    # Convert the image to RGB if it's not already in that mode
    if image.mode != 'RGB':
        image = image.convert('RGB')
    # Convert the image to an array
    img_array = tf.keras.preprocessing.image.img_to_array(image)
    # Rescale
    img_array = img_array / 255.0
    # Expand the dimensions of the image for prediction
    return np.expand_dims(img_array, axis=0)

# Function to predict image class
def predict_image_class(model: tf.keras.Model, preprocessed_image: np.ndarray, class_names: List[str]) -> str:
    """
    Predict the class of an image.
    
    Args:
        model (tf.keras.Model): Trained TensorFlow model.
        preprocessed_image (np.ndarray): Preprocessed image.
        class_names (List[str]): List of class names.
    
    Returns:
        str: Predicted class name.
    """
    # Perform the prediction
    predictions = model.predict(preprocessed_image)
    # Get the index of the highest probability class
    predicted_class_index = np.argmax(predictions, axis=1)
    # Get the probability
    probability = predictions[0][predicted_class_index.item()]
    # Return the name of the predicted class
    return class_names[predicted_class_index[0]], probability

# Initialize Flask app
app = Flask(__name__)

# Define prediction route
@app.route('/predict', methods=['POST'])
def predict() -> Tuple[Union[None, str], int]:
    try:
        # Retrieve the image file from the request
        image_file = request.files.get('image')
        if image_file:
            # Validate the image file type
            if not image_file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                logging.warning("Invalid file type.")
                return jsonify({"error": "Invalid file type"}), 400
            logging.info("Received an image file for prediction.")

            # Convert the Image file to a PIL Image
            image = Image.open(image_file.stream)

            # Preprocess the image
            resized = image.resize(TARGET_IMAGE_SIZE, Image.NEAREST)
            preprocessed_image = preprocess_image(resized)
            
            # Predict the image class
            [predicted_class, probability] = predict_image_class(model, preprocessed_image, CLASS_NAMES)
            
            # If the class is 'mvp', process the image with OCR
            if predicted_class == "mvp":
                raid_name_psm6 = ocr(image, '--psm 6')
                raid_name_psm11 = ocr(image, '--psm 11')

                # Determine the raid name, preferring psm 6 over psm 11 if both are found
                raid_name = raid_name_psm6 or raid_name_psm11

                if raid_name:
                    logging.info("OCR Text extraction successful.")
                else:
                    logging.info("OCR Text extraction failed.")
                return jsonify({"class": raid_name, "confidence": 100 }), 200
            else:
                logging.info(f"Prediction successful. Class: {predicted_class} {probability}")
                return jsonify({"class": predicted_class, "confidence": probability*100 }), 200
        else:
            logging.warning("No image file received.")
            return jsonify({"error": "No image provided"}), 400
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

# Define health check route
@app.route('/health', methods=['GET'])
def health_check() -> Tuple[str, int]:
    # Simple health check; returns OK and HTTP status 200
    return "OK", 200

# Main entry point
if __name__ == '__main__':
    # Use environment variables to get host and port
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    # Start the Flask app
    app.run(host=host, port=port)
