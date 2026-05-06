import os

path = "templates/index.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

animation_css = """
        @keyframes loading-bar {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
        }
"""

if "</style>" in content and "loading-bar" not in content:
    content = content.replace("</style>", animation_css + "\n    </style>")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("CSS Animation added successfully.")
else:
    print("CSS already present or tag not found.")
