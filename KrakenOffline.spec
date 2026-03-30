# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app_offline.py'],
    pathex=[],
    binaries=[],
    datas=[('templates', 'templates'), ('assets', 'assets'), ('routes', 'routes'), ('services', 'services'), ('sw.js', '.'), ('config.py', '.'), ('state.py', '.'), ('utils.py', '.'), ('app.py', '.'), ('app_logic.py', '.'), ('app_tail.py', '.'), ('alexa_handlers.py', '.'), ('alexa_tail.py', '.'), ('ffmpeg.exe', '.'), ('ffprobe.exe', '.'), ('cloudflared-windows-amd64.exe', '.')],
    hiddenimports=[
        'flask', 'flask_compress', 'flask_ask_sdk',
        'yt_dlp', 'yt_dlp.YoutubeDL',
        'mutagen', 'mutagen.easyid3', 'mutagen.id3', 'mutagen.mp3', 'mutagen.mp4',
        'PIL', 'PIL.Image',
        'requests', 'urllib3', 'urllib3.exceptions',
        'langdetect', 'langdetect.lang_detect_exception',
        'librosa', 'numpy',
        'ask_sdk_core', 'ask_sdk_core.skill_builder', 'ask_sdk_core.dispatch_components', 'ask_sdk_core.utils',
        'io', 'collections', 'collections.deque'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='KrakenOffline',
    icon='assets\\kraken.ico',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='KrakenOffline',
)
