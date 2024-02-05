import * as proto from "../gcp/proto";
import { Client } from "../apiv2";
import { needProjectId } from "../projectUtils";
import { apphostingOrigin } from "../api";
import { ensure } from "../ensureApiEnabled";
import * as deploymentTool from "../deploymentTool";
import { FirebaseError } from "../error";

export const API_HOST = new URL(apphostingOrigin).host;
export const API_VERSION = "v1alpha";

export const client = new Client({
  urlPrefix: apphostingOrigin,
  auth: true,
  apiVersion: API_VERSION,
});

type BuildState = "BUILDING" | "BUILD" | "DEPLOYING" | "READY" | "FAILED";

interface Codebase {
  repository?: string;
  rootDirectory: string;
}

/**
 * Specifies how Backend's data is replicated and served.
 *   GLOBAL_ACCESS: Stores and serves content from multiple points-of-presence (POP)
 *   REGIONAL_STRICT: Restricts data and serving infrastructure in Backend's region
 *
 */
export type ServingLocality = "GLOBAL_ACCESS" | "REGIONAL_STRICT";

/** A Backend, the primary resource of Frameworks. */
export interface Backend {
  name: string;
  mode?: string;
  codebase: Codebase;
  servingLocality: ServingLocality;
  labels: Record<string, string>;
  createTime: string;
  updateTime: string;
  uri: string;
}

export type BackendOutputOnlyFields = "name" | "createTime" | "updateTime" | "uri";

export interface Build {
  name: string;
  state: BuildState;
  error: Status;
  image: string;
  config?: BuildConfig;
  source: BuildSource;
  sourceRef: string;
  buildLogsUri?: string;
  displayName?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uuid: string;
  etag: string;
  reconciling: boolean;
  createTime: string;
  updateTime: string;
  deleteTime: string;
}

export interface ListBuildsResponse {
  builds: Build[];
  nextPageToken?: string;
  unreachable?: string[];
}

export type BuildOutputOnlyFields =
  | "state"
  | "error"
  | "image"
  | "sourceRef"
  | "buildLogUri"
  | "reconciling"
  | "uuid"
  | "etag"
  | "createTime"
  | "updateTime"
  | "deleteTime";

export interface BuildConfig {
  minInstances?: number;
  memory?: string;
}

interface BuildSource {
  codebase: CodebaseSource;
}

interface CodebaseSource {
  // oneof reference
  branch?: string;
  commit?: string;
  tag?: string;
  // end oneof reference
  displayName: string;
  hash: string;
  commitMessage: string;
  uri: string;
  commitTime: string;
}

export type CodebaseSourceOutputOnlyFields =
  | "displayName"
  | "hash"
  | "commitMessage"
  | "uri"
  | "commitTime";

export type BuildInput = Omit<Build, BuildOutputOnlyFields | "source"> & {
  source: Omit<BuildSource, "codebase"> & {
    codebase: Omit<CodebaseSource, CodebaseSourceOutputOnlyFields>;
  };
};

interface Status {
  code: number;
  message: string;
  details: unknown;
}

type RolloutState =
  | "STATE_UNSPECIFIED"
  | "QUEUED"
  | "PENDING_BUILD"
  | "PROGRESSING"
  | "PAUSED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export interface Rollout {
  name: string;
  state: RolloutState;
  paused?: boolean;
  pauseTime: string;
  error?: Error;
  build: string;
  stages?: RolloutStage[];
  displayName?: string;
  createTime: string;
  updateTime: string;
  deleteTime?: string;
  purgeTime?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid: string;
  etag: string;
  reconciling: boolean;
}

export type RolloutOutputOnlyFields =
  | "state"
  | "pauseTime"
  | "createTime"
  | "updateTime"
  | "deleteTime"
  | "purgeTime"
  | "uid"
  | "etag"
  | "reconciling";

export interface ListRolloutsResponse {
  rollouts: Rollout[];
  unreachable: string[];
  nextPageToken?: string;
}

export interface Traffic {
  name: string;
  // oneof traffic_management
  target?: TrafficSet;
  rolloutPolicy?: RolloutPolicy;
  // end oneof traffic_management
  current: TrafficSet;
  reconciling: boolean;
  createTime: string;
  updateTime: string;
  annotations?: Record<string, string>;
  etag: string;
  uid: string;
}

export type TrafficOutputOnlyFields =
  | "current"
  | "reconciling"
  | "createTime"
  | "updateTime"
  | "etag"
  | "uid";

export interface TrafficSet {
  splits: TrafficSplit[];
}

export interface TrafficSplit {
  build: string;
  percent: number;
}

