# 🧪 Guía de Pruebas - Auth Security & HLS Features
**Fecha:** 11 Abril 2026  
**Versión:** v4.91  

---

## ✅ Bug Fix Aplicado
**Problema:** `NameError: name '_app_data_dir' is not defined`  
**Causa:** Variable usada antes de ser definida en `routes/api.py`  
**Solución:** Movido bloque `RUNTIME CONFIG HELPERS` **antes** del `Security Audit Logger`  

---

## 📋 Checklist de Pruebas

### 🔐 1. PASSWORD VALIDATION

**Requisitos:** Mínimo 8 caracteres, no comunes, no secuencias simples

#### Pruebas:
```bash
# ❌ Contraseñas que DEBEN SER RECHAZADAS:
- "12345678"          → Demasiado común
- "password"          → Demasiado común  
- "qwerty12"          → Demasiado común
- "kraken1234"        → Demasiado común
- "0123456789"        → Secuencia simple
- "abcdefg"           → Secuencia simple (solo 7 chars)
- "short1"            → Menos de 8 caracteres

# ✅ Contraseñas que DEBEN SER ACEPTADAS:
- "MiKasa2024!"       → Fuerte, única
- "Tr0ub4dor&x"       → Fuerte
- "CorrectoCaballo99" → Passphrase fuerte
```

#### Cómo probar:
1. **Primer registro (setup):**
   - Ve a `http://localhost:5000`
   - Intenta crear cuenta con contraseña débil → **Debe rechazar**
   - Crea cuenta con contraseña fuerte → **Debe aceptar**

2. **Crear usuario (admin):**
   - Login como admin
   - Ve a Panel Admin → Crear Usuario
   - Intenta contraseña débil → **Debe rechazar con mensaje**
   - Crea con contraseña fuerte → **Debe crear**

3. **Reset password (admin):**
   - Admin → Reset contraseña de usuario
   - Intenta "12345678" → **Debe rechazar**
   - Usa "NuevaClave2024!" → **Debe aceptar**

---

### 🔒 2. RATE LIMITING (Login)

**Requisitos:** Máximo 5 intentos fallidos → bloqueo de 5 minutos

#### Cómo probar:
```bash
# Usar curl para simular intentos fallidos:
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  echo "\nIntento $i"
  sleep 1
done
```

**Resultado esperado:**
- Intentos 1-4: `"error": "Contraseña incorrecta", "remaining_attempts": X`
- Intento 5: **Bloqueo** → `"error": "Demasiados intentos. Intenta en 300 segundos"`
- Ver en consola: `[SECURITY] IP 127.0.0.1 locked for 300s after 5 failed attempts`

#### Logs de seguridad:
Revisa `%APPDATA%\Kraken Media Server\logs\security.log` → Debe tener entradas como:
```
2026-04-11 18:30:15 | WARNING  | LOGIN FALLIDO: email=test@test.com IP=127.0.0.1 intentos=1
2026-04-11 18:30:20 | WARNING  | LOGIN FALLIDO: email=test@test.com IP=127.0.0.1 intentos=5
```

---

### 🚪 3. LOGIN/LOGOUT CON TOKEN BLACKLIST

#### Flujo completo:
```bash
# 1. LOGIN
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@email.com","password":"tu_password"}'

# Response: {"token": "xxxxx.yyyyy", "email": "...", ...}
# Guarda el token

# 2. VERIFICAR TOKEN
curl -X GET http://localhost:5000/api/auth/verify \
  -H "Authorization: Bearer <TOKEN>"

# Debe retornar: {"valid": true, "email": "...", ...}

# 3. LOGOUT
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer <TOKEN>"

# Debe retornar: {"ok": true, "message": "Sesión cerrada correctamente"}

# 4. VERIFICAR TOKEN DESPUÉS DE LOGOUT (DEBE FALLAR)
curl -X GET http://localhost:5000/api/auth/verify \
  -H "Authorization: Bearer <MISMO_TOKEN>"

# Debe retornar: {"valid": false} o 401
```

#### Logs esperados en `security.log`:
```
2026-04-11 18:35:00 | INFO     | LOGIN EXITOSO: email=tu@email.com IP=127.0.0.1 username=TuNombre
2026-04-11 18:36:00 | INFO     | LOGOUT: email=tu@email.com IP=127.0.0.1 jti=a1b2c3d4...
```

---

### 🎬 4. HLS RECONNECTION

#### Escenario de prueba:
1. **Inicia reproducción** de un video largo (>10 min)
2. **Pausa el video** y espera 20+ minutos (simulando sesión expirada)
3. **Intenta reproducir de nuevo** → Debe mostrar botón "Reconectar"
4. **Click en "Reconectar"** → Debe crear nueva sesión HLS sin perder posición

#### Test manual con curl:
```bash
# 1. Obtener token de stream
curl -X POST http://localhost:5000/api/stream/token \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "session_id": "old-session-123"}'

# Response: {"token": "stream-token-xyz", "id": 1}

# 2. Reconectar sesión
curl -X POST http://localhost:5000/api/hls/reconnect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <AUTH_TOKEN>" \
  -d '{
    "old_session_id": "old-session-123",
    "token": "stream-token-xyz",
    "media_id": 1,
    "new_session_id": "new-session-456"
  }'

# Response: {"url": "/hls/new-session-456/playlist.m3u8", "reconnected": true, ...}
```

