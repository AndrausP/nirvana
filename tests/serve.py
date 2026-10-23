"""Serve a directory the way raw.githubusercontent.com serves the repo.

Every file goes out as "text/plain; charset=utf-8". Python's stock http.server sends no charset
for .md files, so Windows PowerShell 5.1 decodes them as Latin-1 and the installers would write
garbled text — something that never happens against GitHub.

Usage: python tests/serve.py <port> <directory>
"""
import functools
import http.server
import sys


class RawHandler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        return "text/plain; charset=utf-8"

    def log_message(self, format, *args):
        pass


port, directory = int(sys.argv[1]), sys.argv[2]
handler = functools.partial(RawHandler, directory=directory)
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
