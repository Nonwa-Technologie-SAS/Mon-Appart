/**
 * Textes des notifications de facturation (in-app et canaux externes). Pas
 * de référence prestataire, de motif interne ni de détail d'incident.
 */
export const billingNotice = {
  paymentSucceeded: (productName: string) => ({
    title: "Paiement confirmé",
    body: `Votre paiement pour « ${productName} » a été confirmé par le prestataire.`,
  }),
  paymentFailed: (productName: string) => ({
    title: "Paiement non abouti",
    body: `Votre paiement pour « ${productName} » n'a pas abouti. Aucun droit n'a été accordé ; vous pouvez réessayer.`,
  }),
  subscriptionActive: (productName: string, end: Date) => ({
    title: "Abonnement actif",
    body: `Votre abonnement « ${productName} » est actif jusqu'au ${formatDate(end)}.`,
  }),
  renewalReminder: (productName: string, end: Date) => ({
    title: "Renouvellement à prévoir",
    body: `Votre abonnement « ${productName} » arrive à échéance le ${formatDate(end)}. Le renouvellement n'est pas automatique.`,
  }),
  pastDue: (productName: string) => ({
    title: "Abonnement échu",
    body: `Votre abonnement « ${productName} » est échu. Renouvelez-le pour conserver vos avantages.`,
  }),
  ended: (productName: string) => ({
    title: "Abonnement terminé",
    body: `Votre abonnement « ${productName} » est terminé.`,
  }),
  refundCompleted: (amount: string, currency: string) => ({
    title: "Remboursement effectué",
    body: `Un remboursement de ${amount} ${currency} a été confirmé par le prestataire.`,
  }),
  refundRejected: () => ({
    title: "Demande de remboursement refusée",
    body: "Votre demande de remboursement n'a pas été acceptée. Contactez l'assistance pour plus d'informations.",
  }),
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
