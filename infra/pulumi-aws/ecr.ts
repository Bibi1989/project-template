import * as aws from "@pulumi/aws";

import { namePrefix, tags } from "./config";

function ecrRepo(name: string) {
  const repo = new aws.ecr.Repository(`${namePrefix}-${name}`, {
    name: `${namePrefix}-${name}`,
    imageScanningConfiguration: { scanOnPush: true },
    imageTagMutability: "MUTABLE",
    forceDelete: true,
    tags,
  });

  new aws.ecr.LifecyclePolicy(`${namePrefix}-${name}-lc`, {
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
