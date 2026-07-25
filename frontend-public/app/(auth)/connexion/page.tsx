import { SignInForm } from "@/components/auth/sign-in-form"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <SignInForm registered={params.registered === "1"} />
    </main>
  )
}
