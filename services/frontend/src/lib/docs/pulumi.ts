export type PulumiDocPage = {
  slug: string;
  title: string;
  blurb: string;
  path: string;
  what: string;
  why: string;
  provisions: string[];
  examples: { title: string; code: string }[];
  notes?: string[];
};

export const PULUMI_PAGES: PulumiDocPage[] = [
  {
    slug: "overview",
    title: "Pulumi AWS overview",
    blurb: "TypeScript IaC for VPC + EKS + ECR + IRSA.",
    path: "infra/pulumi-aws",
    what: "Pulumi is the AWS counterpart to Terraform-on-GCP. Same monorepo idea: provision a cluster and registries, then deploy the shared Helm chart with values-aws.yaml.",
    why: "One language (TypeScript) for AWS; GCP stays Terraform. Outputs feed aws eks update-kubeconfig and Helm --set.",
    provisions: ["VPC (public/private + NAT)", "EKS cluster + managed node group", "ECR repos for frontend & backend", "IRSA role for KSA {namePrefix}-app"],
    examples: [
      {
        title: "Commands",
        code: `cd infra/pulumi-aws
npm install
pulumi stack init dev
pulumi config set aws:region us-east-1
pulumi config set namePrefix template
pulumi preview
pulumi up

eval "$(pulumi stack output getCredentialsCommand)"
pulumi stack output
pulumi stack output ecrFrontendUrl
pulumi stack output ecrBackendUrl
pulumi stack output irsaAppRoleArn
# pulumi destroy`,
      },
    ],
    notes: ["Keep namePrefix = infra/config.env NAME_PREFIX."],
  },
  {
    slug: "config",
    title: "config.ts \u2014 stack settings",
    blurb: "namePrefix, region, node size, tags.",
    path: "infra/pulumi-aws/config.ts",
    what: "Reads Pulumi config (and aws:region) with defaults aligned to NAME_PREFIX=template. Builds a shared tags object.",
    why: "Same role as Terraform variables + locals \u2014 one place for naming and sizing.",
    provisions: ["namePrefix, region, kubernetesVersion", "desiredCapacity / minSize / maxSize / instanceType", "tags map"],
    examples: [
      {
        title: "config.ts (full)",
        code: `import * as pulumi from "@pulumi/pulumi";

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
`,
      },
    ],
  },
  {
    slug: "vpc",
    title: "vpc.ts \u2014 network",
    blurb: "awsx VPC with public + private subnets.",
    path: "infra/pulumi-aws/vpc.ts",
    what: "Uses @pulumi/awsx to create a 2-AZ VPC, public subnets (for LBs/NAT), private subnets (for nodes), and a single NAT gateway for cost control.",
    why: "EKS nodes run private; NAT gives them egress to ECR and the internet.",
    provisions: ["VPC", "publicSubnetIds", "privateSubnetIds", "NAT (Single)"],
    examples: [
      {
        title: "vpc.ts (full)",
        code: `import * as awsx from "@pulumi/awsx";

import { namePrefix, tags } from "./config";

/** VPC with public + private subnets and a single NAT gateway (cost-friendly). */
export const vpc = new awsx.ec2.Vpc(\`\${namePrefix}-vpc\`, {
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
`,
      },
    ],
  },
  {
    slug: "eks",
    title: "eks.ts \u2014 cluster & nodes",
    blurb: "EKS control plane + managed node group.",
    path: "infra/pulumi-aws/eks.ts",
    what: "Creates an EKS cluster with OIDC provider (for IRSA), skips the default node group, and attaches a managed node group in private subnets with standard worker policies (EKS, CNI, ECR, SSM).",
    why: "OIDC is required for IAM Roles for Service Accounts \u2014 the AWS analogue of GKE Workload Identity.",
    provisions: ["eks.Cluster (+ OIDC)", "Node IAM role + policy attachments", "aws.eks.NodeGroup", "kubeconfig / oidcIssuer / oidcProviderArn outputs"],
    examples: [
      {
        title: "eks.ts (full)",
        code: `import * as aws from "@pulumi/aws";
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
export const cluster = new eks.Cluster(\`\${namePrefix}-eks\`, {
  name: \`\${namePrefix}-eks\`,
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

export const nodeRole = new aws.iam.Role(\`\${namePrefix}-eks-node\`, {
  name: \`\${namePrefix}-eks-node\`,
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
  new aws.iam.RolePolicyAttachment(\`\${namePrefix}-eks-node-pol-\${i}\`, {
    role: nodeRole.name,
    policyArn,
  });
});

export const nodeGroup = new aws.eks.NodeGroup(
  \`\${namePrefix}-ng\`,
  {
    clusterName: cluster.eksCluster.name,
    nodeGroupName: \`\${namePrefix}-ng\`,
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
      Name: \`\${namePrefix}-ng\`,
    },
  },
  { dependsOn: [cluster] },
);

export const kubeconfig = cluster.kubeconfig;
export const clusterName = cluster.eksCluster.name;
export const clusterEndpoint = cluster.eksCluster.endpoint;
export const oidcProviderArn = cluster.oidcProviderArn;
export const oidcIssuer = cluster.oidcIssuer;
`,
      },
    ],
  },
  {
    slug: "ecr",
    title: "ecr.ts \u2014 container registries",
    blurb: "One ECR repo each for frontend and backend.",
    path: "infra/pulumi-aws/ecr.ts",
    what: "Creates ECR repositories with scan-on-push and a lifecycle policy keeping the last 20 images. forceDelete helps teardown in labs.",
    why: "Same role as GCP Artifact Registry \u2014 CI builds and pushes here; EKS pulls from here.",
    provisions: ["template-frontend / template-backend repos", "Lifecycle: keep last 20"],
    examples: [
      {
        title: "ecr.ts (full)",
        code: `import * as aws from "@pulumi/aws";

import { namePrefix, tags } from "./config";

function ecrRepo(name: string) {
  const repo = new aws.ecr.Repository(\`\${namePrefix}-\${name}\`, {
    name: \`\${namePrefix}-\${name}\`,
    imageScanningConfiguration: { scanOnPush: true },
    imageTagMutability: "MUTABLE",
    forceDelete: true,
    tags,
  });

  new aws.ecr.LifecyclePolicy(\`\${namePrefix}-\${name}-lc\`, {
    repository: repo.name,
    policy: JSON.stringify({
      rules: [
        {
          rulePriority: 1,
          description: "Keep last 20 images",
          selection: {
            tagStatus: "any",
            countType: "imageCountMoreThan",
            countNumber: 20,
          },
          action: { type: "expire" },
        },
      ],
    }),
  });

  return repo;
}

export const frontendRepo = ecrRepo("frontend");
export const backendRepo = ecrRepo("backend");
`,
      },
    ],
  },
  {
    slug: "irsa",
    title: "irsa.ts \u2014 pod IAM role",
    blurb: "IAM role assumable by KSA {namePrefix}-app.",
    path: "infra/pulumi-aws/irsa.ts",
    what: "Creates an IAM role trusted by the cluster OIDC provider for system:serviceaccount:{namePrefix}:{namePrefix}-app, with a starter policy to read Secrets Manager secrets under {namePrefix}/*.",
    why: "Annotate the Helm ServiceAccount with eks.amazonaws.com/role-arn so pods get AWS credentials without static keys.",
    provisions: ["IAM role {namePrefix}-app", "Trust policy via OIDC", "Secrets Manager read policy (starter)"],
    examples: [
      {
        title: "irsa.ts (full)",
        code: `import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { namePrefix, tags } from "./config";
import { oidcIssuer, oidcProviderArn } from "./eks";

/**
 * IRSA role for Helm KSA \`{namePrefix}-app\` in namespace \`{namePrefix}\`.
 * Annotate the ServiceAccount:
 *   eks.amazonaws.com/role-arn: <appRoleArn>
 */
export const appRole = new aws.iam.Role(\`\${namePrefix}-app\`, {
  name: \`\${namePrefix}-app\`,
  assumeRolePolicy: pulumi
    .all([oidcProviderArn, oidcIssuer])
    .apply(([providerArn, issuer]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Federated: providerArn },
            Action: "sts:AssumeRoleWithWebIdentity",
            Condition: {
              StringEquals: {
                [\`\${issuer}:aud\`]: "sts.amazonaws.com",
                [\`\${issuer}:sub\`]: \`system:serviceaccount:\${namePrefix}:\${namePrefix}-app\`,
              },
            },
          },
        ],
      }),
    ),
  tags,
});

new aws.iam.RolePolicy(\`\${namePrefix}-app-policy\`, {
  role: appRole.id,
  policy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "ReadOwnSecrets",
        Effect: "Allow",
        Action: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ],
        Resource: \`arn:aws:secretsmanager:*:*:secret:\${namePrefix}/*\`,
      },
    ],
  }),
});

export const appRoleArn = appRole.arn;
`,
      },
    ],
    notes: ["Helm: --set serviceAccount.annotations.\"eks\\.amazonaws\\.com/role-arn\"=$(pulumi stack output irsaAppRoleArn)"],
  },
  {
    slug: "index",
    title: "index.ts \u2014 exports",
    blurb: "Stack outputs for kubectl, Docker, and Helm.",
    path: "infra/pulumi-aws/index.ts",
    what: "Imports the pieces, ensures the node group is in the graph, and exports region, cluster name, ECR URLs, IRSA ARN, kubeconfig, getCredentialsCommand, and a helmInstallHint string.",
    why: "Same job as Terraform outputs.tf \u2014 a stable contract for humans and CI.",
    provisions: ["ecrFrontendUrl / ecrBackendUrl", "irsaAppRoleArn", "getCredentialsCommand", "helmInstallHint"],
    examples: [
      {
        title: "index.ts (full)",
        code: `import * as pulumi from "@pulumi/pulumi";

import { namePrefix, region } from "./config";
import { backendRepo, frontendRepo } from "./ecr";
import {
  clusterEndpoint,
  clusterName,
  kubeconfig,
  nodeGroup,
  oidcProviderArn,
} from "./eks";
import { appRoleArn } from "./irsa";
import "./vpc";

// Ensure node group is part of the stack graph.
void nodeGroup;

export const awsRegion = region;
export const prefix = namePrefix;
export const eksClusterName = clusterName;
export const eksClusterEndpoint = clusterEndpoint;
export const eksOidcProviderArn = oidcProviderArn;
export const ecrFrontendUrl = frontendRepo.repositoryUrl;
export const ecrBackendUrl = backendRepo.repositoryUrl;
export const irsaAppRoleArn = appRoleArn;
export { kubeconfig };

export const getCredentialsCommand = pulumi.interpolate\`aws eks update-kubeconfig --region \${region} --name \${clusterName}\`;

export const helmInstallHint = pulumi.interpolate\`
# After: \${getCredentialsCommand}

helm upgrade --install \${namePrefix}-app ../helm/app \\\\
  -n \${namePrefix} --create-namespace \\\\
  -f ../helm/app/values.yaml -f ../helm/app/values-aws.yaml \\\\
  --set apps.frontend.image.repository=\${frontendRepo.repositoryUrl} \\\\
  --set apps.backend.image.repository=\${backendRepo.repositoryUrl} \\\\
  --set serviceAccount.annotations."eks\\\\.amazonaws\\\\.com/role-arn"=\${appRoleArn}
\`.apply((s) => s.trim());
`,
      },
    ],
  },
  {
    slug: "project-files",
    title: "Pulumi.yaml & stack config",
    blurb: "Project metadata and Pulumi.dev.yaml defaults.",
    path: "infra/pulumi-aws/Pulumi.yaml",
    what: "Pulumi.yaml names the project and sets the Node/TypeScript runtime. Pulumi.dev.yaml seeds config for the dev stack (region, sizing).",
    why: "Analogous to versions.tf + terraform.tfvars defaults \u2014 reproducible stack settings.",
    provisions: ["project name template-aws", "dev stack defaults"],
    examples: [
      {
        title: "Pulumi.yaml (full)",
        code: `name: template-aws
runtime:
  name: nodejs
  options:
    typescript: true
description: AWS EKS + VPC + ECR + IRSA for the template monorepo
main: index.ts
`,
      },
      {
        title: "Pulumi.dev.yaml (full)",
        code: `config:
  # Override via: pulumi config set aws:region us-west-2
  aws:region: us-east-1
  template-aws:namePrefix: template
  template-aws:kubernetesVersion: "1.31"
  template-aws:desiredCapacity: "2"
  template-aws:minSize: "1"
  template-aws:maxSize: "4"
  template-aws:instanceType: t3.medium
`,
      },
    ],
  },
];

export function getPulumiPage(slug: string): PulumiDocPage | undefined {
  return PULUMI_PAGES.find((p) => p.slug === slug);
}

export function allPulumiSlugs(): string[] {
  return PULUMI_PAGES.map((p) => p.slug);
}
