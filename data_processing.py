import pandas as pd
import numpy as np

data = pd.read_csv("data/sensor_data.csv")

print(data.head())
print(data.info())
print(data.isnull().sum())

# Check duplicate rows
print("Duplicate rows:", data.duplicated().sum())

# Remove duplicate rows
data = data.drop_duplicates()

# Check data again
print("\nCleaned Data:")
print(data)

# Separate features and label

X = data[["tilt_angle", "gas_level", "duration"]]
y = data["event"]

print("\nFeatures:")
print(X)

print("\nLabels:")
print(y)

from sklearn.preprocessing import LabelEncoder

encoder = LabelEncoder()

y_encoded = encoder.fit_transform(y)

print("\nEncoded Labels:")
print(y_encoded)

print("\nLabel Mapping:")
for label, number in zip(encoder.classes_, range(len(encoder.classes_))):
    print(label, "=", number)



# Add encoded labels to data
data["label"] = y_encoded

# Save processed data
data.to_csv("data/processed_data.csv", index=False)

print("\nProcessed data saved successfully!")

# Add encoded labels
data["label"] = y_encoded

# Save processed dataset
data.to_csv("data/processed_data.csv", index=False)

print("\nProcessed data saved successfully!")

print("\nFinal Data:")
print(data)

print("\nMissing Values:")
print(data.isnull().sum())

print("\nEvent Count:")
print(data["event"].value_counts())

print("\nLabel Count:")
print(data["label"].value_counts())
print("Total rows:", len(data))
print("Event counts:")
print(data["event"].value_counts())
print("Columns:", data.columns.tolist())

