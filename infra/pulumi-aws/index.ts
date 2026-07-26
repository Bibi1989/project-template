import * as pulumi from "@pulumi/pulumi";

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

export const getCredentialsCommand = pulumi.interpolate`aws eks update-kubeconfig --region ${region} --name ${clusterName}`;

export const helmInstallHint = pulumi.interpolate`
# After: ${getCredentialsCommand}

helm upgrade --install ${namePrefix}-app ../helm/app \\
  -n ${namePrefix} --create-namespace \\
  -f ../helm/app/values.yaml -f ../helm/app/values-aws.yaml \\
  --set apps.frontend.image.repository=${frontendRepo.repositoryUrl} \\
  --set apps.backend.image.repository=${backendRepo.repositoryUrl} \\
  --set serviceAccount.annotations."eks\\.amazonaws\\.com/role-arn"=${appRoleArn}
`.apply((s) => s.trim());
