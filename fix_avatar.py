import os

file_path = r"e:\Kraken Media Server\templates\index.html"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """            // Mostrar nombre del usuario
            const users = window._cachedUsers || [];
            const user = users.find(u => u.email === email);
            document.getElementById('auth-password-name').textContent = user ? user.username : email;
        }"""

replacement = """            // Mostrar nombre del usuario
            const users = window._cachedUsers || [];
            const user = users.find(u => u.email === email);
            document.getElementById('auth-password-name').textContent = user ? user.username : email;
            
            // Mostrar avatar del usuario
            const avatarDiv = document.getElementById('auth-password-avatar');
            const displayName = user ? (user.username || email) : email;
            
            if (user && user.avatar_url) {
                avatarDiv.innerHTML = `<img src="${user.avatar_url}" class="w-full h-full object-cover" onerror="this.remove(); this.parentElement.appendChild(document.createTextNode('${displayName.charAt(0).toUpperCase()}'))">`;
            } else {
                avatarDiv.innerHTML = displayName.charAt(0).toUpperCase();
            }
        }"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS")
else:
    print("TARGET NOT FOUND. Trying with varying line endings...")
    target_no_r = target.replace('\r', '')
    content_no_r = content.replace('\r', '')
    if target_no_r in content_no_r:
        print("FOUND WITH NO_R")
        content_no_r = content_no_r.replace(target_no_r, replacement)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content_no_r)
    else:
        print("STILL NOT FOUND")
