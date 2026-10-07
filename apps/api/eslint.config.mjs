import config from "@mon-appart/eslint-config/nestjs"

export default [
  ...config,
  {
    ignores: ["dist/**", "src/generated/**", "coverage/**"],
  },
]
