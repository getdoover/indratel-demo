from pydoover.processor import run_app

from .application import IndratelDemoApp
from .app_config import IndratelDemoConfig


def handler(event, context):
    """Lambda handler entry point."""
    IndratelDemoConfig.clear_elements()
    return run_app(
        IndratelDemoApp(),
        event,
        context,
    )
