import Link from "next/link"

/** Conseils de prévention, sans prétendre garantir une transaction. */
export function ListingSafetyNotice() {
  return (
    <aside className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Avant de vous engager</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Ne communiquez jamais un code OTP, un mot de passe ou un PIN.</li>
        <li>
          Visitez le bien ou vérifiez l’interlocuteur avant tout paiement
          urgent.
        </li>
        <li>
          Mon Appart met en relation ; il ne garantit pas la propriété ni la
          sécurité juridique d’une transaction.
        </li>
      </ul>
      <p className="mt-2">
        <Link
          href="/guides/eviter-les-arnaques"
          className="underline underline-offset-2"
        >
          Conseils pour éviter les arnaques
        </Link>
      </p>
    </aside>
  )
}
