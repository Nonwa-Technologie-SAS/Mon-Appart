import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Put,
  Req,
  Res,
} from "@nestjs/common"
import { ApiExcludeController } from "@nestjs/swagger"
import type { Request, Response } from "express"
import { pipeline } from "node:stream/promises"

import { Public } from "../../identity"
import { mediaError } from "../domain/media-errors"
import { LocalObjectStorage } from "../infrastructure/storage/local-object-storage"
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from "../infrastructure/storage/object-storage"

const PUBLIC_TYPES: Record<string, string> = {
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
}

/**
 * Émulation du stockage objet en développement et en test : envoi par lien
 * signé, lecture signée, variantes publiques. Répond 404 dès que le stockage
 * configuré n'est pas local (S3, R2, production).
 */
@ApiExcludeController()
@Public()
@Controller({ path: "media/local", version: "1" })
export class LocalStorageController {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private get local(): LocalObjectStorage {
    if (!(this.storage instanceof LocalObjectStorage)) {
      throw new NotFoundException()
    }
    return this.storage
  }

  @Put("uploads/:token")
  @HttpCode(HttpStatus.OK)
  async upload(
    @Param("token") token: string,
    @Headers("content-type") contentType: string | undefined,
    @Headers("content-length") contentLength: string | undefined,
    @Req() request: Request,
  ): Promise<void> {
    await this.local.receiveUpload(token, contentType, contentLength, request)
  }

  @Get("downloads/:token")
  async download(
    @Param("token") token: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.local.openDownload(token)
    response.setHeader("Content-Type", file.contentType)
    response.setHeader("Content-Length", String(file.size))
    response.setHeader("Content-Disposition", file.disposition)
    response.setHeader("Cache-Control", "private, no-store")
    response.setHeader("X-Content-Type-Options", "nosniff")
    await pipeline(file.stream, response)
  }

  @Get("public/:mediaId/:file")
  async publicFile(
    @Param("mediaId") mediaId: string,
    @Param("file") file: string,
    @Res() response: Response,
  ): Promise<void> {
    const extension = file.slice(file.lastIndexOf(".") + 1)
    const type = PUBLIC_TYPES[extension]
    const object = type
      ? await this.local.openPublic(`v/${mediaId}/${file}`)
      : null
    if (!object || !type) throw mediaError("MEDIA_NOT_FOUND")
    response.setHeader("Content-Type", type)
    response.setHeader("Content-Length", String(object.size))
    response.setHeader("Cache-Control", "public, max-age=604800")
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
    await pipeline(object.stream, response)
  }
}
