import * as awsx from "@pulumi/awsx";

import { namePrefix, tags } from "./config";

/** VPC with public + private subnets and a single NAT gateway (cost-friendly). */
export const vpc = new awsx.ec2.Vpc(`${namePrefix}-vpc`, {
  numberOfAvailabilityZones: 2,
  natGateways: { strategy: "Single" },
  subnetSpecs: [
    { type: "Public", name: "public", cidrMask: 20 },
    { type: "Private", name: "private", cidrMask: 20 },
  ],
  tags,
});

export const privateSubnetIds = vpc.privateSubnetIds;
export const publicSubnetIds = vpc.publicSubnetIds;
