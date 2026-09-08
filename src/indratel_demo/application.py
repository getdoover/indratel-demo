import logging

from pydoover.models import AggregateUpdateEvent, DeploymentEvent
from pydoover.processor import Application

from .app_config import IndratelDemoConfig
from .app_ui import IndratelDemoUI
from .widget_channel import (
    needs_publish,
    remote_component_nodes,
    widget_channel_name,
    widget_channel_payload,
)

log = logging.getLogger(__name__)


class IndratelDemoApp(Application):
    """Indratel demo dashboard.

    A display-only cloud app: it owns no tags of its own, it just registers the
    remote component so the widget renders on the agent page. Deploying updates
    the deployment_config aggregate, which fires on_aggregate_update through our
    subscription and re-pushes ui_state.

    On every deployment and config change it also mirrors the resolved remote
    component node into the widget channel, so a device-local HMI — which never
    sees this cloud app's ui_state node — can still resolve the widget. See
    ``widget_channel.py`` for why.
    """

    config: IndratelDemoConfig
    config_cls = IndratelDemoConfig
    ui_cls = IndratelDemoUI

    async def on_deployment(self, event: DeploymentEvent):
        log.info("Deployed to agent %s", self.agent_id)
        await self._mirror_widget_placement()

    async def on_aggregate_update(self, event: AggregateUpdateEvent):
        log.info("Deployment config updated for agent %s", self.agent_id)
        await self._mirror_widget_placement()

    async def _mirror_widget_placement(self) -> None:
        """Best effort: a failed mirror must not fail the invocation."""
        try:
            await self.publish_widget_placement()
        except Exception:
            log.exception("Could not mirror the widget placement")

    async def publish_widget_placement(self) -> None:
        """Merge the resolved remote-component node into the widget channel.

        Skipped when the channel already holds it: the subscription fires for
        every deployment_config change on the device, and each write reloads
        the HMI panel.
        """
        nodes = remote_component_nodes(self.ui.to_schema())
        if not nodes:
            log.warning("No remote component in the UI schema; nothing to publish")
            return
        if len(nodes) > 1:
            log.warning(
                "%d remote components in the UI schema; mirroring only the first",
                len(nodes),
            )

        deployment_config = self.received_deployment_config or {}
        channel = widget_channel_name(deployment_config, self.app_key)
        payload = widget_channel_payload(nodes[0])

        try:
            current = (await self.api.fetch_channel_aggregate(channel)).data
        except Exception as exc:  # noqa: BLE001 — a failed read must not block the write
            log.info("Could not read %s (%s); publishing anyway", channel, exc)
            current = None

        if not needs_publish(current, payload):
            log.info("Widget placement on %s already current; skipping", channel)
            return

        log.info("Publishing widget placement to %s: %s", channel, sorted(payload))
        await self.api.update_channel_aggregate(channel, payload)
