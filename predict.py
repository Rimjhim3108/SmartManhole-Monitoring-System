import joblib
import pandas as pd

# Load trained AI model
model = joblib.load("manhole_model.pkl")

print("\n SMART MANHOLE AI CLASSIFICATION")
print("--------------------------------")

# Test sensor readings
tilt_angle = float(input("Enter Tilt Angle: "))
gas_level = float(input("Enter Gas Level: "))
duration = float(input("Enter Duration (seconds): "))

# Prepare input
data = pd.DataFrame([{
    "tilt_angle": tilt_angle,
    "gas_level": gas_level,
    "duration": duration
}])

# Predict
prediction = model.predict(data)[0]

print("\nAI PREDICTION:", prediction.upper())