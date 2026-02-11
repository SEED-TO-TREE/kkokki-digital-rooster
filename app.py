from flask import Flask, render_template, request, jsonify
from engine import KkokkiEngine
import os

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
    transport_mode = data.get('transport', 'car')  # car, transit, bike
    
    if not all([start_loc, end_loc, arrival_time]):
        return jsonify({"error": "모든 필드를 입력해주세요."}), 400
        
    engine.start_monitoring(start_loc, end_loc, arrival_time, transport_mode)
    return jsonify({"message": "모니터링을 시작합니다."})

@app.route('/api/route', methods=['POST'])
def get_route():
    """Get route information for given start/end and transport mode"""
    data = request.json
    start_loc = data.get('start')
    end_loc = data.get('end')
    transport_mode = data.get('transport', 'car')
    
    if not all([start_loc, end_loc]):
        return jsonify({"error": "출발지와 도착지를 입력해주세요."}), 400
    
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
    return jsonify({"message": "모니터링을 중지합니다."})

@app.route('/api/reverse-geocode', methods=['GET'])
def reverse_geocode():
    """Convert coordinates to address"""
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    
    if not lat or not lon:
        return jsonify({"success": False, "error": "좌표가 필요합니다."})
    
    try:
        result = engine.reverse_geocode(float(lat), float(lon))
        return jsonify({"success": True, **result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify(engine.get_status())

if __name__ == '__main__':
    # Host 0.0.0.0 allows access from other devices (iPhone) on the network
    app.run(host='0.0.0.0', port=5050, debug=True)
