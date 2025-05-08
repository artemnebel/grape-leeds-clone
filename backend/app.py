from flask import Flask, request, send_file
import requests, csv, os
from io import StringIO
from dotenv import load_dotenv

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

app = Flask(__name__)

@app.route('/search', methods=['POST'])
def search():
    data = request.json
    bounds = data['bounds']
    business_type = data['business_type']

    # Construct Google Places API call
    places_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    location = f"{(bounds['north'] + bounds['south'])/2},{(bounds['east'] + bounds['west'])/2}"
    radius = 10000  # meters (Google requires radius, not bounding box)

    params = {
        "query": business_type,
        "location": location,
        "radius": radius,
        "key": GOOGLE_API_KEY
    }

    results = []
    while True:
        response = requests.get(places_url, params=params).json()
        for place in response.get("results", []):
            results.append({
                "name": place.get("name"),
                "address": place.get("formatted_address"),
                "website": place.get("website", "N/A")
            })

        if "next_page_token" in response:
            params["pagetoken"] = response["next_page_token"]
        else:
            break

    # Filter out businesses with websites
    filtered = [r for r in results if r['website'] == "N/A"]

    # Create CSV
    csv_file = StringIO()
    writer = csv.DictWriter(csv_file, fieldnames=["name", "address", "website"])
    writer.writeheader()
    writer.writerows(filtered)
    csv_file.seek(0)

    return send_file(
        csv_file,
        mimetype='text/csv',
        as_attachment=True,
        download_name='businesses.csv'
    )