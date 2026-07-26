import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { namePrefix, tags } from "./config";
import { oidcIssuer, oidcProviderArn } from "./eks";

/**
 * IRSA role for Helm KSA `{namePrefix}-app` in namespace `{namePrefix}`.
 * Annotate the ServiceAccount:
 *   eks.amazonaws.com/role-arn: <appRoleArn>
 */
export const appRole = new aws.iam.Role(`${namePrefix}-app`, {
  name: `${namePrefix}-app`,
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
                [`${issuer}:aud`]: "sts.amazonaws.com",
                [`${issuer}:sub`]: `system:serviceaccount:${namePrefix}:${namePrefix}-app`,
              },
            },
          },
        ],
      }),
    ),
  tags,
});

new aws.iam.RolePolicy(`${namePrefix}-app-policy`, {
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
        Resource: `arn:aws:secretsmanager:*:*:secret:${namePrefix}/*`,
      },
    ],
  }),
});

export const appRoleArn = appRole.arn;
