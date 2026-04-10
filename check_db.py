import sqlite3

conn = sqlite3.connect(r'D:\Skazo\Music\Kraken Media\kraken.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

print('=== ACTUAL DATABASE SCHEMA ===')
for table in tables:
    table_name = table[0]
    cursor.execute(f'PRAGMA table_info({table_name});')
    columns = cursor.fetchall()
    print(f'\nTable: {table_name}')
    for col in columns:
        print(f'  - {col[1]} ({col[2]})')

conn.close()
