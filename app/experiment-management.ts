export type ExperimentStatus = "draft" | "running";
export type ExperimentAllocation = "split" | "allA" | "allB";

export type ExperimentDspConfig = {
  id: number;
  name: string;
  enabled: boolean;
  floor: number;
  pids: string[];
};

export type GroupExperiment = {
  groupId: number;
  testName: string;
  status: ExperimentStatus;
  aTraffic: number;
  bTraffic: number;
  allocation: ExperimentAllocation;
  copyAtoB: boolean;
  createdAt: string | null;
  updatedAt: string;
  aConfig: ExperimentDspConfig[];
  bConfig: ExperimentDspConfig[];
};

export function validateExperiment(testName: string, aTraffic: number, bTraffic: number): string {
  if (!testName.trim()) return "请输入测试名称";
  if (testName.trim().length > 30) return "测试名称不能超过30个字符";
  if (!Number.isFinite(aTraffic) || !Number.isFinite(bTraffic) || aTraffic < 0 || bTraffic < 0) return "请输入有效的流量比例";
  if (aTraffic + bTraffic !== 100) return "对照组与实验组流量比例之和必须为100%";
  return "";
}

export function formatExperimentTime(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function startExperiment(experiment: GroupExperiment, now = new Date()): GroupExperiment {
  const timestamp = formatExperimentTime(now);
  return { ...experiment, status: "running", createdAt: experiment.createdAt ?? timestamp, updatedAt: timestamp };
}

export function allocateAllTraffic(experiment: GroupExperiment, group: "A" | "B", now = new Date()): GroupExperiment {
  return {
    ...experiment,
    allocation: group === "A" ? "allA" : "allB",
    aTraffic: group === "A" ? 100 : 0,
    bTraffic: group === "B" ? 100 : 0,
    updatedAt: formatExperimentTime(now),
  };
}
