import sys
import os
import time
import json
import unittest

# Ensure server module is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import app
from services.database import get_db
from services.auth import create_token
import state

class TestNewFeaturesV5(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from services.database import init_db
        init_db()
        cls.client = app.test_client()
        
        # Ensure superadmin exists in test DB
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT email, username FROM users WHERE is_superadmin = 1 LIMIT 1")
        admin = c.fetchone()
        if not admin:
            c.execute("INSERT OR REPLACE INTO users (email, username, pin_hash, is_superadmin, role) VALUES ('admin@kraken.test', 'admin', 'hash', 1, 'admin')")
            conn.commit()
            cls.admin_email = 'admin@kraken.test'
            cls.admin_username = 'admin'
        else:
            cls.admin_email = admin['email']
            cls.admin_username = admin['username']
        
        # Ensure a test audio item and test adult/video items exist
        c.execute("SELECT id, rel_path FROM media WHERE media_type = 'audio' AND COALESCE(is_adult, 0) = 0 AND COALESCE(is_hidden, 0) = 0 LIMIT 1")
        audio = c.fetchone()
        if not audio:
            c.execute("""
                INSERT OR REPLACE INTO media (rel_path, filename, folder, full_folder, media_type, title, artist, is_adult, is_hidden)
                VALUES ('test_song.mp3', 'test_song.mp3', 'test', 'test', 'audio', 'Canción de Prueba', 'Artista Prueba', 0, 0)
            """)
            conn.commit()
            c.execute("SELECT id, rel_path FROM media WHERE rel_path = 'test_song.mp3'")
            audio = c.fetchone()
        cls.audio_id = audio['id']
        cls.audio_path = audio['rel_path']

        # Adult item for security test
        c.execute("""
            INSERT OR REPLACE INTO media (rel_path, filename, folder, full_folder, media_type, title, is_adult, is_hidden)
            VALUES ('vault/secret_adult.mp4', 'secret_adult.mp4', 'vault', 'vault', 'video', 'Adult Secret', 1, 0)
        """)
        # Video item for audio-only test
        c.execute("""
            INSERT OR REPLACE INTO media (rel_path, filename, folder, full_folder, media_type, title, is_adult, is_hidden)
            VALUES ('movies/regular_movie.mp4', 'regular_movie.mp4', 'movies', 'movies', 'video', 'Regular Movie', 0, 0)
        """)
        conn.commit()
        c.execute("SELECT id FROM media WHERE rel_path = 'vault/secret_adult.mp4'")
        cls.adult_id = c.fetchone()['id']
        c.execute("SELECT id FROM media WHERE rel_path = 'movies/regular_movie.mp4'")
        cls.video_id = c.fetchone()['id']
        conn.close()

        cls.admin_token = create_token(cls.admin_email, cls.admin_username, True, role='admin')
        cls.headers_admin = {
            'Authorization': f'Bearer {cls.admin_token}',
            'Content-Type': 'application/json'
        }

    # 1. BETA INVITES & USER REGISTRATION
    def test_01_create_beta_invite_persisted_in_db(self):
        res = self.client.post('/api/admin/invite', headers=self.headers_admin, json={
            'duration_minutes': 60,
            'is_beta': True,
            'trial_hours': 48
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        code = data['code']
        self.assertTrue(data['is_beta'])
        self.assertEqual(data['trial_hours'], 48)

        # Verify DB persistence
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT * FROM invites WHERE code = ?", (code,))
        row = c.fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertEqual(row['code'], code)
        self.assertEqual(row['is_beta'], 1)

    def test_02_validate_and_register_beta_user(self):
        # Create invite
        res = self.client.post('/api/admin/invite', headers=self.headers_admin, json={
            'duration_minutes': 60,
            'is_beta': True,
            'trial_hours': 72
        })
        code = res.get_json()['code']

        # Validate code without consuming
        v_res = self.client.post('/api/admin/invite/validate', json={'code': code})
        self.assertEqual(v_res.status_code, 200)
        self.assertTrue(v_res.get_json()['valid'])
        self.assertTrue(v_res.get_json()['is_beta'])

        # Register user with invite
        username = f"tester_{int(time.time() * 1000)}"
        r_res = self.client.post('/api/auth/register', json={
            'username': username,
            'password': 'SecurePassword123!',
            'invite_code': code
        })
        self.assertEqual(r_res.status_code, 200)
        reg_data = r_res.get_json()
        self.assertEqual(reg_data['role'], 'beta')
        self.assertIsNotNone(reg_data['trial_expires_at'])
        user_email = reg_data['email']

        # Verify invite is marked consumed in DB
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT used_at, used_by FROM invites WHERE code = ?", (code,))
        inv_row = c.fetchone()
        conn.close()
        self.assertIsNotNone(inv_row['used_at'])

        # Re-using the same invite code must fail
        dup_res = self.client.post('/api/auth/register', json={
            'username': f"dup_{username}",
            'password': 'SecurePassword123!',
            'invite_code': code
        })
        self.assertIn(dup_res.status_code, (403, 400))

        # Login with beta user
        login_res = self.client.post('/api/auth/login', json={
            'email': user_email,
            'password': 'SecurePassword123!'
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertEqual(login_res.get_json()['role'], 'beta')

        # Simulate expiration
        conn = get_db()
        c = conn.cursor()
        c.execute("UPDATE users SET trial_expires_at = ? WHERE email = ?", (time.time() - 3600, user_email))
        conn.commit()
        conn.close()

        # Login must be blocked with HTTP 403
        exp_res = self.client.post('/api/auth/login', json={
            'email': user_email,
            'password': 'SecurePassword123!'
        })
        self.assertEqual(exp_res.status_code, 403)
        self.assertTrue(exp_res.get_json().get('expired'))

        # Admin converts user to permanent
        perm_res = self.client.put(f'/api/admin/users/{user_email}/role', headers=self.headers_admin, json={
            'action': 'convert_permanent'
        })
        self.assertEqual(perm_res.status_code, 200)

        # Login must now succeed
        active_res = self.client.post('/api/auth/login', json={
            'email': user_email,
            'password': 'SecurePassword123!'
        })
        self.assertEqual(active_res.status_code, 200)
        self.assertEqual(active_res.get_json()['role'], 'user')

    # 2. SECURITY AUDIT CHECKS ON SHARE LINKS (/api/share/create)
    def test_03_share_link_duration_limits(self):
        # Exceeds max 168 hours -> 400
        res = self.client.post('/api/share/create', headers=self.headers_admin, json={
            'media_id': self.audio_id,
            'expires_in_hours': 999
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('168', res.get_json().get('error', ''))

        # Less than 1 hour -> 400
        res_zero = self.client.post('/api/share/create', headers=self.headers_admin, json={
            'media_id': self.audio_id,
            'expires_in_hours': 0.1
        })
        self.assertEqual(res_zero.status_code, 400)

        # Valid 24 hours -> 200
        res_valid = self.client.post('/api/share/create', headers=self.headers_admin, json={
            'media_id': self.audio_id,
            'expires_in_hours': 24
        })
        self.assertEqual(res_valid.status_code, 200)
        self.assertTrue(res_valid.get_json()['ok'])
        token = res_valid.get_json()['token']
        self.assertIsNotNone(token)

    def test_04_share_link_blocks_non_audio_and_adult(self):
        # Attempting to share video -> 400
        res_video = self.client.post('/api/share/create', headers=self.headers_admin, json={
            'media_id': self.video_id,
            'expires_in_hours': 24
        })
        self.assertEqual(res_video.status_code, 400)
        self.assertIn('audio', res_video.get_json().get('error', '').lower())

        # Attempting to share adult media -> 403
        res_adult = self.client.post('/api/share/create', headers=self.headers_admin, json={
            'media_id': self.adult_id,
            'expires_in_hours': 24
        })
        self.assertEqual(res_adult.status_code, 403)
        self.assertIn('protegido', res_adult.get_json().get('error', '').lower())

    def test_05_share_routes_return_410_on_expiration(self):
        # Create a valid share link
        res = self.client.post('/api/share/create', headers=self.headers_admin, json={
            'media_id': self.audio_id,
            'expires_in_hours': 24
        })
        token = res.get_json()['token']

        # Force expire token in database
        conn = get_db()
        c = conn.cursor()
        c.execute("UPDATE shared_links SET expires_at = ? WHERE token = ?", (time.time() - 3600, token))
        conn.commit()
        conn.close()

        # 1. Main player page returns 410
        p_res = self.client.get(f'/share/{token}')
        self.assertEqual(p_res.status_code, 410)

        # 2. Stream endpoint returns 410
        s_res = self.client.get(f'/share/{token}/stream')
        self.assertEqual(s_res.status_code, 410)

        # 3. Cover endpoint returns 410
        c_res = self.client.get(f'/share/{token}/cover')
        self.assertEqual(c_res.status_code, 410)

        # 4. Lyrics endpoint returns 410
        l_res = self.client.get(f'/share/{token}/lyrics')
        self.assertEqual(l_res.status_code, 410)

if __name__ == '__main__':
    unittest.main()
