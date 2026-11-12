
import pandas as pd
import numpy as np

np.random.seed(42)

rows = []

events = {
    "normal": 100,
    "accidental": 100,
    "suspicious": 100,
    "maintenance": 100
}

for event, count in events.items():
    for _ in range(count):
        if event == "normal":
            tilt = np.random.normal(2, 1)
            gas = np.random.normal(300, 30)
            duration = np.random.normal(1, 0.3)

        elif event == "accidental":
            tilt = np.random.normal(20, 5)
            gas = np.random.normal(320, 40)
            duration = np.random.normal(3, 1)

        elif event == "suspicious":
            tilt = np.random.normal(35, 8)
            gas = np.random.normal(500, 70)
            duration = np.random.normal(8, 2)

        else:  # maintenance
            tilt = np.random.normal(15, 4)
            gas = np.random.normal(350, 40)
            duration = np.random.normal(12, 3)

        rows.append({
            "tilt_angle": max(0, tilt),
            "gas_level": max(0, gas),
            "duration": max(0.1, duration),
            "event": event
        })

df = pd.DataFrame(rows)

df.to_csv("data/sample_training_data.csv", index=False)

print("Sample dataset created!")
print("Total rows:", len(df))
print(df["event"].value_counts())
print("Saved to data/sample_training_data.csv")