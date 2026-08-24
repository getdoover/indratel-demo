from pydoover.docker import run_app

from .application import IndratelDemoApplication

def main():
    """Run the application."""
    run_app(IndratelDemoApplication())
