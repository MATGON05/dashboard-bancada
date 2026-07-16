import os
import subprocess
import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# 🔥 MAGIA: Pega o caminho da pasta onde este script está rodando, sem precisar digitar caminho fixo!
REPO_PATH = os.path.dirname(os.path.abspath(__file__))  

TEMPO_ESPERA = 2  
ultimo_evento = 0

def rodar_comando(cmd):
    try:
        resultado = subprocess.run(cmd, cwd=REPO_PATH, capture_output=True, text=True)
        if resultado.stdout:
            print(resultado.stdout.strip())
        if resultado.stderr and "error" in resultado.stderr.lower():
            print("ERRO:", resultado.stderr.strip())
    except Exception as e:
        print("Falha no comando:", e)

def sincronizar_agora():
    """Faz git pull, add, commit e push"""
    print("🔄 Sincronizando...")
    rodar_comando(["git", "pull"])
    rodar_comando(["git", "add", "."])
    rodar_comando(["git", "commit", "-m", f"Auto-sync {time.ctime()}"])
    rodar_comando(["git", "push"])
    print("✅ Sincronizado!")

class ManipuladorDeMudancas(FileSystemEventHandler):
    def on_modified(self, event):
        global ultimo_evento
        if not event.is_directory:
            if time.time() - ultimo_evento > TEMPO_ESPERA:
                ultimo_evento = time.time()
                time.sleep(0.5)
                sincronizar_agora()

def puxar_automaticamente():
    """A cada 30 segundos, verifica se há novidades no GitHub"""
    while True:
        time.sleep(30)
        print("🔍 Verificando novidades no GitHub...")
        rodar_comando(["git", "pull"])

if __name__ == "__main__":
    print("🚀 Monitorando a pasta...")
    print(f"📂 {REPO_PATH}")
    
    threading.Thread(target=puxar_automaticamente, daemon=True).start()
    
    event_handler = ManipuladorDeMudancas()
    observer = Observer()
    observer.schedule(event_handler, REPO_PATH, recursive=True)
    observer.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()