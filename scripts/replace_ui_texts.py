import os
import glob
import re

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    # Textos específicos
    new_content = new_content.replace('Pesquisa de Investimentos no Estado de São Paulo', 'Painel de Empreendedorismo do Estado de São Paulo')
    new_content = new_content.replace('Pesquisa de Investimentos', 'Painel de Empreendedorismo')
    
    # "PIESP" maiúsculo
    new_content = new_content.replace('PIESP', 'Empreendedorismo')
    # "Piesp" Capitalized
    new_content = new_content.replace('Piesp', 'Empreendedorismo')
    # "piesp" minúsculo (mas cuidado para não quebrar imports/paths já alterados que possivelmente ainda tenham algo não alterado)
    # Como já rodamos a renomeação de arquivos, podemos renomear "piesp" minúsculo solto.
    new_content = new_content.replace('piesp', 'empreendedorismo')

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated UI texts in {filepath}")

files = glob.glob('components/**/*.tsx', recursive=True) + glob.glob('hooks/**/*.ts', recursive=True) + glob.glob('App.tsx')

for filepath in files:
    replace_in_file(filepath)
