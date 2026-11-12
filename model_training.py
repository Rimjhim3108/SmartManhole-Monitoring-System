
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay
)

import matplotlib.pyplot as plt

# Load processed data
data = pd.read_csv("data/sample_training_data.csv")

# Check required columns
required_columns = ["tilt_angle", "gas_level", "duration", "event"]

if not all(col in data.columns for col in required_columns):
    raise ValueError(f"CSV must contain columns: {required_columns}")

data = data.dropna(subset=required_columns)

if len(data) < 10:
    raise ValueError(
        "Dataset bahut chhota hai. Model training se pehle "
        "zyada labelled data collect karo."
    )

X = data[["tilt_angle", "gas_level", "duration"]]
y = data["event"].astype(str)

if y.nunique() < 2:
    raise ValueError("Training ke liye kam se kam 2 event classes chahiye.")

# Split data while preserving class proportions
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.25,
    random_state=42,
    stratify=y
)

# Create model pipeline
model = Pipeline([
    ("scaler", StandardScaler()),
    ("classifier", RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        class_weight="balanced"
    ))
])

# Train
model.fit(X_train, y_train)

# Evaluate
predictions = model.predict(X_test)
# Confusion Matrix
cm = confusion_matrix(y_test, predictions, labels=model.classes_)

print("\nConfusion Matrix:")
print(cm)

# Display Confusion Matrix
disp = ConfusionMatrixDisplay(
    confusion_matrix=cm,
    display_labels=model.classes_
)

disp.plot(cmap="Blues", xticks_rotation=45)
plt.title("Smart Manhole - Confusion Matrix")
plt.tight_layout()
plt.savefig("confusion_matrix.png")
plt.show()

print("Model training complete!")
print("Test accuracy:", round(accuracy_score(y_test, predictions), 3))
print("\nClassification report:")
print(classification_report(y_test, predictions, zero_division=0))

# Save model
joblib.dump(model, "manhole_model.pkl")
print("\nModel saved as manhole_model.pkl")
