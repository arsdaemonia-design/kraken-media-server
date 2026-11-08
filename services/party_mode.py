import time
import secrets
import threading
from typing import Dict, List, Optional

class PartyModeManager:
    def __init__(self):
        self._lock = threading.RLock()
        self.active: bool = False
        self.code: str = ""
        self.created_at: float = 0.0
        self.queue: List[dict] = []
        self.history: List[dict] = []
        self.guests: Dict[str, dict] = {}  # ip/id -> { name, last_seen, count }
        self.sync_cursor: int = 0
        self.limit_per_guest: int = 10

    def toggle(self, enable: Optional[bool] = None, limit_per_guest: int = 10) -> dict:
        with self._lock:
            if enable is None:
                self.active = not self.active
            else:
                self.active = bool(enable)

            if self.active:
                if not self.code:
                    self.code = secrets.token_hex(3).upper()  # 6-char hex like 4A9B2C
                self.created_at = time.time()
                self.limit_per_guest = max(1, min(50, int(limit_per_guest)))
            else:
                # Keep code and queue in case they re-enable, but flag is inactive
                pass

            return self.get_status()

    def get_status(self) -> dict:
        with self._lock:
            # Active queue items (not consumed)
            pending_queue = [q for q in self.queue if not q.get('consumed')]
            # Sort pending by votes desc, then added_at asc
            pending_queue.sort(key=lambda x: (-x.get('votes', 1), x.get('added_at', 0)))
            safe_queue = []
            for it in pending_queue:
                d = dict(it)
                d['voters'] = list(it.get('voters', set()))
                safe_queue.append(d)
            return {
                "active": self.active,
                "code": self.code,
                "limit_per_guest": self.limit_per_guest,
                "guest_count": len(self.guests),
                "queue_count": len(safe_queue),
                "queue": safe_queue,
                "sync_cursor": self.sync_cursor
            }

    def add_to_queue(self, track_info: dict, guest_name: str, guest_id: str) -> dict:
        with self._lock:
            if not self.active:
                return {"ok": False, "error": "El Modo Fiesta está desactivado."}

            guest_name = (guest_name or "Invitado").strip()[:30]
            if not guest_id:
                guest_id = guest_name

            # Check guest quota
            guest_stat = self.guests.setdefault(guest_id, {"name": guest_name, "count": 0, "last_seen": time.time()})
            guest_stat["name"] = guest_name
            guest_stat["last_seen"] = time.time()

            # Count unconsumed tracks by this guest
            unconsumed_by_guest = sum(1 for q in self.queue if not q.get('consumed') and q.get('guest_id') == guest_id)
            if unconsumed_by_guest >= self.limit_per_guest:
                return {
                    "ok": False,
                    "error": f"Llegaste al límite de {self.limit_per_guest} canciones en fila. Espera a que suenen algunas."
                }

            # Avoid immediate duplicate in active queue
            for q in self.queue:
                if not q.get('consumed') and q.get('path') == track_info.get('path'):
                    # Auto upvote instead!
                    if guest_id not in q.get('voters', set()):
                        q.setdefault('voters', set()).add(guest_id)
                        q['votes'] = len(q['voters'])
                        self.sync_cursor += 1
                        return {
                            "ok": True,
                            "upvoted": True,
                            "message": f"'{track_info.get('title')}' ya estaba en la fila. ¡Le sumamos tu voto 🔥!",
                            "votes": q['votes']
                        }
                    return {
                        "ok": False,
                        "error": "Esta canción ya está en la fila y ya votaste por ella."
                    }

            item_id = f"party_{int(time.time() * 1000)}_{secrets.token_hex(2)}"
            item = {
                "id": item_id,
                "path": track_info.get('path'),
                "title": track_info.get('title') or "Canción",
                "artist": track_info.get('artist') or "Desconocido",
                "album": track_info.get('album') or "",
                "duration": track_info.get('duration') or "",
                "duration_sec": track_info.get('duration_sec') or 0,
                "cover": track_info.get('cover') or "",
                "guest_name": guest_name,
                "guest_id": guest_id,
                "votes": 1,
                "voters": {guest_id},
                "added_at": time.time(),
                "consumed": False
            }

            self.queue.append(item)
            guest_stat["count"] += 1
            self.sync_cursor += 1

            # Prepare json-safe item
            safe_item = dict(item)
            safe_item['voters'] = list(item['voters'])
            return {"ok": True, "item": safe_item}

    def vote_track(self, item_id: str, guest_id: str) -> dict:
        with self._lock:
            if not self.active:
                return {"ok": False, "error": "El Modo Fiesta está desactivado."}

            for q in self.queue:
                if q.get('id') == item_id and not q.get('consumed'):
                    voters = q.setdefault('voters', set())
                    if guest_id in voters:
                        # Toggle vote off
                        voters.remove(guest_id)
                        q['votes'] = max(1, len(voters))
                        self.sync_cursor += 1
                        return {"ok": True, "voted": False, "votes": q['votes']}
                    else:
                        voters.add(guest_id)
                        q['votes'] = len(voters)
                        self.sync_cursor += 1
                        return {"ok": True, "voted": True, "votes": q['votes']}

            return {"ok": False, "error": "Canción no encontrada en la fila."}

    def get_host_sync(self, last_cursor: int) -> dict:
        with self._lock:
            pending_queue = [q for q in self.queue if not q.get('consumed')]
            pending_queue.sort(key=lambda x: (-x.get('votes', 1), x.get('added_at', 0)))

            # Convert sets to lists
            safe_queue = []
            for it in pending_queue:
                d = dict(it)
                d['voters'] = list(it.get('voters', set()))
                safe_queue.append(d)

            has_changes = self.sync_cursor != last_cursor
            return {
                "active": self.active,
                "code": self.code,
                "has_changes": has_changes,
                "sync_cursor": self.sync_cursor,
                "queue": safe_queue,
                "guest_count": len(self.guests)
            }

    def mark_consumed(self, item_id: str) -> bool:
        with self._lock:
            for q in self.queue:
                if q.get('id') == item_id:
                    q['consumed'] = True
                    self.history.append(dict(q))
                    self.sync_cursor += 1
                    return True
            return False

    def clear_queue(self):
        with self._lock:
            for q in self.queue:
                q['consumed'] = True
            self.sync_cursor += 1

party_manager = PartyModeManager()
