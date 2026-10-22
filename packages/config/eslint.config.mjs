import config from "@mon-appart/eslint-config/base"

export default [
  ...config,
  {
    ignores: ["dist/**"],
  },
]
