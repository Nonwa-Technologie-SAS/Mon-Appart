import type { Provider } from "@nestjs/common"

import { MediaConfig } from "../../media.config"
import { LocalObjectStorage } from "./local-object-storage"
import { OBJECT_STORAGE, type ObjectStorage } from "./object-storage"
import { S3ObjectStorage } from "./s3-object-storage"

export function createObjectStorage(config: MediaConfig): ObjectStorage {
  if (config.storage === "local") {
    if (config.production) {
      throw new Error("Stockage local interdit en production")
    }
    return new LocalObjectStorage(config.local)
  }
  return new S3ObjectStorage({
    provider: config.storage === "r2" ? "R2" : "S3",
    ...config.s3,
  })
}

export const objectStorageProvider: Provider = {
  provide: OBJECT_STORAGE,
  inject: [MediaConfig],
  useFactory: createObjectStorage,
}