export interface RolloutPolicy {
  // oneof trigger
  codebaseBranch?: string;
  codebaseTagPattern?: string;
  // end oneof trigger
  stages?: RolloutStage[];
  disabled?: boolean;
  disabledTime: string;
}

export type RolloutPolicyOutputOnlyFields = "disabledtime";

export type RolloutProgression =
  | "PROGRESSION_UNSPECIFIED"
  | "IMMEDIATE"
  | "LINEAR"
  | "EXPONENTIAL"
  | "PAUSE";

export interface RolloutStage {
  progression: RolloutProgression;
  duration?: {
    seconds: number;
    nanos: number;
  };
  targetPercent?: number;
  startTime: string;
  endTime: string;
}

export type RolloutStageOutputOnlyFields = "startTime" | "endTime";

interface OperationMetadata {
  createTime: string;
  endTime: string;
  target: string;
  verb: string;
  statusDetail: string;
  cancelRequested: boolean;
  apiVersion: string;
}

export interface Operation {
  name: string;
  metadata?: OperationMetadata;
  done: boolean;
  // oneof result
  error?: Status;
  response?: any;
  // end oneof result
}

export interface ListBackendsResponse {
  backends: Backend[];
}

/**
 * Creates a new Backend in a given project and location.
 */
export async function createBackend(
  projectId: string,
  location: string,
  backendReqBoby: Omit<Backend, BackendOutputOnlyFields>,
  backendId: string,
): Promise<Operation> {
  const res = await client.post<Omit<Backend, BackendOutputOnlyFields>, Operation>(
    `projects/${projectId}/locations/${location}/backends`,
    {
      ...backendReqBoby,
      labels: {
        ...backendReqBoby.labels,
        ...deploymentTool.labels(),
      },
    },
    { queryParams: { backendId } },
  );

  return res.body;
}

/**
 * Gets backend details.
 */
export async function getBackend(
  projectId: string,
  location: string,
  backendId: string,
): Promise<Backend> {
  const name = `projects/${projectId}/locations/${location}/backends/${backendId}`;
  const res = await client.get<Backend>(name);
  return res.body;
}

/**
 * List all backends present in a project and region.
 */
export async function listBackends(
  projectId: string,
  location: string,
): Promise<ListBackendsResponse> {
  const name = `projects/${projectId}/locations/${location}/backends`;
  const res = await client.get<ListBackendsResponse>(name);

  return res.body;
}

/**
 * Deletes a backend with backendId in a given project and location.
 */
export async function deleteBackend(
  projectId: string,
  location: string,
  backendId: string,
): Promise<Operation> {
  const name = `projects/${projectId}/locations/${location}/backends/${backendId}?force=true`;
  const res = await client.delete<Operation>(name);

  return res.body;
}

/**
 * Get a Build by Id
 */
export async function getBuild(
  projectId: string,
  location: string,
  backendId: string,
  buildId: string,
): Promise<Build> {
  const name = `projects/${projectId}/locations/${location}/backends/${backendId}/builds/${buildId}`;
  const res = await client.get<Build>(name);
  return res.body;
}

/**
 * List Builds by backend
 */
export async function listBuilds(
  projectId: string,
  location: string,
  backendId: string,
): Promise<ListBuildsResponse> {
  const name = `projects/${projectId}/locations/${location}/backends/${backendId}/builds`;
  let nextPageToken: string | null = null;
  const res: ListBuildsResponse = {
    builds: [],
    unreachable: [],
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const queryParams: Record<string, string> = {};
    if (nextPageToken) {
      queryParams["nextPageToken"] = nextPageToken;
    }
    const int = await client.get<ListBuildsResponse>(name, { queryParams });
    res.builds.splice(res.builds.length, 0, ...(int.body.builds || []));
    res.unreachable?.splice(res.unreachable.length, 0, ...(int.body.unreachable || []));
    if (!int.body.nextPageToken) {
      break;
    }
    nextPageToken = int.body.nextPageToken;
  }

  res.unreachable = [...new Set(res.unreachable)];
  return res;
}

/**
 * Creates a new Build in a given project and location.
 */
export async function createBuild(
  projectId: string,
  location: string,
  backendId: string,
  buildId: string,
  buildInput: Omit<BuildInput, "name">,
): Promise<Operation> {
  const res = await client.post<Omit<BuildInput, "name">, Operation>(
    `projects/${projectId}/locations/${location}/backends/${backendId}/builds`,
    {
      ...buildInput,
      labels: {
        ...buildInput.labels,
        ...deploymentTool.labels(),
      },
    },
    { queryParams: { buildId } },
  );
  return res.body;
}

