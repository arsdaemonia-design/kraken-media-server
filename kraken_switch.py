import argparse
import socket


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def pick_mode_interactive() -> str:
    local_ip = get_local_ip()
    print("\n" + "="*50)
    print("🐙 KRAKEN MEDIA SERVER - Selector de Modo")
    print("="*50)
    print()
    print("📡 MODOS DISPONIBLES:")
    print()
    print("  1) ONLINE (Cloud)")
    print("     - Requiere internet")
    print("     - Acceso desde cualquier lugar via Cloudflare")
    print("     - Sincronización en la nube")
    print()
    print("  2) OFFLINE (PWA)")
    print("     - Sin internet necesario")
    print("     - Todo cacheado localmente")
    print("     - Instalable como app en PC/telefono")
    print()
    print("  3) LAN (Red Local)")
    print(f"     - Sin internet (red local WiFi)")
    print(f"     - Acceso desde otros dispositivos: http://{local_ip}:5000")
    print("     - Comparte tu biblioteca en casa")
    print()
    print("-"*50)
    try:
        choice = input("Selecciona modo [1/2/3] (default 1): ").strip()
    except Exception:
        choice = ""
    
    if choice == "2":
        return "offline"
    elif choice == "3":
        return "lan"
    else:
        return "online"


def main():
    parser = argparse.ArgumentParser(description="Kraken Media Server launcher")
    parser.add_argument("--mode", choices=["online", "offline", "lan"], 
                        help="Execution mode: online (cloud), offline (pwa), lan (local network)")
    parser.add_argument("--no-browser", action="store_true", help="Do not auto-open browser")
    args = parser.parse_args()

    mode = args.mode or pick_mode_interactive()
    open_browser = not args.no_browser

    if mode == "offline":
        print("\n🚀 Iniciando modo OFFLINE (PWA)...")
        import app_offline
        app_offline.main(open_browser=open_browser)
        return

    if mode == "lan":
        local_ip = get_local_ip()
        print(f"\n🚀 Iniciando modo LAN (Red Local)...")
        print(f"📺 Accede desde otros dispositivos: http://{local_ip}:5000")
        import app
        app.run_server(open_browser=open_browser)
        return

    print("\n🚀 Iniciando modo ONLINE (Cloud)...")
    import app
    app.run_server(open_browser=open_browser)


if __name__ == "__main__":
    main()
