import re

# 1. Update index.html list to include '18'
with open("templates/index.html", "r", encoding="utf-8") as f:
    html = f.read()

old_list = "['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', '18+', 'MA15+', 'M', '16']"
new_list = "['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', '18', '18+', 'MA15+', 'M', '16']"
html = html.replace(old_list, new_list)

with open("templates/index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("UI updated with '18' rating option.")
