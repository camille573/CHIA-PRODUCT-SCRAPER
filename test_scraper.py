import unittest
from scraper import parse

def page(state='FL', products=''):
    return f'<select name="state"><option value="FL" selected>{state}</option></select>{products}<footer>CONTACT US</footer></html>'

class SafetyTests(unittest.TestCase):
    def test_empty_complete_state_is_valid(self):
        self.assertEqual(parse(page(), 'FL')[1], [])
    def test_incomplete_and_wrong_state_rejected(self):
        with self.assertRaises(ValueError): parse(page()[:-7], 'FL')
        with self.assertRaises(ValueError): parse(page(), 'NY')
    def test_only_product_links_count(self):
        body = page(products='<h4><a href="/information/product.cfm?page=1&amp;id=2"><strong>Summit Plan 200+</strong></a></h4><h4><a href="mailto:a">Contact</a></h4>')
        self.assertEqual(parse(body, 'FL')[1], ['Summit Plan 200+'])

if __name__ == '__main__': unittest.main()
