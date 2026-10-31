import sys
import os
import time
import json
import unittest
import urllib.parse

# Ensure server module is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import app
from services.database import get_db
from services.auth import create_token
import state
import config
from routes.api import get_master_pin

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

    # 4. STATIC COVER FALLBACK & STATUS RELIABILITY
    def test_06_default_cover_route(self):
        # 1. Direct /static/default_cover.jpg returns 200 and image
        res = self.client.get('/static/default_cover.jpg')
        self.assertEqual(res.status_code, 200)
        self.assertIn('image/', res.content_type)

        # 2. /assets/default_cover.jpg returns 200 and image
        res_assets = self.client.get('/assets/default_cover.jpg')
        self.assertEqual(res_assets.status_code, 200)
        self.assertIn('image/', res_assets.content_type)

    def test_07_status_endpoint_resilient(self):
        # 1. Normal status poll with active playing params
        res = self.client.get('/status?sid=sess_test123&user=Skaso&is_speaker=false&song=Regular+Movie&artist=movies&path=&time=0&duration=0&is_playing=false&volume=1&queue_length=1&current_index=0&library_mode=video&device_name=PC+Windows&device_type=desktop&media_type=video')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, dict)
        self.assertIn('online_users', data)

        # 2. Empty query params poll must never crash or throw 500
        res_empty = self.client.get('/status')
        self.assertEqual(res_empty.status_code, 200)
        data_empty = res_empty.get_json()
        self.assertIsInstance(data_empty, dict)

    def test_08_tv_episodes_apostrophe_and_case_insensitive(self):
        # Insert a series with an apostrophe in path
        conn = get_db()
        c = conn.cursor()
        c.execute("""
            INSERT OR REPLACE INTO media (rel_path, filename, folder, full_folder, media_type, folder_type, title, is_adult, is_hidden)
            VALUES ('Video/Series/That ''70s Show/Season 1/S01E01.mkv', 'S01E01.mkv', 'That ''70s Show', 'That ''70s Show', 'video', 'series', 'Pilot Episode', 0, 0)
        """)
        conn.commit()
        conn.close()

        # Query TV episodes endpoint with path having apostrophe
        res = self.client.get("/api/tv/episodes?path=Video/Series/That%20'70s%20Show", headers={
            'Authorization': f'Bearer {self.admin_token}',
            'X-Master-Pin': '0000'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('items', data)
        self.assertGreaterEqual(len(data['items']), 1)
        first_ep = data['items'][0]
        self.assertEqual(first_ep['season'], 'Temporada 1')

    def test_09_hls_4k_direct_play_and_selective_downscale(self):
        from services.hls_transcoder import hls_transcoder
        import inspect

        # 1. Verify start_hls_session supports force_transcode and downscale_1080
        sig = inspect.signature(hls_transcoder.start_hls_session)
        self.assertIn('force_transcode', sig.parameters)
        self.assertIn('downscale_1080', sig.parameters)
        self.assertEqual(sig.parameters['downscale_1080'].default, False)

        # 2. Test FFmpeg command generation:
        analysis_4k = {
            'video_codec': 'hevc',
            'pix_fmt': 'yuv420p',
            'width': 3840,
            'height': 2160,
            'is_over_1080p': True,
            'video_needs_transcode': True,
            'audio_tracks': [{'index': 0, 'channels': 2}]
        }

        # Case A: Normal playback (downscale_1080=False) -> MUST NOT downscale, preserves 4K!
        cmd_4k, _ = hls_transcoder._build_ffmpeg_hls_cmd(
            input_file='dummy_4k.mkv',
            output_dir='dummy_dir',
            playlist_path='dummy_dir/playlist.m3u8',
            analysis=analysis_4k,
            normalized_audio_index=0,
            force_video_reencode=True,
            downscale_1080=False
        )
        cmd_4k_str = ' '.join(cmd_4k)
        self.assertNotIn("scale='min(1920,iw)':-2", cmd_4k_str)

        # Case B: TV fallback recovery (downscale_1080=True) -> MUST apply 1080p scale
        cmd_tv, _ = hls_transcoder._build_ffmpeg_hls_cmd(
            input_file='dummy_4k.mkv',
            output_dir='dummy_dir',
            playlist_path='dummy_dir/playlist.m3u8',
            analysis=analysis_4k,
            normalized_audio_index=0,
            force_video_reencode=True,
            downscale_1080=True
        )
        cmd_tv_str = ' '.join(cmd_tv)
        self.assertIn("scale='min(1920,iw)':-2", cmd_tv_str)

        # Case C: 4K H.264 stream (downscale_1080=False, force_video_reencode=False) -> MUST use -c:v copy (4K remux without re-encoding)
        analysis_4k_h264 = {
            'video_codec': 'h264',
            'pix_fmt': 'yuv420p',
            'width': 3840,
            'height': 2160,
            'is_over_1080p': True,
            'hls_can_copy_video': True,
            'video_needs_transcode': False,
            'audio_tracks': [{'index': 0, 'channels': 2}]
        }
        cmd_copy_4k, used_reencode = hls_transcoder._build_ffmpeg_hls_cmd(
            input_file='dummy_4k_h264.mkv',
            output_dir='dummy_dir',
            playlist_path='dummy_dir/playlist.m3u8',
            analysis=analysis_4k_h264,
            normalized_audio_index=0,
            force_video_reencode=False,
            downscale_1080=False
        )
        self.assertFalse(used_reencode)
        self.assertIn("-c:v copy", ' '.join(cmd_copy_4k))

    # 5. PRIVACY: CROSS-ACCOUNT DEVICE CONTROL PROTECTION
    def test_10_device_control_cross_account_forbidden(self):
        # Setup two users from different accounts in ACTIVE_USERS
        sid_alice = 'sess_alice_mobile_001'
        sid_bob_tv = 'sess_bob_smart_tv_002'
        sid_bob_phone = 'sess_bob_mobile_003'

        with state.USERS_LOCK:
            state.ACTIVE_USERS[sid_alice] = {
                'name': 'Alice',
                'email': 'alice@example.com',
                'device_name': 'Alice iPhone',
                'device_type': 'mobile',
                'is_superadmin': False,
                'last_seen': time.time()
            }
            state.ACTIVE_USERS[sid_bob_tv] = {
                'name': 'Bob',
                'email': 'bob@example.com',
                'device_name': 'Bob Living Room TV',
                'device_type': 'tv',
                'is_superadmin': False,
                'last_seen': time.time()
            }
            state.ACTIVE_USERS[sid_bob_phone] = {
                'name': 'Bob',
                'email': 'bob@example.com',
                'device_name': 'Bob Galaxy Phone',
                'device_type': 'mobile',
                'is_superadmin': False,
                'last_seen': time.time()
            }

        # 1. Alice attempts to link / hijack Bob's TV -> Rejected with 403
        link_res = self.client.post('/device/control/link', json={
            'controller_sid': sid_alice,
            'target_sid': sid_bob_tv
        })
        self.assertEqual(link_res.status_code, 403)
        self.assertFalse(link_res.get_json()['ok'])

        # 2. Alice attempts to send direct hardware command ('play', 'seek', etc.) -> Rejected with 403
        cmd_res = self.client.post('/control', json={
            'target': sid_bob_tv,
            'action': 'pause',
            'from_sid': sid_alice,
            'from_email': 'alice@example.com',
            'from_name': 'Alice'
        })
        self.assertEqual(cmd_res.status_code, 403)
        self.assertEqual(cmd_res.get_json()['status'], 'error')

        # 3. Social actions (chat/watch party) are permitted across accounts
        chat_res = self.client.post('/control', json={
            'target': sid_bob_tv,
            'action': 'party_chat_hello',
            'from_sid': sid_alice,
            'from_email': 'alice@example.com',
            'from_name': 'Alice'
        })
        self.assertEqual(chat_res.status_code, 200)
        self.assertEqual(chat_res.get_json()['status'], 'sent')

        # 4. Bob's phone controls Bob's TV (same account) -> Permitted
        link_same = self.client.post('/device/control/link', json={
            'controller_sid': sid_bob_phone,
            'target_sid': sid_bob_tv
        })
        self.assertEqual(link_same.status_code, 200)
        self.assertTrue(link_same.get_json()['ok'])

        cmd_same = self.client.post('/control', json={
            'target': sid_bob_tv,
            'action': 'pause',
            'from_sid': sid_bob_phone,
            'from_email': 'bob@example.com',
            'from_name': 'Bob Phone'
        })
        self.assertEqual(cmd_same.status_code, 200)
        self.assertEqual(cmd_same.get_json()['status'], 'sent')

        # Clean up test sessions
        with state.USERS_LOCK:
            state.ACTIVE_USERS.pop(sid_alice, None)
            state.ACTIVE_USERS.pop(sid_bob_tv, None)
            state.ACTIVE_USERS.pop(sid_bob_phone, None)

    # 11. SERIES EPISODES WITH APOSTROPHES & TITLE NORMALIZATION
    def test_11_series_episodes_with_apostrophe(self):
        # Query series with apostrophe: "Video/Series/El Show de los 70's (tmdb-52)"
        series_path = "Video/Series/El Show de los 70's (tmdb-52)"
        res = self.client.get(
            f"/api/tv/episodes?path={urllib.parse.quote(series_path)}",
            headers={
                'Authorization': f'Bearer {self.admin_token}',
                'X-Master-Pin': get_master_pin()
            }
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('items', data)
        self.assertGreater(len(data['items']), 0)
        self.assertIn('series_title', data)
        # Verify title cleanup does not produce raw 'Ingles]'
        sample = data['items'][0]
        self.assertFalse(sample['title'].strip().lower().endswith('ingles]'))
        self.assertTrue(any(e['season'].startswith('Temporada') for e in data['items']))

    # 12. TV QR CODE LOGIN FLOW (/api/tv/qr/init -> /tv-verify -> /api/tv/qr/approve -> /api/tv/qr/poll)
    def test_12_tv_qr_auth_flow(self):
        # 1. TV requests QR init
        init_res = self.client.post('/api/tv/qr/init')
        self.assertEqual(init_res.status_code, 200)
        init_data = init_res.get_json()
        code = init_data.get('code')
        self.assertIsNotNone(code)
        self.assertEqual(len(code), 6)
        self.assertIn('/tv-verify?code=', init_data.get('verify_url', ''))

        # 2. TV polls while pending
        poll_pending = self.client.get(f'/api/tv/qr/poll?code={code}')
        self.assertEqual(poll_pending.status_code, 200)
        self.assertEqual(poll_pending.get_json()['status'], 'pending')

        # 3. Mobile opens /tv-verify page
        verify_page = self.client.get(f'/tv-verify?code={code}')
        self.assertEqual(verify_page.status_code, 200)
        self.assertIn(code.encode(), verify_page.data)

        # 4. Mobile approves QR using its Bearer token
        approve_res = self.client.post('/api/tv/qr/approve', headers=self.headers_admin, json={'code': code})
        self.assertEqual(approve_res.status_code, 200)
        self.assertEqual(approve_res.get_json()['status'], 'approved')

        # 5. TV polls again and receives approved JWT token + user data
        poll_ok = self.client.get(f'/api/tv/qr/poll?code={code}')
        self.assertEqual(poll_ok.status_code, 200)
        poll_data = poll_ok.get_json()
        self.assertEqual(poll_data['status'], 'approved')
        self.assertTrue(len(poll_data.get('token', '')) > 20)
        self.assertEqual(poll_data.get('email'), self.admin_email)

        # 6. Subsequent poll with consumed code returns 404 expired
        poll_consumed = self.client.get(f'/api/tv/qr/poll?code={code}')
        self.assertEqual(poll_consumed.status_code, 404)

    @classmethod
    def tearDownClass(cls):
        conn = get_db()
        c = conn.cursor()
        c.execute("DELETE FROM media WHERE rel_path IN ('vault/secret_adult.mp4', 'movies/regular_movie.mp4', 'test_song.mp3', 'Video/Series/That ''70s Show/Season 1/S01E01.mkv')")
        c.execute("DELETE FROM users WHERE email LIKE 'tester_%'")
        c.execute("DELETE FROM invites WHERE code LIKE 'test_%' OR trial_hours = 48")
        conn.commit()
        conn.close()

if __name__ == '__main__':
    unittest.main()
