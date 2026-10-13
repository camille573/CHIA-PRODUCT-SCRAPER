"""Read-only FirstEnroll scanner. Uses the site's observed public POST search form."""
import argparse
import html
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PRODUCT = re.compile(r'<h4\b[^>]*>\s*<a\b[^>]*href=["\'][^"\']*/information/product\.cfm[^"\']*["\'][^>]*>(.*?)</a>\s*</h4>', re.I | re.S)
SELECT = re.compile(r'<select\b[^>]*name=["\']state["\'][^>]*>(.*?)</select>', re.I | re.S)
OPTION = re.compile(r'<option\b([^>]*)>(.*?)</option>', re.I | re.S)

def text(value):
    return ' '.join(html.unescape(re.sub(r'<[^>]*>', '', value)).split())

def parse(body, state=None):
    select = SELECT.search(body)
    if not select or not re.search(r'</html\s*>', body, re.I) or 'CONTACT US' not in body.upper():
        raise ValueError('Incomplete page or missing state selector/footer')
    states, selected = {}, None
    for attrs, label in OPTION.findall(select.group(1)):
        value = re.search(r'\bvalue=["\']([^"\']*)["\']', attrs, re.I)
        if value and value.group(1):
            states[value.group(1)] = text(label)
            if re.search(r'\bselected\b', attrs, re.I):
                selected = value.group(1)
    if state is not None and (state not in states or selected != state):
        raise ValueError('Server did not confirm requested state')
    return states, sorted(set(text(v) for v in PRODUCT.findall(body)))

def fetch(url, state=None):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.netloc != 'manage.firstenroll.com' or parsed.path != '/index.cfm':
        raise ValueError('Only public FirstEnroll index.cfm agent URLs are allowed')
    if not re.fullmatch(r'id=\d+', parsed.query):
        raise ValueError('Invalid agent ID query')
    data = None if state is None else urllib.parse.urlencode({'state': state}).encode()
    with urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=30) as response:
        if response.status != 200 or urllib.parse.urlparse(response.url).netloc != parsed.netloc:
            raise ValueError('Unexpected HTTP response')
        body = response.read().decode('utf-8')
    return parse(body, state)

def scan(url, states=None):
    available, _ = fetch(url)
    results = []
    for state in states or list(available):
        if state not in available:
            results.append({'state': state, 'status': 'unchecked', 'error': 'Not in dropdown'})
            continue
        try:
            _, products = fetch(url, state)
            results.append({'state': state, 'status': 'success', 'products': products})
        except Exception as error:
            results.append({'state': state, 'status': 'failed', 'error': str(error)})
        time.sleep(0.25)
    return {'url': url, 'scanned_at': datetime.now(timezone.utc).isoformat(), 'states': results}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True)
    parser.add_argument('--states', nargs='*')
    parser.add_argument('--output', default='scan-result.json')
    args = parser.parse_args()
    result = scan(args.url, args.states)
    Path(args.output).write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({'successful': sum(r['status'] == 'success' for r in result['states']), 'failed': sum(r['status'] == 'failed' for r in result['states']), 'output': args.output}))
