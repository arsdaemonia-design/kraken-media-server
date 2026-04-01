import threading
import time as time_module
import shutil
import os

progress_status = { "percent": "0%", "filename": "", "details": "Esperando...", "active": False, "current_index": -1, "completed_indices": [] }
stop_download = False
LAST_ALEXA_COMMAND = {"action": None, "time": 0}
BIB_CACHE = None
BIB_CACHE_TIME = 0
MIXES_CACHE = []
RESCAN_IN_PROGRESS = False
ACTIVE_USERS = {} 
PENDING_COMMANDS = {}
HLS_SESSIONS = {}
STREAM_TOKENS = {}
USERS_LOCK = threading.Lock()

def cleanup_inactive_users():
    while True:
        try:
            with USERS_LOCK:
                now = time_module.time()
                to_remove = [sid for sid, data in ACTIVE_USERS.items() if now - data.get('last_ping', 0) > 15]
                for sid in to_remove:
                    del ACTIVE_USERS[sid]
        except Exception as e:
            print("Error cleaning up users:", e)
        time_module.sleep(10)

def cleanup_old_hls_sessions(max_inactive_seconds=600):
    while True:
        try:
            now = time_module.time()
            to_remove = []
            
            for sid, data in list(HLS_SESSIONS.items()):
                if now - data.get('last_activity', 0) > max_inactive_seconds:
                    to_remove.append(sid)
            
            for sid in to_remove:
                print(f"Limpiando sesión HLS inactiva: {sid}")
                session_data = HLS_SESSIONS.get(sid)
                if session_data:
                    if session_data.get('process'):
                        try:
                            session_data['process'].terminate()
                            session_data['process'].wait(timeout=5)
                        except Exception as e:
                            print(f"Error terminating FFmpeg: {e}")
                    if session_data.get('path') and os.path.exists(session_data['path']):
                        try:
                            shutil.rmtree(session_data['path'])
                        except Exception as e:
                            print(f"Error deleting HLS temp folder: {e}")
                    del HLS_SESSIONS[sid]
        except Exception as e:
            print(f"Error en cleanup de HLS: {e}")
        time_module.sleep(60)
