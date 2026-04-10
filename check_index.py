import re

# Leer el archivo
with open('templates/index.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Buscar errores comunes de JS en el área problemática (líneas 7800-8200)
lines = content.split('\n')

# Verificar balance de llaves en funciones importantes
start_check = False
brace_count = 0
for i, line in enumerate(lines[7500:8200], start=7501):
    if 'function' in line and 'renderLib' in line:
        start_check = True
    if start_check:
        brace_count += line.count('{') - line.count('}')
        if brace_count < 0:
            print(f"Error en línea {i}: desbalance de llaves")
            print(line[:100])
            break

print("\n--- Verificación completa ---")
print(f"Total líneas: {len(lines)}")
print(f"Llaves sin cerrar aprox: {brace_count}")

# Verificar paréntesis balanceados
paren_count = 0
for i, line in enumerate(lines[7800:8100], start=7801):
    paren_count += line.count('(') - line.count(')')
    if abs(paren_count) > 10:
        print(f"Línea {i}: posible desbalance de paréntesis")
        print(line[:100])
        break

print(f"Paréntesis sin cerrar: {paren_count}")
