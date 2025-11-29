# actuarial-fastapi/api/__init__.py
import os
import sys

# make imports deterministic for local dev/tests:
# ensure actuarial-fastapi and backend-django are first on sys.path
HERE = os.path.dirname(os.path.abspath(__file__))         # .../actuarial-fastapi/api
ACTUARIAL_ROOT = os.path.abspath(os.path.join(HERE, ".."))  # .../actuarial-fastapi
REPO_ROOT = os.path.abspath(os.path.join(ACTUARIAL_ROOT, ".."))  # repo root
BACKEND_DJANGO = os.path.join(REPO_ROOT, "backend-django")

# Insert at front so local packages have priority over site-packages
for p in (ACTUARIAL_ROOT, BACKEND_DJANGO, REPO_ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)
