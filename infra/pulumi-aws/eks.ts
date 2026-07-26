import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";

import {
  desiredCapacity,
  instanceType,
  kubernetesVersion,
  maxSize,
  minSize,
  namePrefix,
  tags,
} from "./config";
import { privateSubnetIds, publicSubnetIds, vpc } from "./vpc";

/**
 * EKS cluster + managed node group in private subnets.
 * Public API endpoint kept for kubectl from laptops (lock down SG/CIDRs in prod).
 */
export const cluster = new eks.Cluster(`${namePrefix}-eks`, {
  name: `${namePrefix}-eks`,
  version: kubernetesVersion,
  vpcId: vpc.vpcId,
  publicSubnetIds,
  privateSubnetIds,
  endpointPrivateAccess: true,
  endpointPublicAccess: true,
  createOidcProvider: true,
  skipDefaultNodeGroup: true,
  tags,
});

export const nodeRole = new aws.iam.Role(`${namePrefix}-eks-node`, {
  name: `${namePrefix}-eks-node`,
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "ec2.amazonaws.com",
  }),
  tags,
});

const nodePolicies = [
  "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
  "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
  "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
  "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
];

nodePolicies.forEach((policyArn, i) => {
  new aws.iam.RolePolicyAttachment(`${namePrefix}-eks-node-pol-${i}`, {
    role: nodeRole.name,
    policyArn,
  });
});

export const nodeGroup = new aws.eks.NodeGroup(
  `${namePrefix}-ng`,
  {
    clusterName: cluster.eksCluster.name,
    nodeGroupName: `${namePrefix}-ng`,
    nodeRoleArn: nodeRole.arn,
    subnetIds: privateSubnetIds,
    scalingConfig: {
      desiredSize: desiredCapacity,
      minSize,
      maxSize,
    },
    instanceTypes: [instanceType],
    capacityType: "ON_DEMAND",
    labels: { workload: "apps" },
    tags: {
      ...tags,
      Name: `${namePrefix}-ng`,
    },
  },
  { dependsOn: [cluster] },
);

export const kubeconfig = cluster.kubeconfig;
export const clusterName = cluster.eksCluster.name;
export const clusterEndpoint = cluster.eksCluster.endpoint;
export const oidcProviderArn = cluster.oidcProviderArn;
export const oidcIssuer = cluster.oidcIssuer;
