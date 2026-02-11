from flask import Flask, render_template, request, jsonify
from engine import KkokkiEngine

app = Flask(__name__)
engine = KkokkiEngine()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/start', methods=['POST'])
def start_monitoring():
    data = request.json
    start_loc = data.get('start')
    end_loc = data.get('end')
    arrival_time = data.get('time')
    transport_mode = data.get('transport', 'car')

    if not all([start_loc, end_loc, arrival_time]):
        return jsonify({"error": "Missing required fields."}), 400

    # Apply settings from frontend
    engine.prep_time = data.get('prep_time', 30)
    engine.buffer_time = data.get('buffer_time', 10)
    engine.early_warning_enabled = data.get('early_warning', False)
    engine.urgent_alert_enabled = data.get('urgent_alert', True)

    engine.start_monitoring(start_loc, end_loc, arrival_time, transport_mode)
    return jsonify({"message": "Monitoring started."})


@app.route('/api/route', methods=['POST'])
def get_route():
    data = request.json
    start_loc = data.get('start')
    end_loc = data.get('end')
    transport_mode = data.get('transport', 'car')

    if not all([start_loc, end_loc]):
        return jsonify({"error": "Start and end required."}), 400

    try:
        route = engine.calculate_route(start_loc, end_loc, transport_mode)
        return jsonify({"success": True, "route": route})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/search', methods=['GET'])
def search_locations():
    keyword = request.args.get('keyword')
    if not keyword:
        return jsonify({"results": []})
    results = engine.search_locations(keyword)
    return jsonify({"results": results})


@app.route('/api/stop', methods=['POST'])
def stop_monitoring():
    engine.stop_monitoring()
    return jsonify({"message": "Monitoring stopped."})


@app.route('/api/reverse-geocode', methods=['GET'])
def reverse_geocode():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    if not lat or not lon:
        return jsonify({"success": False, "error": "Coordinates required."})
    try:
        result = engine.reverse_geocode(float(lat), float(lon))
        return jsonify({"success": True, **result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify(engine.get_status())


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)
