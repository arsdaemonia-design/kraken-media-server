import sqlite3
import json
import os
import config

def export_db_to_json():
    db_path = os.path.join(config.DOWNLOAD_FOLDER, 'kraken.db')
    if not os.path.exists(db_path):
        print(f"? No se encontro la base de datos en {db_path}")
        return

    print(f"?? Exportando datos desde {db_path} a archivos JSON...")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # 1. Exportar media
    c.execute("SELECT * FROM media")
    media = [dict(row) for row in c.fetchall()]
    with open('export_media.json', 'w', encoding='utf-8') as f:
        json.dump(media, f, indent=4, ensure_ascii=False)
    print(f"? export_media.json escrito ({len(media)} registros)")

    # 2. Exportar historial
    c.execute("SELECT * FROM downloads_history")
    history = [dict(row) for row in c.fetchall()]
    with open('export_historial.json', 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=4, ensure_ascii=False)
    print(f"? export_historial.json escrito ({len(history)} registros)")

    # 3. Exportar playlists
    c.execute("SELECT * FROM playlists")
    playlists_rows = c.fetchall()
    
    playlists_dict = {}
    for pr in playlists_rows:
        pid = pr['id']
        pname = pr['name']
        c.execute("SELECT rel_path FROM playlist_items WHERE playlist_id = ? ORDER BY position ASC", (pid,))
        tracks = [r['rel_path'] for r in c.fetchall()]
        playlists_dict[pname] = tracks

    with open('export_playlists.json', 'w', encoding='utf-8') as f:
        json.dump(playlists_dict, f, indent=4, ensure_ascii=False)
    print(f"? export_playlists.json escrito ({len(playlists_dict)} playlists)")

    conn.close()
    print("?? Exportacion completada! Ya puedes leer los JSON.")

if __name__ == '__main__':
    export_db_to_json()
