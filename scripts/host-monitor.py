#!/usr/bin/env python3
"""
Host Monitoring API
Запускается на хост-системе, предоставляет безопасный API для мониторинга
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import subprocess
import os
from urllib.parse import urlparse, parse_qs

# Только пользователи из этой группы могут обращаться
ALLOWED_USERS = {"takeshi"}

class MonitoringAPI(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Не логировать каждый запрос
        pass

    def do_GET(self):
        # Проверка авторизации
        if not self.check_auth():
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'{"error": "Unauthorized"}')
            return

        path = urlparse(self.path).path
        query = parse_qs(urlparse(self.path).query)

        try:
            if path == "/health":
                self.send_json({"status": "ok", "service": "host-monitoring"})

            elif path == "/uptime":
                result = subprocess.run(['uptime'], capture_output=True, text=True)
                self.send_json({"stdout": result.stdout.strip()})

            elif path == "/memory":
                result = subprocess.run(['free', '-h'], capture_output=True, text=True)
                self.send_json({"stdout": result.stdout.strip()})

            elif path == "/disk":
                result = subprocess.run(['df', '-h'], capture_output=True, text=True)
                self.send_json({"stdout": result.stdout.strip()})

            elif path == "/docker-ps":
                result = subprocess.run(['docker', 'ps', '-a'], capture_output=True, text=True)
                self.send_json({"stdout": result.stdout.strip()})

            elif path == "/docker-stats":
                result = subprocess.run(['docker', 'stats', '--no-stream'], capture_output=True, text=True)
                self.send_json({"stdout": result.stdout.strip()})

            elif path == "/logs":
                lines = query.get('lines', ['50'])[0]
                result = subprocess.run(['journalctl', '-n', lines, '--no-pager'],
                                      capture_output=True, text=True)
                self.send_json({"stdout": result.stdout.strip()})

            elif path == "/auth-log":
                lines = query.get('lines', ['50'])[0]
                result = subprocess.run(['tail', '-n', lines, '/var/log/auth.log'],
                                      capture_output=True, text=True)
                self.send_json({"stdout": result.stdout.strip()})

            elif path == "/who":
                result = subprocess.run(['who'], capture_output=True, text=True)
                self.send_json({"stdout": result.stdout.strip()})

            elif path == "/ss-ports":
                result = subprocess.run(['ss', '-tuln'], capture_output=True, text=True)
                self.send_json({"stdout": result.stdout.strip()})

            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'{"error": "Not found"}')

        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

    def check_auth(self):
        # Простая проверка - только localhost
        return self.client_address[0] in ['127.0.0.1', '::1']

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

def run_server(port=9999):
    server = HTTPServer(('127.0.0.1', port), MonitoringAPI)
    print(f"Host Monitoring API running on http://127.0.0.1:{port}")
    server.serve_forever()

if __name__ == "__main__":
    run_server()
