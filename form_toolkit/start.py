#!/usr/bin/env python3
"""
Polonya Form Araci - Tek Komut Baslatici

Kullanim:
    python start.py            # Production: build + serve
    python start.py --dev      # Dev: Vite HMR (port 5173) + Flask
    python start.py --no-build # Build atla, direkt Flask baslat
    python start.py --rebuild  # Frontend'i yeniden build et + serve
"""
import argparse
import os
import platform
import subprocess
import sys


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Windows: npm is npm.cmd
NPM = "npm.cmd" if platform.system() == "Windows" else "npm"


def build_frontend():
    print("Frontend build ediliyor...")
    result = subprocess.run(
        [NPM, "run", "build"],
        cwd=FRONTEND_DIR,
        check=False,
    )
    if result.returncode != 0:
        print("HATA: Frontend build basarisiz.")
        sys.exit(1)
    print("Frontend build tamamlandi.")


def start_flask(dev: bool = False):
    env = os.environ.copy()
    env["FLASK_ENV"] = "development" if dev else "production"
    subprocess.run(
        [sys.executable, os.path.join(BASE_DIR, "app.py")],
        env=env,
    )


def main():
    parser = argparse.ArgumentParser(description="Polonya Form Araci")
    parser.add_argument("--dev", action="store_true", help="Development modu")
    parser.add_argument("--no-build", action="store_true", help="Frontend build atla")
    parser.add_argument("--rebuild", action="store_true", help="Frontend'i yeniden build et")
    args = parser.parse_args()

    static_index = os.path.join(STATIC_DIR, "index.html")
    needs_build = not os.path.exists(static_index)

    if args.dev:
        print("Dev modu: Vite + Flask baslatiliyor...")
        vite_proc = subprocess.Popen(
            [NPM, "run", "dev"],
            cwd=FRONTEND_DIR,
        )
        try:
            start_flask(dev=True)
        except KeyboardInterrupt:
            pass
        finally:
            vite_proc.terminate()
            vite_proc.wait()
    else:
        if args.rebuild:
            build_frontend()
        elif not args.no_build and needs_build:
            build_frontend()
        elif not args.no_build and not needs_build:
            print("static/index.html mevcut, build atlaniyor. Yeniden build: python start.py --rebuild")
        start_flask(dev=False)


if __name__ == "__main__":
    main()
