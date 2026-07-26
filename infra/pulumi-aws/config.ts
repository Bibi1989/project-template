import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config();
const awsCfg = new pulumi.Config("aws");

export const namePrefix = cfg.get("namePrefix") ?? "template";
export const region = awsCfg.get("region") ?? "us-east-1";
export const kubernetesVersion = cfg.get("kubernetesVersion") ?? "1.31";
export const desiredCapacity = cfg.getNumber("desiredCapacity") ?? 2;
export const minSize = cfg.getNumber("minSize") ?? 1;
export const maxSize = cfg.getNumber("maxSize") ?? 4;
export const instanceType = cfg.get("instanceType") ?? "t3.medium";

export const tags = {
  "managed-by": "pulumi",
  environment: pulumi.getStack(),
  project: namePrefix,
};
