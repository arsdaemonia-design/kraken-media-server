# RELEASE NOTES v4.76

Fecha: 2026-03-24

## Resumen

Version enfocada en estabilidad de instalacion Windows, iconografia final y robustez del Setup Wizard en instalaciones bajo `Program Files`.

## Novedades principales

1. Crossfade de audio (Web Audio API)
- Transicion fluida entre pistas con doble `<audio>` + `GainNode`.
- Preserva visualizador y sincronizacion de barra/tiempo.

2. Setup Wizard y Settings
- Setup inicial + panel de ajustes para email/PIN/ruta de biblioteca.
- Validaciones Gmail + PIN minimo 4 digitos.

3. Iconos
- EXE con icono embebido (`assets/kraken.ico`).
- Instalador con icono propio (`assets/kraken_setup.ico`).
- Iconos PWA/browser actualizados (`ico`, `192`, `512`, `apple-touch`).

4. Installer hardening (Windows)
- Se genero variante de instalador estable (`safe`) para evitar crash `ucrtbase.dll`.
- Compresion ajustada a modo conservador.

5. Runtime config para installer build (sin tocar portables)
- Para instalaciones en `Program Files`, Setup/Settings persisten cambios en:
  - `%LOCALAPPDATA%\\Kraken Media Server\\runtime_config.json`
- Evita error 500 por `Permission denied` al intentar editar `_internal/config.py`.
- Aplicado solo a build de instalador (`dist/KrakenOffline/_internal`).

6. Limpieza de avatares
- Renombrados a formato `avatar_001...avatar_036` en build instalador.
- Eliminacion de duplicados anidados para reducir peso del instalador.

## Artefactos generados

- `dist/Kraken_Windows_v4.76.zip`
- `dist/Kraken_Windows_EXE_v4.76.zip`
- `dist/Kraken_Mac_v4.76.zip`
- `dist/Kraken_Media_Server_Installer_v4.76_safe.exe`
- `dist/Kraken_Media_Server_Installer_v4.76_runtimecfg.exe` (recomendado)

## Recomendacion de distribucion

- Windows Installer: usar `Kraken_Media_Server_Installer_v4.76_runtimecfg.exe`.
- Windows Portable/BAT: sin cambios de arquitectura en persistencia.
- Mac portable: sin cambios por esta correccion de permisos en Program Files.
