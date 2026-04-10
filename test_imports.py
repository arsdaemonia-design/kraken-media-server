import sys
import os

# Add the project directory to path
sys.path.insert(0, r'E:\Kraken Media Server')

# Test imports
try:
    from services.database import get_db
    print("OK database imported")
except Exception as e:
    print(f"ERROR database: {e}")

try:
    from services.video_tagger import get_movie_details, get_tv_details
    print("OK video_tagger imported")
except Exception as e:
    print(f"ERROR video_tagger: {e}")

try:
    from routes.api import api_bp
    print("OK api routes imported")
except Exception as e:
    print(f"ERROR api routes: {e}")
    import traceback
    traceback.print_exc()

print("\nAll imports tested!")
