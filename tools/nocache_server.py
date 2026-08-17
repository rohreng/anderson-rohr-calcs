"""Static file server with caching disabled — for live diagram iteration.

Python's http.server sends Last-Modified and the browser happily caches
are-draw.js, so edits don't show up on reload. This serves the given directory
with `Cache-Control: no-store` so every reload re-fetches the library.

Usage: python nocache_server.py [port] [directory]
"""
import sys
import http.server
import socketserver

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8799
DIRECTORY = sys.argv[2] if len(sys.argv) > 2 else "."


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


with ThreadingHTTPServer(("", PORT), NoCacheHandler) as httpd:
    print("nocache server (threaded) on %d serving %s" % (PORT, DIRECTORY), flush=True)
    httpd.serve_forever()
