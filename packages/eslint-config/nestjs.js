import base from "./base.js"

export default [
  ...base,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        sourceType: "module",
      },
    },
  },
]
