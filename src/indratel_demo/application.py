import logging

from pydoover.processor import Application
from pydoover.models import AggregateUpdateEvent

from .app_config import IndratelDemoConfig
from .app_ui import IndratelDemoUI

log = logging.getLogger(__name__)


class IndratelDemoApp(Application):
    """Indratel demo dashboard.

    A display-only cloud app: it owns no tags of its own, it just registers the
    remote component so the widget renders on the agent page. Deploying updates
    the deployment_config aggregate, which fires on_aggregate_update through our
    subscription and re-pushes ui_state.
    """

    config: IndratelDemoConfig
    config_cls = IndratelDemoConfig
    ui_cls = IndratelDemoUI

    async def on_aggregate_update(self, event: AggregateUpdateEvent):
        log.info("Deployment config updated for agent %s", self.agent_id)
