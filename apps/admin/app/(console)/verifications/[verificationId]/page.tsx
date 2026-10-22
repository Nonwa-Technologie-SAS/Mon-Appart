import { VerificationDetail } from "@/components/verifications/verification-detail"

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ verificationId: string }>
}) {
  const { verificationId } = await params
  return <VerificationDetail verificationId={verificationId} />
}
