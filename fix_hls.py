import sys

with open('templates/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add hide controls to playVideoMode, before fetching HLS API
target1 = "const sid = localStorage.getItem('kraken_sid') || 'default';"
if target1 in text and "el.classList.add('hidden')" not in text[text.find(target1):text.find(target1)+500]:
    injection1 = """
                // Ocultar la UI nativa de Kraken para que no duplique controls
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.add('hidden');
                });
"""
    text = text.replace(target1, injection1 + "\n                " + target1)

# 2. Add show controls to exitVideoMode
target2 = "const v = document.getElementById('main-video');"
if target2 in text and "el.classList.remove('hidden')" not in text[text.find(target2)-500:text.find(target2)+500]:
    injection2 = """
                // Mostrar la UI nativa de Kraken de nuevo
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.remove('hidden');
                });
"""
    text = text.replace(target2, injection2 + "\n                " + target2)

# 3. Add show controls to fallbackVideoSetup
target3 = "function fallbackVideoSetup() {"
if target3 in text and "el.classList.remove('hidden')" not in text[text.find(target3):text.find(target3)+500]:
    injection3 = """
                // Asegurar que la UI nativa se muestre si caemos en el fallback
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.remove('hidden');
                });
"""
    text = text.replace("const videoEl = document.getElementById('main-video');", injection3 + "\n                const videoEl = document.getElementById('main-video');", 1)

# 4. Insert customType in ArtPlayer config
target4 = "setting: true,"
if target4 in text and "customType:" not in text[text.find(target4):text.find(target4)+500]:
    injection4 = """
                                customType: {
                                    m3u8: function (video, url, art) {
                                        if (Hls.isSupported()) {
                                            if (art.hls) art.hls.destroy();
                                            const hls = new Hls();
                                            hls.loadSource(url);
                                            hls.attachMedia(video);
                                            art.hls = hls;
                                            art.on('destroy', () => hls.destroy());
                                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                            video.src = url;
                                        } else {
                                            art.notice.show = 'No soporta reproducción HLS nativa en este navegador';
                                        }
                                    }
                                },"""
    text = text.replace(target4, target4 + "\n" + injection4)

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
