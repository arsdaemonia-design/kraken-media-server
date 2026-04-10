import urllib.parse
name = "Dragon Ball (tmdb-12609)"
encoded = urllib.parse.quote(name)
print(f"Original: {name}")
print(f"Encoded: {encoded}")
print(f"Decoded: {urllib.parse.unquote(encoded)}")