"""Starts AFTERHOURS at http://127.0.0.1:8888/ and opens your browser."""
import http.server, socketserver, webbrowser, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = 8888
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), H) as s:
    print(f"AFTERHOURS running at http://127.0.0.1:{PORT}/  (Ctrl+C to stop)")
    webbrowser.open(f"http://127.0.0.1:{PORT}/")
    try: s.serve_forever()
    except KeyboardInterrupt: pass
