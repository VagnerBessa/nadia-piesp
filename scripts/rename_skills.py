import os
import glob

def replace_in_file(filepath, old_str, new_str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = content.replace(old_str, new_str)
    
    # Adicionando casos adicionais de case
    new_content = new_content.replace(old_str.upper(), new_str)
    new_content = new_content.replace(old_str.lower(), new_str.lower())

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

replacements = {
    'da PIESP': 'de Empreendedorismo',
    'na PIESP': 'no Empreendedorismo',
    'a PIESP': 'o Empreendedorismo',
    'PIESP': 'Empreendedorismo',
}

files = glob.glob('skills/**/*.md', recursive=True)

for filepath in files:
    for old, new in replacements.items():
        replace_in_file(filepath, old, new)
