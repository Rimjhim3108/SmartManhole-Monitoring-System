import requests

url = "http://127.0.0.1:5000/predict"

tests = [
    {"tilt_angle": 2, "gas_level": 300, "duration": 1},
    {"tilt_angle": 20, "gas_level": 320, "duration": 3},
    {"tilt_angle": 40, "gas_level": 550, "duration": 8},
    {"tilt_angle": 15, "gas_level": 350, "duration": 13}
]

for data in tests:
    response = requests.post(url, json=data)
    print(data, "=>", response.json())