---

### 📺 5. CHROMECAST CON TOKEN

#### Prueba:
1. **Inicia video** en navegador
2. **Click en ícono Chromecast** (debe estar visible)
3. **Selecciona dispositivo** → Debe conectar
4. **Verifica** que el video se reproduce en TV

#### Logs esperados:
```
[HLS] Subtítulo detectado: ...
[HLS Reconnect] Sesión nueva lista: <session-id>
```

#### Verificar que segmentos HLS incluyen token:
```bash
# Acceder playlist con token
curl "http://localhost:5000/hls/<session-id>/playlist.m3u8?token=<stream-token>"

# Los segmentos .ts deben incluir token:
# segment0.ts?token=xxx
# segment1.ts?token=xxx
```

---

### 📝 6. SECURITY AUDIT LOGS

#### Ubicación:
```
C:\Users\<TU_USUARIO>\AppData\Roaming\Kraken Media Server\logs\security.log
```

#### Eventos que deben aparecer:
| Acción | Log Entry |
|--------|-----------|
| Login exitoso | `LOGIN EXITOSO: email=X IP=Y username=Z` |
| Login fallido | `LOGIN FALLIDO: email=X IP=Y intentos=N` |
| Logout | `LOGOUT: email=X IP=Y jti=abc123...` |
| Crear usuario | `USER CREATED: email=X username=Y` |
| Eliminar usuario | `USER DELETED: email=X` |
| Reset password | `PASSWORD RESET: email=X` |
| PIN admin bypass | `PIN ADMIN BYPASS: email=X IP=Y endpoint=Z` |

#### Cómo revisar:
```powershell
# PowerShell - Ver últimas 50 líneas:
Get-Content "$env:APPDATA\Kraken Media Server\logs\security.log" -Tail 50

# PowerShell - Buscar intentos fallidos:
Select-String -Path "$env:APPDATA\Kraken Media Server\logs\security.log" -Pattern "LOGIN FALLIDO"

# PowerShell - Buscar logouts:
Select-String -Path "$env:APPDATA\Kraken Media Server\logs\security.log" -Pattern "LOGOUT"
```

---

### 🔧 7. ADMIN PIN BYPASS AUDIT

#### Prueba:
1. **Ve a Panel Admin** (requiere login)
2. **Usa master PIN** en lugar de token de usuario (si disponible)
3. **Revisa security.log** → Debe aparecer:
   ```
   2026-04-11 19:00:00 | WARNING  | PIN ADMIN BYPASS: email=user@email.com IP=127.0.0.1 endpoint=admin_get_config path=/api/admin/config method=GET
   ```

---

### 🌐 8. PUBLIC CONFIG ENDPOINT

#### Prueba:
```bash
# Endpoint público (no requiere auth)
curl http://localhost:5000/api/config/public

# Debe retornar:
{"cast_public_url": "https://kraken.ederzu.com"}
```

#### Desde JavaScript (frontend):
```javascript
fetch('/api/config/public')
  .then(r => r.json())
  .then(data => {
    console.log('Cast URL:', data.cast_public_url);
    window.__krakenPublicUrl = data.cast_public_url;
  });
```

---

## 🐛 Troubleshooting

### Error: `_app_data_dir is not defined`
**✅ YA RESUELTO** - Se movió la definición antes del logger.

### Logs no aparecen
- Verifica que la carpeta existe: `$env:APPDATA\Kraken Media Server\logs\`
- Revisa permisos de escritura
- Verifica que `security_logger` no tenga handlers duplicados

### Rate limit no funciona
- El rate limiting es **por IP**
- En local, todas las peticiones son `127.0.0.1`
- Para resetear: reinicia el servidor o espera 5 minutos

### Token blacklist no invalida
- Verifica que `state.TOKEN_BLACKLIST` no esté vacío
- El token debe tener `jti` field
- Revisa `verify_token()` en `services/auth.py`

---

## 📊 Resumen de Tests

| # | Feature | Estado | Notas |
|---|---------|--------|-------|
| 1 | Password validation | ⬜ Pendiente | |
| 2 | Rate limiting | ⬜ Pendiente | |
| 3 | Login/Logout + blacklist | ⬜ Pendiente | |
| 4 | HLS reconnection | ⬜ Pendiente | |
| 5 | Chromecast con token | ⬜ Pendiente | |
| 6 | Security audit logs | ⬜ Pendiente | |
| 7 | PIN bypass audit | ⬜ Pendiente | |
| 8 | Public config endpoint | ⬜ Pendiente | |

---

## 🚀 Inicio Rápido

```bash
# Activar entorno
cd "E:\Kraken Media Server"
venv\Scripts\activate

# Iniciar servidor
python app.py

# Ver logs en tiempo real (otra terminal)
Get-Content "$env:APPDATA\Kraken Media Server\logs\security.log" -Wait -Tail 20
```

---

**Última actualización:** 11 Abril 2026  
**Versión probada:** v4.91
