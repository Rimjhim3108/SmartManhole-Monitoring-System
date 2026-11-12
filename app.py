from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Load trained ML model
MODEL_PATH = Path(__file__).parent / "manhole_model.pkl"
model = joblib.load(MODEL_PATH)


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Smart Manhole ML API is running!"})


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        input_data = pd.DataFrame([{
            "tilt_angle": float(data["tilt_angle"]),
            "gas_level": float(data["gas_level"]),
            "duration": float(data["duration"])
        }])

        prediction = model.predict(input_data)[0]

        return jsonify({
            "prediction": str(prediction),
            "success": True
        })

    except Exception as e:
        return jsonify({
            "error": str(e),
            "success": False
        }), 400


if __name__ == "__main__":
    app.run(debug=True, port=5000)