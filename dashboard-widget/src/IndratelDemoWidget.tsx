import "./styles.css";
import {useMemo} from "react";
import RemoteComponentWrapper from "customer_site/RemoteComponentWrapper";
import {useRemoteParams} from "customer_site/useRemoteParams";
import {useAgentChannel} from "doover-js/react";
import {RadioTower} from "lucide-react";

import {Badge} from "./components/ui/badge";
import {DiagnosticsPanel} from "./DiagnosticsPanel";
import {FlowPanel} from "./FlowPanel";
import {TankPanel} from "./TankPanel";
import {absTime, dayjs, fromNow, isNum} from "./lib/format";
import {
  buildConnection,
  buildDiagnostics,
  buildFlow,
  buildTank,
  str,
  type DeploymentConfig,
  type TagBag,
} from "./sources";

/** The extra fields our `ui.RemoteComponent` carries through from app_ui.py. */
interface IndratelDemoElement {
  app_key?: string;
  site_name?: string;
  tank_1_app?: string;
  tank_2_app?: string;
  flow_1_app?: string;
  flow_2_app?: string;
  platform_app?: string;
  show_diagnostics?: boolean;
}

/** The device polls its inputs every second or two; a minute of silence is the link. */
const STALE_AFTER_SECONDS = 60;

function IndratelDemoWidgetContent({uiElement}: {uiElement: IndratelDemoElement}) {
  const params = useRemoteParams();
  const agentId = params?.agentId == null ? undefined : String(params.agentId);

  // One aggregate carries every app's tags on the device, keyed by app key, so
  // a single subscription feeds every panel.
  const tagsQuery = useAgentChannel<Record<string, TagBag>>(agentId, "tag_values");
  const configQuery = useAgentChannel<DeploymentConfig>(agentId, "deployment_config");
  const connectionQuery = useAgentChannel<Record<string, unknown>>(agentId, "doover_connection");

  const tags = tagsQuery.data ?? {};
  const applications = configQuery.data?.applications ?? {};

  const tanks = useMemo(
    () => [
      buildTank(uiElement.tank_1_app, applications, tags, 0, "Tank 1"),
      buildTank(uiElement.tank_2_app, applications, tags, 1, "Tank 2"),
    ],
    [uiElement.tank_1_app, uiElement.tank_2_app, applications, tags],
  );

  const flows = useMemo(
    () => [
      buildFlow(uiElement.flow_1_app, applications, tags, 0, "Flow Meter 1"),
      buildFlow(uiElement.flow_2_app, applications, tags, 1, "Flow Meter 2"),
    ],
    [uiElement.flow_1_app, uiElement.flow_2_app, applications, tags],
  );

  const diagnostics = useMemo(
    () => buildDiagnostics(uiElement.platform_app, applications, tags),
    [uiElement.platform_app, applications, tags],
  );

  const connection = useMemo(
    () => buildConnection(connectionQuery.data),
    [connectionQuery.data],
  );

  const lastUpdated = tagsQuery.last_updated;
  const stale = isNum(lastUpdated)
    ? dayjs().diff(dayjs(lastUpdated), "second") > STALE_AFTER_SECONDS
    : true;

  if (!agentId) {
    return (
      <div className="text-muted-foreground py-6 text-center text-xs">
        Open this widget on a device to see its site overview.
      </div>
    );
  }

  if (tagsQuery.isLoading || configQuery.isLoading) {
    return (
      <div className="text-muted-foreground py-6 text-center text-xs">Loading site data…</div>
    );
  }

  if (tagsQuery.isError || configQuery.isError) {
    return (
      <div className="py-6 text-center text-xs text-red-600 dark:text-red-400">
        Could not load this device's channels.
      </div>
    );
  }

  return (
    <section className="text-foreground w-full space-y-3 py-1">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">
          {str(uiElement.site_name, "Site Overview")}
        </h2>
        <Badge
          variant={stale ? "muted" : "success"}
          title={lastUpdated ? absTime(lastUpdated) : undefined}
        >
          <RadioTower className="size-3" />
          {lastUpdated ? `updated ${fromNow(lastUpdated)}` : "waiting for data"}
        </Badge>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {tanks.map((tank, index) => (
          <TankPanel key={tank.appKey ?? `tank-${index}`} tank={tank} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {flows.map((flow, index) => (
          <FlowPanel key={flow.appKey ?? `flow-${index}`} flow={flow} />
        ))}
      </div>

      {uiElement.show_diagnostics !== false && (
        <DiagnosticsPanel diagnostics={diagnostics} connection={connection} />
      )}
    </section>
  );
}

// The query client and doover context both come from the host via
// RemoteComponentWrapper — doover-js is a shared singleton (rsbuild.config.ts),
// so the hooks above read the host's live DooverClient directly.
const IndratelDemoWidget = (props: any) => (
  <RemoteComponentWrapper>
    <IndratelDemoWidgetContent {...props} />
  </RemoteComponentWrapper>
);

export default IndratelDemoWidget;
