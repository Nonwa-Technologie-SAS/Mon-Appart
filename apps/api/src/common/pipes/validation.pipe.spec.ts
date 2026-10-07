import { BadRequestException } from "@nestjs/common"
import { IsString } from "class-validator"

import { createValidationPipe } from "./validation.pipe"

class SampleDto {
  @IsString()
  name!: string
}

describe("createValidationPipe", () => {
  const pipe = createValidationPipe()

  it("rejette les champs non déclarés", async () => {
    await expect(
      pipe.transform(
        { name: "Cocody", role: "ADMIN" },
        { type: "body", metatype: SampleDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it("conserve les champs déclarés", async () => {
    await expect(
      pipe.transform({ name: "Cocody" }, { type: "body", metatype: SampleDto }),
    ).resolves.toMatchObject({ name: "Cocody" })
  })
})
