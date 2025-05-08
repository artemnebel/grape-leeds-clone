from flask import Flask, request, send_file
from io import StringIO
import csv

app = Flask(__name__)

@app.route('/search', methods=['POST'])
def search():
    # Dummy response for now
    csv_data = StringIO()
    writer = csv.writer(csv_data)
    writer.writerow(["name", "address", "website"])
    writer.writerow(["Sample Business", "123 Main St", "N/A"])
    csv_data.seek(0)

    return send_file(
        csv_data,
        mimetype='text/csv',
        as_attachment=True,
        download_name='businesses.csv'
    )

if __name__ == '__main__':
    app.run(debug=True)