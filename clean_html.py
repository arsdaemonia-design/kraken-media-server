import os

path = "templates/index.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Revertir la inyección de tabindex para limpiar el DOM
content = content.replace('tabindex="0" class="card-interactive', 'class="card-interactive')
content = content.replace('tabindex="0" class="list-row', 'class="list-row')

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("HTML Cleaned: Tabindex attributes removed.")