/**
 * Create a new rollout for a backend.
 */
export async function createRollout(
  projectId: string,
  location: string,
  backendId: string,
  rolloutId: string,
  rollout: Omit<Rollout, RolloutOutputOnlyFields | "name">,
): Promise<Operation> {
  const res = await client.post<Omit<Rollout, RolloutOutputOnlyFields | "name">, Operation>(
    `projects/${projectId}/locations/${location}/backends/${backendId}/rollouts`,
    {
      ...rollout,
      labels: {
        ...rollout.labels,
        ...deploymentTool.labels(),
      },
    },
    { queryParams: { rolloutId } },
  );
  return res.body;
}

/**
 * List all rollouts for a backend.
 */
export async function listRollouts(
  projectId: string,
  location: string,
  backendId: string,
): Promise<ListRolloutsResponse> {
  const name = `projects/${projectId}/locations/${location}/backends/${backendId}/rollouts`;
  let nextPageToken: string | undefined = undefined;
  const res: ListRolloutsResponse = {
    rollouts: [],
    unreachable: [],
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const queryParams: Record<string, string> = {};
    if (nextPageToken) {
      queryParams["nextPageToken"] = nextPageToken;
    }
    const int = await client.get<ListRolloutsResponse>(name, { queryParams });
    res.rollouts.splice(res.rollouts.length, 0, ...(int.body.rollouts || []));
    res.unreachable?.splice(res.unreachable.length, 0, ...(int.body.unreachable || []));
    if (!int.body.nextPageToken) {
      break;
    }
    nextPageToken = int.body.nextPageToken;
  }

  res.unreachable = [...new Set(res.unreachable)];
  return res;
}

/**
 * Update traffic of a backend.
 */
export async function updateTraffic(
  projectId: string,
  location: string,
  backendId: string,
  traffic: Omit<Traffic, TrafficOutputOnlyFields | "name">,
): Promise<Operation> {
  const fieldMasks = proto.fieldMasks(traffic);
  const queryParams = {
    updateMask: fieldMasks.join(","),
  };
  const name = `projects/${projectId}/locations/${location}/backends/${backendId}/traffic`;
  const res = await client.patch<Omit<Traffic, TrafficOutputOnlyFields>, Operation>(
    name,
    { ...traffic, name },
    {
      queryParams,
    },
  );
  return res.body;
}

export interface Location {
  name: string;
  locationId: string;
}

interface ListLocationsResponse {
  locations: Location[];
  nextPageToken?: string;
}

/**
 * Lists information about the supported locations.
 */
export async function listLocations(projectId: string): Promise<Location[]> {
  let pageToken;
  let locations: Location[] = [];
  do {
    const response = await client.get<ListLocationsResponse>(`projects/${projectId}/locations`);
    if (response.body.locations && response.body.locations.length > 0) {
      locations = locations.concat(response.body.locations);
    }
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  return locations;
}

/**
 * Ensure that Frameworks API is enabled on the project.
 */
export async function ensureApiEnabled(options: any): Promise<void> {
  const projectId = needProjectId(options);
  return await ensure(projectId, API_HOST, "frameworks", true);
}

/**
 * Generates the next build ID to fit with the naming scheme of the backend API.
 * @param counter Overrides the counter to use, avoiding an API call.
 * @return
 */
export async function getNextRolloutId(
  projectId: string,
  location: string,
  backendId: string,
  counter?: number,
): Promise<string> {
  const date = new Date();
  const year = date.getUTCFullYear();
  // Note: month is 0 based in JS
  const month = String(date.getUTCMonth()).padStart(2, "0");
  const day = String(date.getUTCDay()).padStart(2, "0");

  if (counter) {
    return `build-${year}-${month}-${day}-${counter}`;
  }

  // Note: must use exports here so that listRollouts can be stubbed in tests.
  const builds = await (exports as { listRollouts: typeof listRollouts }).listRollouts(
    projectId,
    location,
    backendId,
  );
  if (builds.unreachable?.includes(location)) {
    throw new FirebaseError(
      `Firebase App Hosting is currently unreachable in location ${location}`,
    );
  }

  let highest = 0;
  const test = new RegExp(
    `projects/${projectId}/locations/${location}/backends/${backendId}/rollouts/build-${year}-${month}-${day}-(\\d+)`,
  );
  for (const rollout of builds.rollouts) {
    const match = rollout.name.match(test);
    if (!match) {
      continue;
    }
    const n = Number(match[1]);
    if (n > highest) {
      highest = n;
    }
  }
  return `build-${year}-${month}-${day}-${highest + 1}`;
}
