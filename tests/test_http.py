import json
import threading
import unittest
from functools import partial
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from server import Handler, ROOT


class QuietHandler(Handler):
    def log_message(self, *args):
        pass


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_ui_assets_are_served(self):
        for path in ['/', '/model.js', '/app.js', '/style.css']:
            with self.subTest(path=path), urlopen(self.url+path) as response:
                self.assertEqual(response.status, 200)
                self.assertTrue(response.read())

    def test_custom_catalog_reaches_solver_over_http(self):
        data = {'traitNames': ['Light sensitive', 'Salt tolerant', 'Cold resistant', 'Magnetic', 'Photosynthetic', 'Fragile'],
                'ranges': [['4', '6']]*3, 'desired': 'Light sensitive', 'undesired': 'Fragile',
                'microbes': [{'values': ['5']*3, 'traits': ['Light sensitive' if i < 3 else 'Fragile']} for i in range(10)]}
        request = Request(self.url+'/api/solve', json.dumps(data).encode(), {'Content-Type': 'application/json'})
        with urlopen(request) as response:
            result = json.load(response)
        self.assertEqual(result['best_score'], 100)
        self.assertEqual(result['matches'][0]['ids'], [1, 2, 3])
        self.assertEqual(result['scoring']['checks'][:3], ['attribute1', 'attribute2', 'attribute3'])
        data['traitNames'] = []
        request = Request(self.url+'/api/solve', json.dumps(data).encode(), {'Content-Type': 'application/json'})
        with self.assertRaises(HTTPError) as caught:
            urlopen(request)
        self.assertEqual(caught.exception.code, 400)
        self.assertIn('at least two', json.load(caught.exception)['error'])
