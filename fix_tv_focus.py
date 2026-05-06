import os

path = "templates/index.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Añadir tabindex a cards y filas de lista para navegación con mando
content = content.replace('class="card-interactive', 'tabindex="0" class="card-interactive')
content = content.replace('class="list-row', 'tabindex="0" class="list-row')

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Tabindex injected into all interactive elements.")
