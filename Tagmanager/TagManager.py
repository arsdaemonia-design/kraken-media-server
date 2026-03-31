import tkinter as tk
from tkinter import ttk
import json, threading, time
from mutagen.mp3 import MP3
from mutagen.easyid3 import EasyID3
from pathlib import Path
import requests

BASE = Path(__file__).resolve().parent.parent
CACHE = BASE / "descargas" / "cache_files.json"

class MetaApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Vortex Tagger")
        self.geometry("1100x520")

        cols = (
            "file",
            "cur_artist","cur_title","cur_album","cur_genre",
            "new_artist","new_title","new_album","new_genre"
        )

        self.tree = ttk.Treeview(self, columns=cols, show="headings")
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=120, anchor="w")

        self.tree.pack(fill="both", expand=True)
        self.tree.bind("<Double-1>", self._edit_cell)

        btns = tk.Frame(self)
        btns.pack(fill="x")

        tk.Button(btns, text="Buscar en Deezer", command=self.buscar).pack(side="left", padx=5)
        tk.Button(btns, text="Aplicar Tags", command=self.aplicar).pack(side="right", padx=5)

        self._edit = None

    def _edit_cell(self, event):
        region = self.tree.identify("region", event.x, event.y)
        if region != "cell":
            return

        row = self.tree.identify_row(event.y)
        col = self.tree.identify_column(event.x)

        x, y, w, h = self.tree.bbox(row, col)
        value = self.tree.set(row, col)

        self._edit = tk.Entry(self.tree)
        self._edit.place(x=x, y=y, width=w, height=h)
        self._edit.insert(0, value)
        self._edit.focus()

        def save_edit(e=None):
            self.tree.set(row, col, self._edit.get())
            self._edit.destroy()

        self._edit.bind("<Return>", save_edit)
        self._edit.bind("<FocusOut>", save_edit)

    def buscar(self):
        def job():
            db_path = BASE / "descargas" / "kraken.db"
            import sqlite3
            if not db_path.exists():
                print("Lanza Kraken V3 primero para generar la base de datos.")
                return

            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            
            # Buscamos todos los archivos de audio
            c.execute("SELECT rel_path, artist, title, album, genre FROM media WHERE media_type = 'audio'")
            rows = c.fetchall()

            for row in rows:
                query = f"{row['artist']} {row['title']}"
                new = ["","","",""]

                try:
                    r = requests.get(
                        "https://api.deezer.com/search",
                        params={"q": query, "limit": 1},
                        timeout=6
                    )
                    j = r.json()
                    if j.get("data"):
                        d = j["data"][0]
                        new = [
                            d["artist"]["name"],
                            d["title"],
                            d["album"]["title"],
                            ""
                        ]
                except Exception as e:
                    print("Deezer error:", e)

                self.tree.insert("", "end", values=(
                    row['rel_path'],
                    row['artist'], row['title'], row['album'], row['genre'],
                    new[0], new[1], new[2], new[3]
                ))

                time.sleep(0.25)
                
            conn.close()

        threading.Thread(target=job, daemon=True).start()

    def aplicar(self):
        for row in self.tree.get_children():
            (
                path,
                ca, ct, cal, cg,
                na, nt, nal, ng
            ) = self.tree.item(row)["values"]

            full = BASE / "descargas" / path

            try:
                audio = MP3(full, ID3=EasyID3)
                if na: audio["artist"] = na
                if nt: audio["title"] = nt
                if nal: audio["album"] = nal
                if ng: audio["genre"] = ng
                audio.save()
            except Exception as e:
                print("Error:", full, e)

MetaApp().mainloop()