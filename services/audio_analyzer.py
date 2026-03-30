import os
import sqlite3
import librosa
import numpy as np
import threading

# Global state to track analysis progress
ANALYSIS_STATUS = {
    'active': False,
    'total': 0,
    'current': 0,
    'percent': 0,
    'current_file': ''
}

def analyze_track(file_path):
    """
    Analyzes a track using librosa, extracting BPM and Energy.
    Returns (bpm, energy) or (0.0, 0.0) on failure.
    """
    try:
        # Load audio (mono, 22050 Hz by default for speed)
        # We load only the first 60 seconds to save CPU, as energy/bpm usually stabilize
        y, sr = librosa.load(file_path, duration=60, sr=22050)
        
        # Calculate BPM
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo[0]) if isinstance(tempo, np.ndarray) else float(tempo)
        
        # Calculate Energy (RMS)
        rms = librosa.feature.rms(y=y)
        energy = float(np.mean(rms))
        
        # Normalize energy to a 0-1 or 0-100 scale if desired. 
        # Typically RMS is between 0 and 1, we multiply by 100 for better readability
        energy_score = min(energy * 1000, 100.0) # Heuristic multiplier
        
        return round(bpm, 2), round(energy_score, 2)
    except Exception as e:
        print(f"Error analizando audio {file_path}: {e}")
        return 0.0, 0.0

def start_library_analysis():
    """
    Starts a background thread to analyze the entire library.
    """
    if ANALYSIS_STATUS['active']:
        return False
        
    thread = threading.Thread(target=_process_library_background)
    thread.daemon = True
    thread.start()
    return True

def _process_library_background():
    global ANALYSIS_STATUS
    
    ANALYSIS_STATUS['active'] = True
    ANALYSIS_STATUS['percent'] = 0
    ANALYSIS_STATUS['current'] = 0
    
    try:
        import config
        # Resolve DB_PATH properly inside thread to catch config overrides
        DB_PATH = os.path.join(config.DOWNLOAD_FOLDER, 'kraken.db')
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Fetch all audio tracks that haven't been analyzed yet (bpm = 0 or null)
        c.execute("SELECT id, rel_path FROM media WHERE media_type = 'audio' AND (bpm IS NULL OR bpm = 0.0)")
        tracks = c.fetchall()
        
        ANALYSIS_STATUS['total'] = len(tracks)
        
        if len(tracks) == 0:
            ANALYSIS_STATUS['active'] = False
            return
            
        for i, track in enumerate(tracks):
            track_id = track['id']
            rel_path = track['rel_path']
            full_path = os.path.join(config.DOWNLOAD_FOLDER, rel_path)
            
            ANALYSIS_STATUS['current'] = i + 1
            ANALYSIS_STATUS['current_file'] = os.path.basename(rel_path)
            ANALYSIS_STATUS['percent'] = int((i / len(tracks)) * 100)
            
            if os.path.exists(full_path):
                bpm, energy = analyze_track(full_path)
                
                if bpm > 0:
                    c.execute("UPDATE media SET bpm = ?, energy = ? WHERE id = ?", (bpm, energy, track_id))
                    conn.commit()
            
    except Exception as e:
        print(f"Error procesando libreria con Librosa: {e}")
    finally:
        ANALYSIS_STATUS['active'] = False
        if 'conn' in locals():
            conn.close()

def get_analysis_status():
    return ANALYSIS_STATUS
